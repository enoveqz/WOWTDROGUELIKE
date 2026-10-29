import * as THREE from 'three';
import type { Element } from '../config/classes.ts';
import { dist, dist2 } from '../core/math.ts';
import type { ProjectileKind } from '../world/effects.ts';
import type { Enemy } from './enemies.ts';
import type { Run } from './run.ts';

export type DamageSource = 'hero' | 'tower' | 'pet' | 'mount' | 'env';

export interface HitOpts {
  source: DamageSource;
  element?: Element;
  canCrit?: boolean;
  skill?: boolean;
  forceCrit?: boolean;
  critMul?: number;
  dot?: boolean;
  silent?: boolean;
}

interface Projectile {
  mesh: THREE.Mesh;
  owner: 'hero' | 'tower' | 'enemy' | 'pet';
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  speed: number;
  target: Enemy | null;
  targetKind: 'enemy' | 'player' | 'crystal' | 'none';
  tx: number;
  tz: number;
  damage: number;
  range: number;
  pierce: number;
  hit: Set<number>;
  splash: number;
  color: number;
  trail: number;
  opts: HitOpts;
  onHit?: (x: number, z: number, e: Enemy | null) => void;
  arc: number;
  t: number;
  total: number;
  sx: number;
  sz: number;
  homing: boolean;
  radius: number;
}

export interface Zone {
  x: number;
  z: number;
  r: number;
  t: number;
  dur: number;
  interval: number;
  acc: number;
  onTick?: (inside: Enemy[], z: Zone) => void;
  trigger?: (z: Zone) => boolean;
  mesh?: THREE.Object3D;
  removeVisual?: () => void;
  tag?: string;
  done: boolean;
}

/**
 * Schadenssystem, Projektile (Held, Türme, Gegner) und Bodenzonen
 * (Fallen, Rauch, Pfeilhagel, Feuer). Hier laufen alle Treffer zusammen.
 */
export class Combat {
  private run: Run;
  readonly projectiles: Projectile[] = [];
  readonly zones: Zone[] = [];
  private tmp = new THREE.Vector3();
  private crystalWarnT = 0;
  private bladeDanceCd = 0;

  constructor(run: Run) {
    this.run = run;
  }

  /* ── Schaden an Gegnern ─────────────────────────────────── */
  damageEnemy(e: Enemy, base: number, o: HitOpts): number {
    if (!e.alive || base <= 0) return 0;
    const run = this.run;
    const stats = run.stats;
    let dmg = base;
    let crit = false;
    const heroSide = o.source === 'hero' || o.source === 'pet' || o.source === 'mount';
    if (heroSide && o.canCrit !== false && !o.dot) {
      if (o.forceCrit || run.rng.next() < stats.crit) {
        crit = true;
        dmg *= stats.critDmg * (o.critMul ?? 1);
      }
    }
    if (e.status.slowed && run.flags.has('shatter')) dmg *= 1.2;
    if (e.status.vulnT > 0) dmg *= 1.2;
    if (!o.dot) {
      const el = o.element ?? 'physical';
      const armor = el === 'physical' ? e.armor : e.armor * 0.5;
      dmg *= 1 - armor;
    }
    dmg = Math.max(1, dmg);
    e.hp -= dmg;
    e.flashT = 0.12;
    if (!e.def.boss) e.bar.group.visible = true;
    run.stats_damageDealt += dmg;

    if (!o.silent && run.save.data.settings.damageNumbers) {
      this.tmp.set(e.x, e.y + e.rig.barHeight + 0.2, e.z);
      const kind = crit ? 'crit' : o.dot ? 'dot' : o.source === 'tower' ? 'tower' : 'hit';
      run.ui.floatText(this.tmp, Math.round(dmg).toString(), kind);
    }

    if (heroSide && !o.dot) {
      if (stats.lifesteal > 0) run.player.heal(dmg * stats.lifesteal, true);
      if (crit && run.synergies.has('bladeDance') && this.bladeDanceCd <= 0) {
        run.player.heal(run.player.maxHp * 0.015, true);
        this.bladeDanceCd = 0.25;
      }
      if (run.flags.has('chillOnHit')) e.status.applySlow(run.synergies.has('permafrost') ? 0.35 : 0.2, 1.5);
      if (o.skill && run.flags.has('burnOnSkill')) {
        e.status.burnDps = Math.max(e.status.burnDps, stats.power * 0.4 * (run.flags.has('burnSpread') ? 1.5 : 1));
        e.status.burnT = 3;
      }
      if (o.source === 'hero') run.audio.play(crit ? 'crit' : 'hit', 0.6);
    }

    if (e.hp <= 0) this.kill(e, o.source);
    return dmg;
  }

