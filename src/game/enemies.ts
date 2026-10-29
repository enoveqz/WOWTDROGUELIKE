import * as THREE from 'three';
import { ELITE_AFFIXES, ENEMIES, type EliteAffix, type EnemyDef, type EnemyId } from '../config/enemies.ts';
import { enemyHpFor } from '../config/waves.ts';
import { dist, dist2, type Vec2 } from '../core/math.ts';
import { makeMaterialsUnique, setFlash } from '../world/assets.ts';
import { HealthBar } from '../world/healthbar.ts';
import { createEnemy, type EnemyRig } from '../world/models.ts';
import { Status } from './status.ts';
import type { Run } from './run.ts';

type EnemyState = 'march' | 'fight' | 'siege' | 'dead';

export class Enemy {
  def!: EnemyDef;
  rig: EnemyRig;
  mats: THREE.MeshStandardMaterial[];
  bar: HealthBar;
  x = 0;
  z = 0;
  y = 0;
  facing = 0;
  hp = 1;
  maxHp = 1;
  armor = 0;
  speed = 1;
  radius = 0.6;
  path: Vec2[] = [];
  pathIndex = 0;
  wp = 1;
  /** Zurückgelegte Strecke entlang der Route – Basis für Turm-Zielwahl. */
  progress = 0;
  state: EnemyState = 'march';
  attackCd = 0;
  attackAnim = 0;
  flashT = 0;
  walkPhase = 0;
  deathT = 0;
  status = new Status();
  affix: EliteAffix | null = null;
  alive = true;
  gold = 0;
  speedAura = 1;
  /** Boss-Zustand */
  bossCds = new Map<string, number>();
  enraged = false;
  bossCast: { kind: string; t: number; x: number; z: number; dir: number } | null = null;
  chargeVel: { x: number; z: number; t: number } | null = null;
  healCd = 3;
  hitBy = new Set<number>();
  id = 0;

  constructor(def: EnemyDef, tintColor: number) {
    this.rig = createEnemy(def, tintColor);
    this.mats = makeMaterialsUnique(this.rig.root);
    this.bar = new HealthBar(def.boss ? 3.2 : def.elite ? 1.6 : 1.1, def.boss ? 0xf43f5e : def.elite ? 0xf59e0b : 0xef4444, def.boss ? 0.22 : 0.14);
    this.rig.root.add(this.bar.group);
    this.bar.group.position.y = this.rig.barHeight / this.rig.root.scale.x + 0.3;
  }

  get isBoss(): boolean {
    return this.def.boss;
  }
}

let nextId = 1;

export class EnemyManager {
  readonly list: Enemy[] = [];
  private pools = new Map<EnemyId, Enemy[]>();
  private run: Run;
  private tmpV = new THREE.Vector3();
  readonly cap = 75;

  constructor(run: Run) {
    this.run = run;
  }

  get aliveCount(): number {
    let n = 0;
    for (const e of this.list) if (e.alive) n++;
    return n;
  }

