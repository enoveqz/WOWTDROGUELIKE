import * as THREE from 'three';
import { CLASSES, type ClassDef } from '../config/classes.ts';
import { MOUNTS, mountLevelBonus, mountLevelFromXp, type MountDef } from '../config/mounts.ts';
import { RACES, type RaceDef } from '../config/races.ts';
import { RACIAL_UNLOCK_LEVEL, SKILL_UNLOCK_LEVEL, talentFlagRank } from '../config/talents.ts';
import { clamp, damp, dampAngle, dist, dist2 } from '../core/math.ts';
import { makeMaterialsUnique, setFlash } from '../world/assets.ts';
import { createHero, createMount, createPet, type HeroRig, type MountRig, type PetRig } from '../world/models.ts';
import { castRacial, castSkill } from './abilities.ts';
import type { Enemy } from './enemies.ts';
import type { Input } from './input.ts';
import { Status } from './status.ts';
import type { Run } from './run.ts';

interface Dash {
  dx: number;
  dz: number;
  speed: number;
  t: number;
  hitRadius: number;
  hits: Set<number>;
  onHit?: (e: Enemy) => void;
  invuln: boolean;
  ghost: boolean;
}

interface Pet {
  rig: PetRig;
  x: number;
  z: number;
  facing: number;
  target: Enemy | null;
  biteCd: number;
  phase: number;
}

export class Player {
  readonly run: Run;
  readonly cls: ClassDef;
  readonly race: RaceDef;
  readonly mountDef: MountDef;
  readonly mountLevel: number;
  readonly rig: HeroRig;
  readonly mountRig: MountRig;
  readonly root = new THREE.Group();
  private heroHolder = new THREE.Group();
  private mats: THREE.MeshStandardMaterial[];
  pet: Pet | null = null;

  x = 0;
  z = 0;
  y = 0;
  vx = 0;
  vz = 0;
  private kx = 0;
  private kz = 0;
  facing = 0;
  hp = 100;
  res = 100;
  alive = true;
  respawnT = 0;
  invulnT = 0;
  flashT = 0;
  status = new Status();

  mounted = false;
  mountCastT = -1;
  chargeCd = 0;
  chargeMax = 1;
  dodgeCd = 0;
  dodgeMax = 3;
  dash: Dash | null = null;
  attackCd = 0;
  attackAnim = 0;
  castAnim = 0;
  spinT = 0;
  skillCd = [0, 0, 0, 0];
  skillMax = [1, 1, 1, 1];
  racialCd = 0;
  racialMax = 1;
  buffs = new Map<string, number>();
  mountXpGain = 0;
  private walkPhase = 0;
  private gallop = 0;
  /** Automatischer Standardangriff auf das gewählte Ziel (Rechtsklick). */
  autoAttack = false;
  attacksDone = 0;
  turning = false;
  distanceWalked = 0;
  readonly aimPoint = new THREE.Vector3();
  private rangeWarnT = 0;
  private regenAcc = 0;
  /** Sekunden seit dem letzten erlittenen Treffer (für Regeneration außerhalb des Kampfes). */
  sinceHit = 99;
  private distAcc = 0;

  constructor(run: Run) {
    this.run = run;
    const sel = run.selection;
    this.cls = CLASSES[sel.cls];
    this.race = RACES[sel.race];
    this.mountDef = MOUNTS[sel.mount];
    this.mountLevel = mountLevelFromXp(run.save.data.mountXp[sel.mount] ?? 0).level;
    this.rig = createHero(this.race, this.cls);
    this.mountRig = createMount(this.mountDef);
    this.mats = makeMaterialsUnique(this.rig.root);
    // Held und Reittier leicht vergrößert – bessere Lesbarkeit im Getümmel
    this.root.scale.setScalar(1.12);
    this.heroHolder.add(this.rig.root);
    this.root.add(this.heroHolder, this.mountRig.root);
    this.mountRig.root.visible = false;
    if (this.cls.id === 'ranger') {
      const rig = createPet();
      this.pet = { rig, x: 0, z: 0, facing: 0, target: null, biteCd: 0, phase: 0 };
      run.scene.add(rig.root);
    }
    run.scene.add(this.root);
  }