  private kill(e: Enemy, source: DamageSource): void {
    const run = this.run;
    e.alive = false;
    e.hp = 0;
    e.deathT = 0;
    run.kills++;
    const gold = Math.max(1, Math.round(e.gold * run.stats.gold * run.event.goldMul));
    run.addGold(gold, { x: e.x, y: e.y + 1.5, z: e.z });
    run.effects.burst({ x: e.x, y: e.y + 1, z: e.z }, e.def.boss ? 0xfbbf24 : 0xc084fc, e.def.boss ? 80 : 14, e.def.boss ? 10 : 4, 0.7);
    run.audio.play('enemyDie', 0.7);
    if (source === 'mount') run.player.mountXpGain += 3;
    if (e.status.burnT > 0 && run.flags.has('burnSpread')) {
      let n = 0;
      for (const o of run.enemies.inRadius(e.x, e.z, 4)) {
        if (o === e) continue;
        o.status.burnDps = Math.max(o.status.burnDps, e.status.burnDps);
        o.status.burnT = 3;
        run.effects.burst({ x: o.x, y: o.y + 1, z: o.z }, 0xf97316, 6, 3, 0.4);
        if (++n >= 3) break;
      }
    }
    if (e.def.boss) run.onBossKilled(e);
  }

  /* ── Schaden am Helden & Kristall ───────────────────────── */
  damagePlayer(amount: number, src?: Enemy): void {
    const run = this.run;
    const p = run.player;
    if (!p.alive || p.invulnerable) return;
    if (p.evadeChance > 0 && run.rng.next() < p.evadeChance) {
      run.ui.floatText(this.tmp.set(p.x, p.y + 2.4, p.z), 'Ausgewichen', 'info');
      return;
    }
    const armor = Math.min(0.85, run.stats.armor + (p.mounted ? p.mountDef.mountedArmor : 0));
    const dmg = amount * (1 - armor) * p.damageTakenMul();
    p.hp -= dmg;
    p.sinceHit = 0;
    p.flashT = 0.15;
    run.audio.play('playerHit', 0.7);
    run.camera.shake(Math.min(0.35, dmg / 60), 0.18);
    if (src && src.alive && !src.def.ranged) {
      if (run.flags.has('thorns')) this.damageEnemy(src, amount * 0.4, { source: 'hero', canCrit: false, silent: true });
      if (p.reflect > 0 && src.alive) this.damageEnemy(src, amount * p.reflect, { source: 'hero', canCrit: false });
    }
    if (p.hp <= 0) p.die();
  }

  damageCrystal(amount: number, _src?: Enemy): void {
    const run = this.run;
    if (run.ended) return;
    run.crystalHp -= amount;
    run.audio.play('crystalHit', 0.5);
    const c = run.level.crystal;
    if (this.crystalWarnT <= 0) {
      this.crystalWarnT = 7;
      run.notify('Der Aetherkristall wird angegriffen!', 'danger');
    }
    run.effects.burst({ x: c.x + (Math.random() - 0.5) * 2, y: 3, z: c.z + (Math.random() - 0.5) * 2 }, 0x67e8f9, 6, 3, 0.5);
    if (run.crystalHp <= 0) {
      run.crystalHp = 0;
      run.defeat();
    }
  }