  spawn(id: EnemyId, pathIndex: number, waveIndex: number, at?: { x: number; z: number; wp: number; progress: number }): Enemy {
    const def = ENEMIES[id];
    const run = this.run;
    let e = this.pools.get(id)?.pop();
    if (!e) e = new Enemy(def, run.world.biome.enemyTint);
    e.def = def;
    e.id = nextId++;
    e.path = run.level.paths[pathIndex];
    e.pathIndex = pathIndex;
    const rng = run.rng;
    // Elite-Varianten sorgen für Abwechslung zwischen Runs
    e.affix = null;
    if (!def.boss && !def.elite && rng.chance(Math.min(0.12, 0.02 + waveIndex * 0.012))) e.affix = rng.pick(ELITE_AFFIXES);
    const extraHp = run.event.enemyHpMul * (run.flags.has('goldenCompass') ? 1.12 : 1) * (e.affix?.hpMul ?? 1);
    e.maxHp = enemyHpFor(def.hp, run.level, def.boss ? 0 : waveIndex, extraHp);
    e.hp = e.maxHp;
    e.armor = Math.min(0.7, def.armor + (e.affix?.armorAdd ?? 0));
    e.speed = def.speed * run.event.enemySpeedMul * (e.affix?.speedMul ?? 1);
    e.radius = def.radius * (e.affix?.scaleMul ?? 1);
    e.gold = Math.round(def.gold * (e.affix ? 1.8 : 1));
    e.status.reset();
    e.state = 'march';
    e.alive = true;
    e.deathT = 0;
    e.attackCd = 1;
    e.attackAnim = 0;
    e.flashT = 0;
    e.enraged = false;
    e.bossCast = null;
    e.chargeVel = null;
    e.bossCds.clear();
    e.healCd = 3;
    e.hitBy.clear();
    if (def.abilities) def.abilities.forEach((a, i) => e!.bossCds.set(a, 5 + i * 3));
    if (at) {
      e.x = at.x;
      e.z = at.z;
      e.wp = Math.min(at.wp, e.path.length);
      e.progress = at.progress;
      if (e.wp >= e.path.length) e.state = 'siege';
    } else {
      const p0 = e.path[0];
      const p1 = e.path[1];
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1;
      const lateral = rng.range(-1.2, 1.2);
      e.x = p0.x + (-(p1.z - p0.z) / len) * lateral;
      e.z = p0.z + ((p1.x - p0.x) / len) * lateral;
      e.wp = 1;
      e.progress = 0;
    }
    const s = def.scale * (e.affix?.scaleMul ?? 1);
    e.rig.root.scale.setScalar(s);
    e.rig.root.rotation.set(0, 0, 0);
    e.rig.root.visible = true;
    e.rig.body.rotation.set(0, 0, 0);
    e.bar.set(1);
    e.bar.group.visible = def.boss || def.elite || !!e.affix;
    const look = e.path[Math.min(e.wp, e.path.length - 1)];
    e.facing = Math.atan2(look.x - e.x, look.z - e.z);
    e.y = run.world.heightAt(e.x, e.z);
    e.rig.root.position.set(e.x, e.y, e.z);
    setFlash(e.mats, 0);
    if (e.affix || def.elite) for (const m of e.mats) if (m.userData.baseEmissive === 0) m.emissiveIntensity = 0;
    run.scene.add(e.rig.root);
    this.list.push(e);
    run.effects.puff({ x: e.x, y: e.y + 1, z: e.z }, 0x9333ea, 6);
    if (def.boss) run.onBossSpawn(e);
    return e;
  }

  /** Gegner, die in einem Radius liegen (wiederverwendetes Ergebnis-Array). */
  private scratch: Enemy[] = [];
  inRadius(x: number, z: number, r: number): Enemy[] {
    const out = this.scratch;
    out.length = 0;
    for (const e of this.list) {
      if (!e.alive) continue;
      const rr = r + e.radius;
      if (dist2(x, z, e.x, e.z) <= rr * rr) out.push(e);
    }
    return out;
  }