  spawnAt(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.vx = this.vz = 0;
    this.hp = this.maxHp;
    this.res = this.cls.resource.startFull ? this.maxRes : this.maxRes * 0.3;
    this.alive = true;
    this.invulnT = 2;
    this.rig.root.rotation.set(0, 0, 0);
    this.rig.root.position.set(0, 0, 0);
    if (this.pet) {
      this.pet.x = x + 1.5;
      this.pet.z = z - 1;
    }
  }

  get maxHp(): number {
    return this.run.stats.maxHp;
  }
  get maxRes(): number {
    return this.run.stats.maxRes;
  }
  get invulnerable(): boolean {
    return this.invulnT > 0 || (this.dash?.invuln ?? false);
  }
  get untargetable(): boolean {
    return !this.alive;
  }
  get reflect(): number {
    return this.buffs.has('bulwark') ? 0.3 : 0;
  }
  get evadeChance(): number {
    if (!this.buffs.has('smoke')) return 0;
    for (const z of this.run.combat.zonesTagged('smoke')) if (dist(this.x, this.z, z.x, z.z) < z.r) return 0.5;
    return 0;
  }

  buff(id: string): boolean {
    return (this.buffs.get(id) ?? 0) > 0;
  }

  addBuff(id: string, dur: number): void {
    this.buffs.set(id, Math.max(this.buffs.get(id) ?? 0, dur));
  }

  damageTakenMul(): number {
    let m = 1;
    if (this.buff('bulwark')) m *= 0.5;
    if (this.buff('fortress')) m *= 0.4;
    return m;
  }

  /** Multiplikator auf allen ausgehenden Heldenschaden. */
  damageMul(): number {
    let m = 1;
    if (this.buff('crown')) m *= 1 + 0.25 * this.run.stats.racialPower;
    if (this.buff('cavalry')) m *= 1.25;
    if (this.race.id === 'orc') m *= 1 + 0.3 * (1 - this.hp / this.maxHp);
    return m;
  }

  attackSpeedMul(): number {
    let m = this.run.stats.attackSpeed;
    if (this.buff('pack')) m *= 1.2;
    if (this.buff('awaken')) m *= 1.25;
    return m;
  }

  heal(amount: number, silent = false): void {
    if (!this.alive || amount <= 0) return;
    const a = amount * this.run.stats.healing;
    this.hp = Math.min(this.maxHp, this.hp + a);
    if (!silent && a >= 1) this.run.ui.floatText(new THREE.Vector3(this.x, this.y + 2.4, this.z), `+${Math.round(a)}`, 'heal');
  }

  knockback(dx: number, dz: number, force: number): void {
    const d = Math.hypot(dx, dz) || 1;
    this.kx += (dx / d) * force;
    this.kz += (dz / d) * force;
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.respawnT = 7;
    this.dash = null;
    if (this.mounted) this.setMounted(false, true);
    this.mountCastT = -1;
    this.run.notify('Du bist gefallen – Wiederbelebung am Kristall in 7 s.', 'danger');
    this.run.audio.play('defeat', 0.4);
    this.run.deaths++;
  }

  private setMounted(on: boolean, silent = false): void {
    this.mounted = on;
    this.mountRig.root.visible = on;
    if (!silent) {
      this.run.audio.play('mount');
      this.run.effects.puff({ x: this.x, y: this.y + 0.8, z: this.z }, 0xe5e7eb, 10, 2, 0.7);
    }
    if (!on) {
      const legend = talentFlagRank(this.run.save.data.talents, 'riderLegend') > 0;
      if (legend || this.run.synergies.has('cavalry')) this.addBuff('cavalry', 4);
    }
  }

  /** Absitzen vor Angriffen/Fähigkeiten (WoW-typisch). */
  private ensureDismounted(): void {
    if (this.mounted) this.setMounted(false);
    this.mountCastT = -1;
  }

  canAct(): boolean {
    return this.alive && this.mountCastT < 0 && !this.dash && !this.status.disabled;
  }