  /* ── Projektile ─────────────────────────────────────────── */
  heroShot(kind: ProjectileKind, color: number, x: number, y: number, z: number, dirX: number, dirZ: number, speed: number, range: number, damage: number, opts: HitOpts, extra: Partial<Pick<Projectile, 'pierce' | 'splash' | 'onHit' | 'radius' | 'trail'>> = {}): void {
    const len = Math.hypot(dirX, dirZ) || 1;
    this.push({
      kind,
      color,
      owner: opts.source === 'pet' ? 'pet' : 'hero',
      x,
      y,
      z,
      dx: dirX / len,
      dz: dirZ / len,
      speed,
      target: null,
      targetKind: 'none',
      tx: 0,
      tz: 0,
      damage,
      range,
      pierce: extra.pierce ?? 1,
      splash: extra.splash ?? 0,
      onHit: extra.onHit,
      radius: extra.radius ?? 0.6,
      trail: extra.trail ?? color,
      opts,
      homing: false,
      arc: 0,
    });
  }

  towerShot(kind: ProjectileKind, color: number, x: number, y: number, z: number, target: Enemy, speed: number, damage: number, splash: number, onHit?: (x: number, z: number, e: Enemy | null) => void): void {
    this.push({
      kind,
      color,
      owner: 'tower',
      x,
      y,
      z,
      dx: 0,
      dz: 1,
      speed,
      target,
      targetKind: 'enemy',
      tx: target.x,
      tz: target.z,
      damage,
      range: 60,
      pierce: 1,
      splash,
      onHit,
      radius: 0.5,
      trail: color,
      opts: { source: 'tower', element: kind === 'arcane' ? 'arcane' : 'physical', canCrit: false },
      homing: true,
      arc: 0,
    });
  }

  enemyShot(e: Enemy, target: 'player' | 'crystal', damage: number): void {
    const run = this.run;
    const p = run.player;
    const c = run.level.crystal;
    const tx = target === 'player' ? p.x + p.vx * 0.3 : c.x;
    const tz = target === 'player' ? p.z + p.vz * 0.3 : c.z;
    const isOrb = e.def.id === 'shaman';
    const d = dist(e.x, e.z, tx, tz);
    this.push({
      kind: isOrb ? 'orb' : 'spear',
      color: isOrb ? 0xc084fc : 0xffffff,
      owner: 'enemy',
      x: e.x,
      y: e.y + 1.6 * e.def.scale,
      z: e.z,
      dx: (tx - e.x) / (d || 1),
      dz: (tz - e.z) / (d || 1),
      speed: isOrb ? 11 : 15,
      target: null,
      targetKind: target,
      tx,
      tz,
      damage,
      range: d + 0.5,
      pierce: 1,
      splash: 0,
      radius: 1,
      trail: isOrb ? 0xa855f7 : 0,
      opts: { source: 'env' },
      homing: false,
      arc: isOrb ? 0.5 : 2.2,
    });
  }

  private push(p: Omit<Projectile, 'mesh' | 'hit' | 't' | 'total' | 'sx' | 'sz'> & { kind: ProjectileKind }): void {
    const mesh = this.run.effects.acquireProjectile(p.kind, p.color);
    const proj: Projectile = { ...p, mesh, hit: new Set(), t: 0, total: p.range / p.speed, sx: p.x, sz: p.z };
    mesh.position.set(p.x, p.y, p.z);
    this.projectiles.push(proj);
  }

  private release(i: number): void {
    const p = this.projectiles[i];
    this.run.effects.releaseProjectile(p.mesh);
    this.projectiles.splice(i, 1);
  }