  nearest(x: number, z: number, maxDist: number, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxDist * maxDist;
    for (const e of this.list) {
      if (!e.alive || exclude?.has(e.id)) continue;
      const d = dist2(x, z, e.x, e.z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Gegner mit dem größten Fortschritt Richtung Kristall in Reichweite. */
  furthestInRange(x: number, z: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bp = -1;
    const r2 = range * range;
    for (const e of this.list) {
      if (!e.alive) continue;
      if (dist2(x, z, e.x, e.z) > r2) continue;
      const p = e.progress + (e.state === 'siege' ? 1000 : 0);
      if (p > bp) {
        bp = p;
        best = e;
      }
    }
    return best;
  }

  update(dt: number): void {
    const run = this.run;
    const elites = this.list.filter((e) => e.alive && e.def.id === 'elite');
    const blizzard = run.challengeActive && run.level.challenge.id === 'blizzard' ? 1.15 : 1;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) {
        this.animateDeath(e, dt);
        if (e.deathT > 1.2) {
          run.scene.remove(e.rig.root);
          e.rig.root.visible = false;
          this.list.splice(i, 1);
          let pool = this.pools.get(e.def.id);
          if (!pool) this.pools.set(e.def.id, (pool = []));
          pool.push(e);
        }
        continue;
      }

      // Statuseffekte & DoTs
      const dot = e.status.update(dt);
      if (dot > 0) {
        const burnBonus = e.status.burnT > 0 && run.synergies.has('wildfire') ? 1.6 : 1;
        run.combat.damageEnemy(e, dot * burnBonus, { source: 'hero', element: 'fire', canCrit: false, dot: true });
        if (!e.alive) continue;
      }
      if (e.flashT > 0) {
        e.flashT -= dt;
        setFlash(e.mats, e.flashT > 0 ? e.flashT / 0.12 : 0);
      }

      // Auren
      e.speedAura = 1;
      for (const el of elites) if (el !== e && dist2(el.x, el.z, e.x, e.z) < 36) e.speedAura = 1.15;

      if (e.def.boss) this.updateBoss(e, dt);

      const speed = e.speed * e.status.speedMul() * e.speedAura * blizzard * (e.enraged ? 1.4 : 1);
      if (e.attackCd > 0) e.attackCd -= dt;
      if (e.attackAnim > 0) e.attackAnim -= dt;

      if (e.chargeVel) {
        this.moveBossCharge(e, dt);
      } else if (!e.status.disabled && !e.bossCast) {
        this.think(e, dt, speed);
      }

      // Trennung (keine übereinanderstehenden Gegner)
      for (let j = 0; j < i; j++) {
        const o = this.list[j];
        if (!o.alive) continue;
        const dx = e.x - o.x;
        const dz = e.z - o.z;
        const min = (e.radius + o.radius) * 0.8;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5;
          const wE = o.def.boss ? 1 : e.def.boss ? 0 : 0.5;
          e.x += dx * push * wE;
          e.z += dz * push * wE;
          o.x -= dx * push * (1 - wE);
          o.z -= dz * push * (1 - wE);
        }
      }
      if (e.state === 'fight') run.world.resolve(e, e.radius * 0.7);

      // Visuals
      e.y = run.world.heightAt(e.x, e.z);
      e.rig.root.position.set(e.x, e.y, e.z);
      e.rig.root.rotation.y = e.facing;
      this.animate(e, speed);
      if (!e.def.boss) e.bar.set(e.hp / e.maxHp);
    }
  }