  startDash(dx: number, dz: number, distance: number, duration: number, opts: Partial<Pick<Dash, 'hitRadius' | 'onHit' | 'invuln' | 'ghost'>> = {}): void {
    const d = Math.hypot(dx, dz) || 1;
    this.dash = {
      dx: dx / d,
      dz: dz / d,
      speed: distance / duration,
      t: duration,
      hitRadius: opts.hitRadius ?? 0,
      hits: new Set(),
      onHit: opts.onHit,
      invuln: opts.invuln ?? false,
      ghost: opts.ghost ?? false,
    };
    this.facing = Math.atan2(dx, dz);
  }

  update(dt: number, input: Input, target: Enemy | null, allowCombat: boolean): void {
    const run = this.run;
    const stats = run.stats;
    for (const [k, v] of this.buffs) {
      if (v - dt <= 0) this.buffs.delete(k);
      else this.buffs.set(k, v - dt);
    }
    if (this.invulnT > 0) this.invulnT -= dt;
    this.status.update(dt);
    for (let i = 0; i < 4; i++) if (this.skillCd[i] > 0) this.skillCd[i] -= dt;
    if (this.racialCd > 0) this.racialCd -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.chargeCd > 0) this.chargeCd -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
    if (this.castAnim > 0) this.castAnim -= dt;
    if (this.spinT > 0) this.spinT -= dt;

    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        const s = run.level.playerStart;
        this.spawnAt(s.x, s.z);
        run.notify('Du kehrst ins Gefecht zurück!', 'info');
        run.effects.ring(s.x, run.world.heightAt(s.x, s.z), s.z, 3, 0x22d3ee, 0.6);
      }
      this.animate(dt, 0);
      this.updatePet(dt);
      return;
    }

    // Regeneration (außerhalb des Kampfes deutlich schneller)
    this.sinceHit += dt;
    this.regenAcc += dt;
    if (this.regenAcc >= 0.25) {
      const r = this.regenAcc;
      this.regenAcc = 0;
      const ooc = this.sinceHit > 4 ? 1 + this.maxHp * 0.025 : 0;
      if (!run.flags.has('noRegen')) this.hp = Math.min(this.maxHp, this.hp + (stats.hpRegen + ooc) * r * stats.healing);
      this.res = Math.min(this.maxRes, this.res + stats.resRegen * r);
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      setFlash(this.mats, this.flashT > 0 ? this.flashT / 0.15 : 0, 0xff4444);
    }

    // Aufsitzen läuft
    if (this.mountCastT >= 0) {
      this.mountCastT -= dt;
      if (this.mountCastT < 0) this.setMounted(true);
    }

    // ── Drehen & Bewegung (MMORPG-Steuerung) ────────────────
    // RMB gehalten: Figur blickt in Kamerarichtung, A/D laufen seitwärts.
    // Sonst: A/D drehen die Figur. Beide Maustasten: vorwärts laufen.
    const mouseLook = input.rightDown;
    const busy = this.mountCastT >= 0 || this.status.disabled;
    let turn = 0;
    if (!mouseLook) {
      if (input.held('left')) turn += 1;
      if (input.held('right')) turn -= 1;
    }
    this.turning = turn !== 0;
    if (!this.dash) {
      if (mouseLook) this.facing = run.camera.yaw;
      else if (turn && !busy) this.facing += turn * (this.mounted ? 2.4 : 3.1) * dt;
    }
    let fwd = 0;
    let strafe = 0;
    if (input.held('up') || (input.leftDown && input.rightDown)) fwd += 1;
    if (input.held('down')) fwd -= 1;
    if (mouseLook) {
      if (input.held('right')) strafe += 1;
      if (input.held('left')) strafe -= 1;
    }
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    let mx = fx * fwd + -fz * strafe;
    let mz = fz * fwd + fx * strafe;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) ((mx /= ml), (mz /= ml));
    if (ml > 0 && this.mountCastT >= 0) {
      this.mountCastT = -1;
      run.notify('Aufsitzen abgebrochen', 'info');
    }

    let speed = stats.moveSpeed * this.status.speedMul();
    if (fwd < 0 && strafe === 0) speed *= 0.6; // rückwärts langsamer
    if (run.challengeActive && run.level.challenge.id === 'blizzard') speed *= 0.75;
    if (this.mounted) speed *= this.mountDef.speed * stats.mountSpeed * (1 + mountLevelBonus(this.mountLevel).speed);
    if (busy) speed = 0;
    const accel = this.mounted ? 6 : 16;

    const prevX = this.x;
    const prevZ = this.z;
    if (this.dash) {
      const d = this.dash;
      const step = d.speed * dt;
      this.x += d.dx * step;
      this.z += d.dz * step;
      d.t -= dt;
      this.vx = d.dx * d.speed * 0.3;
      this.vz = d.dz * d.speed * 0.3;
      if (d.hitRadius > 0 && d.onHit) {
        for (const e of run.enemies.inRadius(this.x, this.z, d.hitRadius)) {
          if (d.hits.has(e.id)) continue;
          d.hits.add(e.id);
          d.onHit(e);
        }
      }
      if (run.world.resolve(this, this.mounted ? 0.8 : 0.5)) d.t = Math.min(d.t, 0.02);
      if (d.t <= 0) this.dash = null;
    } else {
      this.vx = damp(this.vx, mx * speed, accel, dt);
      this.vz = damp(this.vz, mz * speed, accel, dt);
      this.x += (this.vx + this.kx) * dt;
      this.z += (this.vz + this.kz) * dt;
      this.kx = damp(this.kx, 0, 6, dt);
      this.kz = damp(this.kz, 0, 6, dt);
      run.world.resolve(this, this.mounted ? 0.8 : 0.5);
    }
    const moved = dist(prevX, prevZ, this.x, this.z);
    this.distanceWalked += moved;
    if (this.mounted) {
      this.distAcc += moved;
      if (this.distAcc > 10) {
        this.mountXpGain += 2;
        this.distAcc = 0;
      }
    }
    this.y = run.world.heightAt(this.x, this.z);

    // ── Ziel & Aktionen ────────────────────────────────────
    if (target && !target.alive) target = null;
    const soft = target ?? this.softTarget();
    const aim = this.aimPoint;
    if (soft) aim.set(soft.x, run.world.heightAt(soft.x, soft.z), soft.z);
    else aim.set(this.x + fx * 8, this.y, this.z + fz * 8);
    if (allowCombat) {
      if (input.pressed('dodge')) this.tryDodgeOrCharge(mx, mz);
      if (input.pressed('racial')) this.tryRacial(aim);
      for (let i = 0; i < 4; i++) if (input.pressed(`skill${i + 1}` as 'skill1')) this.trySkill(i, aim, soft);
      if (this.autoAttack && target) this.tryAttack(target, mouseLook);
    }
    if (!target) this.autoAttack = false;

    // Im Kampf blickt die Figur automatisch zum Ziel (außer bei Maussteuerung)
    if (!this.dash && !mouseLook && !this.turning && target && this.autoAttack && ml === 0) {
      this.facing = dampAngle(this.facing, Math.atan2(target.x - this.x, target.z - this.z), 10, dt);
    }

    this.animate(dt, Math.hypot(this.vx, this.vz));
    this.updatePet(dt);
  }

  /** Nächster Gegner im Blickfeld (für Fähigkeiten ohne gewähltes Ziel). */
  softTarget(): Enemy | null {
    let best: Enemy | null = null;
    let bd = 22 * 22;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    for (const e of this.run.enemies.list) {
      if (!e.alive) continue;
      const dx = e.x - this.x;
      const dz = e.z - this.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      const d = Math.sqrt(d2) || 1;
      if ((dx * fx + dz * fz) / d < 0.35 && d > 3) continue;
      bd = d2;
      best = e;
    }
    return best;
  }

  /* ── Aktionen ─────────────────────────────────────────────── */
  toggleMount(): void {
    if (!this.alive || this.dash) return;
    if (this.mounted) {
      this.setMounted(false);
      return;
    }
    if (this.mountCastT >= 0) return;
    const quick = talentFlagRank(this.run.save.data.talents, 'quickMount') > 0;
    if (quick) this.setMounted(true);
    else {
      this.mountCastT = 0.6;
      this.vx = this.vz = 0;
    }
  }

  private tryDodgeOrCharge(mx: number, mz: number): void {
    if (!this.alive || this.dash || this.mountCastT >= 0 || this.status.disabled) return;
    const run = this.run;
    if (this.mounted) {
      if (this.chargeCd > 0) return;
      const fast = run.flags.has('fastCharge') ? 0.7 : 1;
      const cdr = 1 - 0.15 * talentFlagRank(run.save.data.talents, 'chargeCdr');
      this.chargeMax = this.mountDef.chargeCooldown * fast * cdr;
      this.chargeCd = this.chargeMax;
      const dmg = run.stats.power * this.mountDef.chargeDamage * run.stats.mountPower * (1 + mountLevelBonus(this.mountLevel).power) * this.damageMul();
      const stun = run.flags.has('chargeStun') || talentFlagRank(run.save.data.talents, 'riderLegend') > 0;
      const fx = Math.sin(this.facing);
      const fz = Math.cos(this.facing);
      const lizard = this.mountDef.id === 'lizard';
      let lastTrail = 0;
      run.audio.play('charge');
      this.startDash(fx, fz, this.mountDef.chargeDistance, 0.45, {
        hitRadius: 1.9,
        onHit: (e) => {
          run.combat.damageEnemy(e, dmg, { source: 'mount', element: 'physical' });
          if (e.alive && !e.def.boss) {
            e.x += -fz * (Math.random() < 0.5 ? 1.6 : -1.6);
            e.z += fx * (Math.random() < 0.5 ? 1.6 : -1.6);
          }
          if (stun) e.status.stunT = Math.max(e.status.stunT, 1.2);
          if (this.mountDef.id === 'wolf') {
            e.status.bleedDps = Math.max(e.status.bleedDps, run.stats.power * 0.7);
            e.status.bleedT = 4;
          }
          this.mountXpGain += 4;
          run.camera.shake(0.12, 0.1);
        },
      });
      if (lizard) {
        const start = { x: this.x, z: this.z };
        for (let i = 1; i <= 6; i++) {
          const t = (i / 6) * this.mountDef.chargeDistance;
          const zx = start.x + fx * t;
          const zz = start.z + fz * t;
          if (t - lastTrail < 1) continue;
          lastTrail = t;
          const remove = run.effects.zone(zx, run.world.heightAt(zx, zz), zz, 1.4, 0xf97316, 3, 0.5);
          run.combat.addZone({
            x: zx, z: zz, r: 1.4, dur: 3, interval: 0.5, tag: 'fire', removeVisual: remove,
            onTick: (inside) => {
              for (const e of inside) {
                e.status.burnDps = Math.max(e.status.burnDps, run.stats.power * 0.5);
                e.status.burnT = 2;
              }
            },
          });
        }
      }
      return;
    }
    if (this.dodgeCd > 0) return;
    this.dodgeMax = 3 * (1 - run.stats.dodgeCdr);
    this.dodgeCd = this.dodgeMax;
    let dx = mx;
    let dz = mz;
    if (Math.hypot(dx, dz) < 0.1) {
      dx = Math.sin(this.facing);
      dz = Math.cos(this.facing);
    }
    this.startDash(dx, dz, 5.5, 0.3, { invuln: true });
    run.audio.play('swing', 0.6);
    run.effects.puff({ x: this.x, y: this.y + 0.3, z: this.z }, 0xe5e7eb, 6, 1.5, 0.5);
  }

  private tryAttack(target: Enemy, mouseLook: boolean): void {
    if (!this.canAct() && !this.mounted) return;
    if (this.attackCd > 0 || this.dash || this.mountCastT >= 0) return;
    const run = this.run;
    const atk = this.cls.attack;
    let dx = target.x - this.x;
    let dz = target.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const reach = atk.kind === 'melee' ? atk.range + target.radius + 0.3 : atk.range + target.radius;
    if (this.rangeWarnT > 0) this.rangeWarnT -= 0.016;
    if (d > reach) {
      if (this.rangeWarnT <= 0 && d < reach + 25) {
        this.rangeWarnT = 2.5;
        run.notify('Ziel außer Reichweite', 'info');
      }
      return;
    }
    dx /= d;
    dz /= d;
    // Bei Maussteuerung muss man das Ziel ansehen (wie in MMORPGs)
    if (mouseLook && d > 1.2 && dx * Math.sin(this.facing) + dz * Math.cos(this.facing) < 0.2) {
      if (this.rangeWarnT <= 0) {
        this.rangeWarnT = 2.5;
        run.notify('Du musst dein Ziel ansehen', 'info');
      }
      return;
    }
    this.ensureDismounted();
    this.attackCd = atk.interval / this.attackSpeedMul();
    this.attackAnim = 0.28;
    this.attacksDone++;
    if (!mouseLook) this.facing = Math.atan2(dx, dz);
    const forceCrit = this.buff('nextCrit');
    if (forceCrit) this.buffs.delete('nextCrit');
    const dmg = run.stats.power * atk.damageMul * this.damageMul();
    if (atk.kind === 'melee') {
      run.audio.play('swing', 0.5);
      let hits = 0;
      const maxHits = this.cls.id === 'rogue' ? 2 : 99;
      const cands = run.enemies.inRadius(this.x, this.z, atk.range).slice().sort((a, b) => dist2(this.x, this.z, a.x, a.z) - dist2(this.x, this.z, b.x, b.z));
      for (const e of cands) {
        const ex = e.x - this.x;
        const ez = e.z - this.z;
        const ed = Math.hypot(ex, ez);
        if (ed > 0.6) {
          const dot = (ex * dx + ez * dz) / ed;
          if (dot < Math.cos(atk.arc / 2)) continue;
        }
        run.combat.damageEnemy(e, dmg, { source: 'hero', element: atk.element, forceCrit, critMul: forceCrit ? 2 : 1 });
        this.res = Math.min(this.maxRes, this.res + this.cls.resource.onHit);
        if (++hits >= maxHits) break;
      }
      const sx = this.x + dx * 1.4;
      const sz = this.z + dz * 1.4;
      run.effects.ring(sx, this.y + 0.8, sz, atk.range * 0.7, this.cls.id === 'rogue' ? 0xc4b5fd : 0xe2e8f0, 0.18, 0.5);
    } else {
      const tip = new THREE.Vector3();
      this.rig.weaponTip.getWorldPosition(tip);
      const mage = this.cls.id === 'mage';
      run.audio.play(mage ? 'fire' : 'arrow', mage ? 0.35 : 0.6);
      run.combat.heroShot(mage ? 'bolt' : 'arrow', mage ? 0xff8a3d : 0xf8fafc, this.x + dx * 0.6, Math.max(this.y + 1, tip.y), this.z + dz * 0.6, dx, dz, atk.projectileSpeed, atk.range + 4, dmg, { source: 'hero', element: atk.element, forceCrit, critMul: forceCrit ? 2 : 1 }, {
        target,
        radius: 0.7,
        trail: mage ? 0xff8a3d : 0,
        onHit: (_x, _z, e) => {
          if (e) {
            run.combat.damageEnemy(e, dmg, { source: 'hero', element: atk.element, forceCrit, critMul: forceCrit ? 2 : 1 });
            this.res = Math.min(this.maxRes, this.res + this.cls.resource.onHit);
            run.effects.burst({ x: e.x, y: e.y + 1, z: e.z }, mage ? 0xff8a3d : 0xe5e7eb, 6, 3, 0.3);
          }
        },
      });
    }
  }

  private trySkill(i: number, aim: THREE.Vector3, aimEnemy: Enemy | null): void {
    const run = this.run;
    if (!this.alive || this.dash || this.status.disabled) return;
    const skill = this.cls.skills[i];
    if (!this.skillUnlocked(i)) {
      run.notify(`${skill.name} lernst du ab Kontostufe ${SKILL_UNLOCK_LEVEL[i]}`, 'info');
      run.audio.play('error', 0.4);
      return;
    }
    if (this.skillCd[i] > 0) {
      run.audio.play('error', 0.4);
      return;
    }
    if (this.res < skill.cost) {
      run.notify(`Nicht genug ${this.cls.resource.name}`, 'info');
      run.audio.play('error', 0.4);
      return;
    }
    this.ensureDismounted();
    this.facing = Math.atan2(aim.x - this.x, aim.z - this.z);
    const ok = castSkill(run, this, skill.id, aim, aimEnemy);
    if (!ok) return;
    const signature = i === 3 && talentFlagRank(run.save.data.talents, 'signature') > 0;
    let cd = skill.cooldown * (1 - run.stats.cdr) * (signature ? 0.8 : 1);
    if (skill.id === 'execute' && this.buff('executeReset')) {
      cd = 0.4;
      this.buffs.delete('executeReset');
    }
    this.skillMax[i] = Math.max(0.4, cd);
    this.skillCd[i] = this.skillMax[i];
    this.res -= skill.cost;
    if (run.synergies.has('aetherflow')) this.res = Math.min(this.maxRes, this.res + skill.cost * 0.25);
    this.castAnim = 0.35;
  }

  skillUnlocked(i: number): boolean {
    return this.run.accountLevel >= SKILL_UNLOCK_LEVEL[i];
  }

  get racialUnlocked(): boolean {
    return this.run.accountLevel >= RACIAL_UNLOCK_LEVEL;
  }

  private tryRacial(aim: THREE.Vector3): void {
    const run = this.run;
    if (!this.racialUnlocked) {
      run.notify(`${this.race.activeName} lernst du ab Kontostufe ${RACIAL_UNLOCK_LEVEL}`, 'info');
      return;
    }
    if (!this.alive || this.racialCd > 0 || this.status.disabled && this.race.id !== 'human') {
      if (this.racialCd > 0) run.audio.play('error', 0.4);
      return;
    }
    this.ensureDismounted();
    castRacial(run, this, aim);
    this.racialMax = this.race.cooldown * (1 - run.stats.racialCdr);
    this.racialCd = this.racialMax;
    this.castAnim = 0.5;
    if (talentFlagRank(run.save.data.talents, 'racialAwaken') > 0) this.addBuff('awaken', 5);
  }

  /* ── Begleiter ────────────────────────────────────────────── */
  private updatePet(dt: number): void {
    const pet = this.pet;
    if (!pet) return;
    const run = this.run;
    if (pet.biteCd > 0) pet.biteCd -= dt;
    if (!pet.target || !pet.target.alive || dist(pet.target.x, pet.target.z, this.x, this.z) > 13) {
      pet.target = this.alive ? run.enemies.nearest(this.x, this.z, 10) : null;
    }
    let tx: number;
    let tz: number;
    if (pet.target) {
      tx = pet.target.x;
      tz = pet.target.z;
    } else {
      tx = this.x - Math.sin(this.facing) * 1.6 + Math.cos(this.facing) * 1.4;
      tz = this.z - Math.cos(this.facing) * 1.6 - Math.sin(this.facing) * 1.4;
    }
    const dx = tx - pet.x;
    const dz = tz - pet.z;
    const d = Math.hypot(dx, dz);
    const stop = pet.target ? pet.target.radius + 0.9 : 0.4;
    const speed = d > 12 ? 16 : 10;
    if (d > stop) {
      const step = Math.min(d - stop, speed * dt);
      pet.x += (dx / d) * step;
      pet.z += (dz / d) * step;
      pet.phase += step * 2.5;
      pet.facing = dampAngle(pet.facing, Math.atan2(dx, dz), 12, dt);
    }
    const p = { x: pet.x, z: pet.z };
    run.world.resolve(p, 0.4);
    pet.x = p.x;
    pet.z = p.z;
    if (pet.target && d <= stop + 0.3 && pet.biteCd <= 0) {
      const frenzy = this.buff('pack');
      pet.biteCd = frenzy ? 0.5 : 1.0;
      const dmg = run.stats.power * 0.55 * run.stats.petPower * (frenzy ? 1.5 : 1);
      run.combat.damageEnemy(pet.target, dmg, { source: 'pet', element: 'nature' });
      run.effects.burst({ x: pet.target.x, y: pet.target.y + 0.8, z: pet.target.z }, 0x86efac, 5, 3, 0.3);
    }
    const r = pet.rig;
    r.root.position.set(pet.x, run.world.heightAt(pet.x, pet.z), pet.z);
    r.root.rotation.y = pet.facing;
    const sw = Math.sin(pet.phase);
    r.legs.forEach((l, i) => (l.rotation.x = (i % 2 === 0 ? sw : -sw) * 0.7));
    r.body.position.y = 0.55 + Math.abs(sw) * 0.06 + (pet.biteCd > 0.75 ? 0.1 : 0);
  }

  /* ── Animation ────────────────────────────────────────────── */
  private animate(dt: number, speed: number): void {
    const r = this.rig;
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.facing;
    if (!this.alive) {
      r.root.rotation.x = damp(r.root.rotation.x, -Math.PI / 2, 8, dt);
      r.root.position.y = 0.2;
      this.heroHolder.position.y = 0;
      return;
    }
    r.root.rotation.x = 0;
    r.root.position.y = 0;

    if (this.mounted) {
      const m = this.mountRig;
      this.gallop += dt * clamp(speed, 0, 20) * 1.1;
      const g = Math.sin(this.gallop);
      m.legs.forEach((l, i) => (l.rotation.x = (i < 2 ? g : -g) * clamp(speed / 6, 0, 1) * 0.8));
      m.body.rotation.x = Math.cos(this.gallop) * 0.05 * clamp(speed / 6, 0, 1);
      m.head.rotation.x = Math.sin(this.gallop + 1) * 0.08;
      m.tail.rotation.x = 0.2 + Math.sin(performance.now() * 0.006) * 0.15;
      const saddle = new THREE.Vector3();
      m.saddle.getWorldPosition(saddle);
      this.root.worldToLocal(saddle);
      this.heroHolder.position.set(saddle.x, saddle.y - r.hipHeight + 0.05, saddle.z);
      r.legL.rotation.set(-1.25, 0, -0.35);
      r.legR.rotation.set(-1.25, 0, 0.35);
      r.armL.rotation.x = -0.6;
      r.armR.rotation.x = -0.6 + (this.dash ? -0.8 : 0);
      r.torso.rotation.x = this.dash ? 0.25 : 0.05;
      if (r.cape) r.cape.rotation.x = 0.3 + clamp(speed / 12, 0, 0.6);
      return;
    }
    this.heroHolder.position.set(0, 0, 0);

    if (this.mountCastT >= 0) {
      r.armL.rotation.x = -1.4;
      r.armR.rotation.x = -1.4;
      r.legL.rotation.x = 0;
      r.legR.rotation.x = 0;
      return;
    }

    this.walkPhase += dt * speed * 1.6;
    const moving = speed > 0.3;
    const s = moving ? Math.sin(this.walkPhase) : 0;
    r.legL.rotation.set(s * 0.7, 0, 0);
    r.legR.rotation.set(-s * 0.7, 0, 0);
    r.body.position.y = moving ? Math.abs(Math.cos(this.walkPhase)) * 0.06 : Math.sin(performance.now() * 0.002) * 0.01;
    r.armL.rotation.x = -s * 0.5;
    r.armR.rotation.x = s * 0.5;
    r.armR.rotation.z = 0;
    r.torso.rotation.set(0, 0, 0);

    if (this.dash && this.dash.invuln && !this.dash.ghost) {
      r.body.rotation.x += dt * 22;
    } else {
      r.body.rotation.x = 0;
    }
    if (this.spinT > 0) r.body.rotation.y += dt * 30;
    else r.body.rotation.y = 0;

    if (this.attackAnim > 0) {
      const t = 1 - this.attackAnim / 0.28;
      if (this.cls.attack.kind === 'melee') {
        r.armR.rotation.x = -2.6 + t * 3.2;
        r.armR.rotation.z = 0.3;
        r.torso.rotation.y = -0.5 + t * 0.9;
        if (this.cls.id === 'rogue') r.armL.rotation.x = -2.2 + Math.min(1, t * 1.5) * 2.8;
      } else if (this.cls.id === 'ranger') {
        r.armL.rotation.x = -1.55;
        r.armR.rotation.x = -1.4 + t * 0.5;
      } else {
        r.armR.rotation.x = -1.6 + t * 0.4;
      }
    } else if (this.castAnim > 0) {
      r.armL.rotation.x = -2.4;
      r.armR.rotation.x = -2.4;
    }
    if (r.cape) r.cape.rotation.x = 0.1 + clamp(speed / 10, 0, 0.5) + Math.sin(performance.now() * 0.004) * 0.04;
  }

  dispose(): void {
    this.run.scene.remove(this.root);
    if (this.pet) this.run.scene.remove(this.pet.rig.root);
  }
}