  update(dt: number): void {
    const run = this.run;
    if (this.crystalWarnT > 0) this.crystalWarnT -= dt;
    if (this.bladeDanceCd > 0) this.bladeDanceCd -= dt;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      if (p.homing) {
        if (p.target && p.target.alive) {
          p.tx = p.target.x;
          p.tz = p.target.z;
        }
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        const ty = (p.target ? p.target.y + 1.0 * p.target.def.scale : run.world.heightAt(p.tx, p.tz) + 0.5);
        const step = p.speed * dt;
        if (d <= step + 0.3) {
          this.impact(p, p.target && p.target.alive ? p.target : null);
          this.release(i);
          continue;
        }
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        p.y += (ty - p.y) * Math.min(1, dt * 6);
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.lookAt(p.tx, ty, p.tz);
      } else {
        const step = p.speed * dt;
        p.x += p.dx * step;
        p.z += p.dz * step;
        p.range -= step;
        let y = p.y;
        if (p.arc > 0) {
          const f = Math.min(1, p.t / p.total);
          y = p.y + Math.sin(f * Math.PI) * p.arc;
        }
        p.mesh.position.set(p.x, y, p.z);
        this.tmp.set(p.x + p.dx, y, p.z + p.dz);
        p.mesh.lookAt(this.tmp);
        if (p.owner === 'enemy') {
          if (p.range <= 0) {
            this.enemyImpact(p);
            this.release(i);
            continue;
          }
        } else {
          let done = false;
          for (const e of run.enemies.list) {
            if (!e.alive || p.hit.has(e.id)) continue;
            const rr = e.radius + p.radius;
            if (dist2(p.x, p.z, e.x, e.z) < rr * rr) {
              p.hit.add(e.id);
              this.impact(p, e);
              p.pierce--;
              if (p.pierce <= 0) {
                done = true;
                break;
              }
            }
          }
          if (done || p.range <= 0) {
            if (!done && p.splash > 0) this.impact(p, null);
            this.release(i);
            continue;
          }
        }
      }
      if (p.trail && run.frame % 2 === 0) run.effects.trail(p.mesh.position, p.trail);
    }

    // Bodenzonen
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      if (z.trigger) {
        if (z.trigger(z)) z.done = true;
      } else if (z.onTick) {
        z.acc += dt;
        while (z.acc >= z.interval) {
          z.acc -= z.interval;
          z.onTick(run.enemies.inRadius(z.x, z.z, z.r), z);
        }
      }
      if (z.done || z.t >= z.dur) {
        z.removeVisual?.();
        if (z.mesh) run.scene.remove(z.mesh);
        this.zones.splice(i, 1);
      }
    }
  }

  private impact(p: Projectile, e: Enemy | null): void {
    const run = this.run;
    if (p.onHit) {
      p.onHit(e ? e.x : p.x, e ? e.z : p.z, e);
      return;
    }
    if (p.splash > 0) {
      const cx = e ? e.x : p.x;
      const cz = e ? e.z : p.z;
      for (const o of [...run.enemies.inRadius(cx, cz, p.splash)]) {
        this.damageEnemy(o, o === e ? p.damage : p.damage * 0.6, p.opts);
      }
      run.effects.ring(cx, run.world.heightAt(cx, cz), cz, p.splash, p.color, 0.35);
      run.effects.burst({ x: cx, y: run.world.heightAt(cx, cz) + 0.8, z: cz }, p.color, 10, 4, 0.4);
    } else if (e) {
      this.damageEnemy(e, p.damage, p.opts);
      run.effects.burst({ x: e.x, y: e.y + 1, z: e.z }, p.color, 5, 3, 0.3);
    }
  }

  private enemyImpact(p: Projectile): void {
    const run = this.run;
    if (p.targetKind === 'crystal') {
      this.damageCrystal(p.damage * 0.75);
      return;
    }
    const pl = run.player;
    if (pl.alive && dist(pl.x, pl.z, p.x, p.z) < 1.25) this.damagePlayer(p.damage);
    run.effects.puff({ x: p.x, y: run.world.heightAt(p.x, p.z) + 0.2, z: p.z }, 0xa8a29e, 2, 1, 0.4);
  }

  addZone(z: Omit<Zone, 't' | 'acc' | 'done'>): Zone {
    const zone: Zone = { ...z, t: 0, acc: 0, done: false };
    this.zones.push(zone);
    return zone;
  }

  zonesTagged(tag: string): Zone[] {
    return this.zones.filter((z) => z.tag === tag);
  }

  clear(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) this.release(i);
    for (const z of this.zones) {
      z.removeVisual?.();
      if (z.mesh) this.run.scene.remove(z.mesh);
    }
    this.zones.length = 0;
  }
}