  private think(e: Enemy, dt: number, speed: number): void {
    const run = this.run;
    const p = run.player;
    const def = e.def;
    const dToPlayer = p.alive ? dist(e.x, e.z, p.x, p.z) : Infinity;
    const crystal = run.level.crystal;
    const dToCrystal = dist(e.x, e.z, crystal.x, crystal.z) - 2.6;

    // Zustandswechsel
    const taunted = e.status.tauntT > 0 && p.alive;
    if (e.state !== 'fight' && p.alive && (taunted || (dToPlayer < def.aggro && !p.untargetable))) {
      if (e.state !== 'siege' || dToPlayer < def.range + 2) e.state = 'fight';
    } else if (e.state === 'fight' && (!p.alive || p.untargetable || (!taunted && dToPlayer > def.aggro + 5))) {
      e.state = e.wp >= e.path.length ? 'siege' : 'march';
    }
    // Leine: nicht zu weit von der Route abweichen
    if (e.state === 'fight' && !taunted && !def.boss) {
      const anchor = e.path[Math.min(e.wp, e.path.length - 1)];
      const prev = e.path[Math.max(0, e.wp - 1)];
      const da = Math.min(dist(e.x, e.z, anchor.x, anchor.z), dist(e.x, e.z, prev.x, prev.z));
      if (da > 14) e.state = e.wp >= e.path.length ? 'siege' : 'march';
    }

    let tx = e.x;
    let tz = e.z;
    let stopDist = 0;
    let attackTarget: 'player' | 'crystal' | null = null;

    if (e.state === 'fight') {
      tx = p.x;
      tz = p.z;
      stopDist = def.ranged ? def.range * 0.85 : def.range + e.radius * 0.4;
      if (dToPlayer <= def.range + e.radius * 0.6 + 0.4) attackTarget = 'player';
    } else if (e.state === 'march' && e.wp >= e.path.length) {
      e.state = 'siege';
    } else if (e.state === 'march') {
      const w = e.path[e.wp];
      tx = w.x;
      tz = w.z;
      if (dist(e.x, e.z, w.x, w.z) < 0.8) {
        e.wp++;
        if (e.wp >= e.path.length) e.state = 'siege';
      }
    }
    if (e.state === 'siege') {
      tx = crystal.x;
      tz = crystal.z;
      stopDist = def.range + 2.6;
      if (dToCrystal <= def.range + e.radius * 0.5) attackTarget = 'crystal';
      else stopDist = def.ranged ? def.range * 0.9 + 2.6 : def.range + 2.6;
    }

    const dx = tx - e.x;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001) e.facing = turnToward(e.facing, Math.atan2(dx, dz), dt * 8);
    if (d > stopDist && speed > 0) {
      const step = Math.min(d - stopDist, speed * dt);
      e.x += (dx / d) * step;
      e.z += (dz / d) * step;
      if (e.state === 'march') e.progress += step;
      e.walkPhase += step * 2.2;
    }

    if (attackTarget && e.attackCd <= 0 && !e.status.disabled) {
      e.attackCd = 1 / (def.attackRate * (e.enraged ? 1.5 : 1));
      e.attackAnim = 0.35;
      const dmg = def.damage * (1 + run.waveIndexForScaling * 0.04) * (e.affix ? 1.25 : 1);
      if (def.ranged) {
        run.combat.enemyShot(e, attackTarget, dmg);
      } else if (attackTarget === 'player') {
        run.combat.damagePlayer(dmg, e);
      } else {
        // Der Kristall ist durch ein Aetherschild geschützt: Belagerungsschaden −25 %, Elite −45 %
        run.combat.damageCrystal(dmg * (def.elite ? 0.55 : 0.75), e);
      }
    }

    // Fluchwirker heilen Verbündete
    if (def.id === 'shaman') {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        e.healCd = 3;
        let healed = 0;
        for (const o of this.inRadius(e.x, e.z, 7)) {
          if (o === e || o.hp >= o.maxHp) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
          this.tmpV.set(o.x, o.y + 1.5, o.z);
          run.effects.beam(new THREE.Vector3(e.x, e.y + 2, e.z), this.tmpV.clone(), 0xa855f7, 0.08, 0.3);
          if (++healed >= 3) break;
        }
      }
    }
  }

  /* ── Bosse ───────────────────────────────────────────────── */
  private updateBoss(e: Enemy, dt: number): void {
    const run = this.run;
    const p = run.player;
    for (const [k, v] of e.bossCds) e.bossCds.set(k, v - dt);
    if (!e.enraged && e.def.abilities?.includes('enrage') && e.hp < e.maxHp * 0.3) {
      e.enraged = true;
      run.notify(`${e.def.name} gerät in Raserei!`, 'danger');
      run.audio.play('bossRoar');
      run.camera.shake(0.6, 0.6);
      for (const m of e.mats) m.userData.baseEmissive = 0x7f1d1d;
      setFlash(e.mats, 0);
    }
    if (e.bossCast) {
      e.bossCast.t -= dt;
      if (e.bossCast.t <= 0) {
        this.resolveBossCast(e);
        e.bossCast = null;
      }
      return;
    }
    if (e.chargeVel || e.status.disabled) return;
    const dP = p.alive ? dist(e.x, e.z, p.x, p.z) : Infinity;
    const ready = (k: string) => (e.bossCds.get(k) ?? 99) <= 0;
    const y = run.world.heightAt(e.x, e.z);
    const abilities = e.def.abilities ?? [];
    if (abilities.includes('summon') && ready('summon')) {
      e.bossCds.set('summon', 16);
      const n = e.enraged ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const sx = e.x + Math.cos(a) * 3;
        const sz = e.z + Math.sin(a) * 3;
        this.spawn(e.def.summon ?? 'grunt', e.pathIndex, run.waveIndexForScaling, { x: sx, z: sz, wp: e.wp, progress: e.progress });
      }
      run.effects.ring(e.x, y, e.z, 6, 0x9333ea, 0.6);
      run.notify(`${e.def.name} ruft Verstärkung!`, 'warn');
      return;
    }
    if (dP < 7 && abilities.includes('slam') && ready('slam')) {
      e.bossCds.set('slam', 8);
      e.bossCast = { kind: 'slam', t: 1.2, x: e.x, z: e.z, dir: 0 };
      run.effects.telegraph(e.x, y, e.z, 5.5, 1.2);
      e.attackAnim = 1.2;
      return;
    }
    if (dP < 11 && abilities.includes('breath') && ready('breath')) {
      e.bossCds.set('breath', 9);
      const dir = Math.atan2(p.x - e.x, p.z - e.z);
      e.facing = dir;
      e.bossCast = { kind: 'breath', t: 1.25, x: e.x, z: e.z, dir };
      run.effects.telegraph(e.x, y, e.z, 10, 1.25, 0x38bdf8, { dir, angle: 1.25 });
      return;
    }
    if (dP < 16 && dP > 4 && abilities.includes('charge') && ready('charge')) {
      e.bossCds.set('charge', 11);
      const dir = Math.atan2(p.x - e.x, p.z - e.z);
      e.facing = dir;
      e.bossCast = { kind: 'charge', t: 1.0, x: e.x, z: e.z, dir };
      run.effects.telegraph(e.x, y, e.z, 12, 1.0, 0xf59e0b, { dir, angle: 0.35 });
      return;
    }
    if (dP < 18 && abilities.includes('meteor') && ready('meteor')) {
      e.bossCds.set('meteor', e.enraged ? 8 : 12);
      const count = e.enraged ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const ox = p.x + run.rng.range(-5, 5);
        const oz = p.z + run.rng.range(-5, 5);
        run.scheduleMeteor(ox, oz, 1.6 + i * 0.15, e.def.damage * 0.9);
      }
      run.notify('Meteore stürzen herab!', 'danger');
    }
  }

  private resolveBossCast(e: Enemy): void {
    const run = this.run;
    const p = run.player;
    const c = e.bossCast!;
    const y = run.world.heightAt(c.x, c.z);
    const dmg = e.def.damage * (1 + run.waveIndexForScaling * 0.03) * (e.enraged ? 1.3 : 1);
    if (c.kind === 'slam') {
      run.effects.ring(c.x, y, c.z, 6, 0xf97316, 0.5);
      run.effects.burst({ x: c.x, y: y + 0.5, z: c.z }, 0xfbbf24, 40, 9, 0.7);
      run.camera.shake(0.5, 0.35);
      run.audio.play('explosion');
      if (p.alive && dist(p.x, p.z, c.x, c.z) < 5.5 + 0.5) {
        run.combat.damagePlayer(dmg * 1.3, e);
        p.knockback(p.x - c.x, p.z - c.z, 6);
      }
    } else if (c.kind === 'breath') {
      run.audio.play('frost');
      for (let i = 0; i < 26; i++) {
        const a = c.dir + (Math.random() - 0.5) * 1.2;
        const r = Math.random() * 10;
        run.effects.puff({ x: c.x + Math.sin(a) * r, y: y + 1, z: c.z + Math.cos(a) * r }, 0xbae6fd, 2, 1.5, 0.8);
      }
      if (p.alive && inCone(c.x, c.z, c.dir, 1.25, 10, p.x, p.z)) {
        run.combat.damagePlayer(dmg * 1.2, e);
        p.status.applySlow(0.5, 3);
      }
    } else if (c.kind === 'charge') {
      e.chargeVel = { x: Math.sin(c.dir) * 22, z: Math.cos(c.dir) * 22, t: 0.55 };
      run.audio.play('charge');
      e.hitBy.clear();
    }
  }

  private moveBossCharge(e: Enemy, dt: number): void {
    const run = this.run;
    const cv = e.chargeVel!;
    e.x += cv.x * dt;
    e.z += cv.z * dt;
    cv.t -= dt;
    run.world.resolve(e, e.radius * 0.6);
    const p = run.player;
    if (p.alive && !e.hitBy.has(-1) && dist(p.x, p.z, e.x, e.z) < e.radius + 1) {
      e.hitBy.add(-1);
      run.combat.damagePlayer(e.def.damage * 1.4, e);
      p.knockback(cv.x, cv.z, 8);
    }
    run.effects.puff({ x: e.x, y: e.y + 0.3, z: e.z }, 0xd6b77d, 2, 2, 0.6);
    if (cv.t <= 0) e.chargeVel = null;
  }

  /* ── Animation ──────────────────────────────────────────── */
  private animate(e: Enemy, speed: number): void {
    const r = e.rig;
    const moving = speed > 0.1 && !e.status.disabled;
    const sw = moving ? Math.sin(e.walkPhase) : 0;
    const atk = e.attackAnim > 0 ? Math.sin((1 - e.attackAnim / 0.35) * Math.PI) : 0;
    switch (r.anim) {
      case 'biped':
        if (r.legs[0]) r.legs[0].rotation.x = sw * 0.6;
        if (r.legs[1]) r.legs[1].rotation.x = -sw * 0.6;
        if (r.armL) r.armL.rotation.x = -sw * 0.4;
        if (r.armR) r.armR.rotation.x = sw * 0.4 - atk * 1.8;
        r.body.position.y = Math.abs(sw) * 0.06;
        break;
      case 'quad':
      case 'hex':
        r.legs.forEach((l, i) => (l.rotation.x = (i % 2 === 0 ? sw : -sw) * 0.7));
        r.head.rotation.x = atk * 0.5;
        break;
      case 'wyrm':
        r.legs.forEach((l, i) => (l.rotation.x = (i % 2 === 0 ? sw : -sw) * 0.5));
        r.wings.forEach((w, i) => (w.rotation.z = Math.sin(performance.now() * 0.004) * 0.4 * (i === 0 ? 1 : -1)));
        r.head.rotation.x = -atk * 0.4;
        break;
    }
    if (e.status.stunT > 0) r.body.rotation.z = Math.sin(performance.now() * 0.02) * 0.05;
    else r.body.rotation.z = 0;
  }

  private animateDeath(e: Enemy, dt: number): void {
    e.deathT += dt;
    const r = e.rig.root;
    const t = e.deathT;
    if (t < 0.4) r.rotation.x = -(t / 0.4) * (Math.PI / 2) * (e.rig.anim === 'biped' ? 1 : 0.3);
    else r.position.y = e.y - (t - 0.4) * 1.2;
    const s = e.def.scale * (e.affix?.scaleMul ?? 1) * Math.max(0.01, 1 - Math.max(0, t - 0.6) / 0.6);
    r.scale.setScalar(s);
    e.bar.group.visible = false;
  }

  clear(): void {
    for (const e of this.list) this.run.scene.remove(e.rig.root);
    this.list.length = 0;
  }
}

function turnToward(cur: number, target: number, maxStep: number): number {
  let d = (target - cur) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}

export function inCone(ox: number, oz: number, dir: number, angle: number, range: number, x: number, z: number): boolean {
  const dx = x - ox;
  const dz = z - oz;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < 0.5) return true;
  let a = Math.atan2(dx, dz) - dir;
  a = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return Math.abs(a) <= angle / 2;
}
