import * as THREE from 'three';
import { SELL_REFUND, TOWERS, type TowerDef, type TowerId } from '../config/towers.ts';
import { dist } from '../core/math.ts';
import type { Collider } from '../world/world.ts';
import { createTower, type TowerRig } from '../world/models.ts';
import type { Enemy } from './enemies.ts';
import type { Run } from './run.ts';

export class Tower {
  def: TowerDef;
  level = 1;
  padIndex: number;
  x: number;
  z: number;
  y: number;
  rig: TowerRig;
  cd = 0.5;
  collider: Collider;
  invested: number;
  kills = 0;
  private aimYaw = 0;

  constructor(def: TowerDef, padIndex: number, x: number, z: number, y: number, invested: number) {
    this.def = def;
    this.padIndex = padIndex;
    this.x = x;
    this.z = z;
    this.y = y;
    this.invested = invested;
    this.rig = createTower(def.id, 1);
    this.rig.root.position.set(x, y + 0.3, z);
    this.collider = { x, z, r: 1.3 };
  }

  get stats() {
    return this.def.levels[this.level - 1];
  }

  rebuildVisual(scene: THREE.Scene): void {
    const showRange = this.rig.rangeRing.visible;
    scene.remove(this.rig.root);
    this.rig = createTower(this.def.id, this.level);
    this.rig.root.position.set(this.x, this.y + 0.3, this.z);
    this.rig.rangeRing.visible = showRange;
    scene.add(this.rig.root);
  }

  aimAt(e: Enemy, dt: number): void {
    const target = Math.atan2(e.x - this.x, e.z - this.z);
    let d = target - this.aimYaw;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.aimYaw += d * Math.min(1, dt * 12);
    this.rig.turret.rotation.y = this.aimYaw;
  }
}

/**
 * Turmverwaltung: Bauen, Aufwerten, Verkaufen, Zielwahl und Angriffe.
 * Türme stehen auf festen Bauplätzen neben den Gegnerrouten.
 */
export class TowerManager {
  readonly towers: (Tower | null)[];
  private run: Run;
  private time = 0;

  constructor(run: Run) {
    this.run = run;
    this.towers = run.level.pads.map(() => null);
  }

  get count(): number {
    return this.towers.filter(Boolean).length;
  }

  cost(id: TowerId): number {
    return Math.round(TOWERS[id].cost * this.run.stats.towerCost);
  }

  upgradeCost(t: Tower): number | null {
    if (t.level >= 3) return null;
    return Math.round(t.def.upgradeCost[t.level - 1] * this.run.stats.towerCost);
  }

  sellValue(t: Tower): number {
    return Math.round(t.invested * SELL_REFUND);
  }

  rangeOf(t: Tower): number {
    const sand = this.run.challengeActive && this.run.level.challenge.id === 'sandstorm' ? 0.7 : 1;
    return t.stats.range * this.run.stats.towerRange * sand;
  }

  build(padIndex: number, id: TowerId): boolean {
    const run = this.run;
    if (this.towers[padIndex]) return false;
    if (!run.towerAvailable(id)) return false;
    const cost = this.cost(id);
    if (run.gold < cost) {
      run.notify('Nicht genug Gold', 'info');
      run.audio.play('error');
      return false;
    }
    run.gold -= cost;
    const pad = run.level.pads[padIndex];
    const y = run.world.heightAt(pad.x, pad.z);
    const t = new Tower(TOWERS[id], padIndex, pad.x, pad.z, y, cost);
    this.towers[padIndex] = t;
    run.scene.add(t.rig.root);
    run.world.addCollider(t.collider);
    // Held darf nicht im Turm stecken bleiben
    run.world.resolve(run.player, 0.5);
    run.effects.ring(pad.x, y, pad.z, 3, 0xfbbf24, 0.5);
    run.effects.puff({ x: pad.x, y: y + 1, z: pad.z }, 0xd6d3d1, 14, 2.5, 0.9);
    run.audio.play('build');
    run.towersBuilt++;
    return true;
  }

  upgrade(padIndex: number): boolean {
    const run = this.run;
    const t = this.towers[padIndex];
    if (!t) return false;
    const cost = this.upgradeCost(t);
    if (cost === null) return false;
    if (run.gold < cost) {
      run.notify('Nicht genug Gold', 'info');
      run.audio.play('error');
      return false;
    }
    run.gold -= cost;
    t.invested += cost;
    t.level++;
    t.rebuildVisual(run.scene);
    run.effects.ring(t.x, t.y, t.z, 3.2, 0x22d3ee, 0.6);
    run.effects.burst({ x: t.x, y: t.y + 3, z: t.z }, 0x67e8f9, 24, 4, 0.7);
    run.audio.play('upgrade');
    return true;
  }

  sell(padIndex: number): void {
    const run = this.run;
    const t = this.towers[padIndex];
    if (!t) return;
    const value = this.sellValue(t);
    run.gold += value;
    run.scene.remove(t.rig.root);
    run.world.removeCollider(t.collider);
    this.towers[padIndex] = null;
    run.effects.puff({ x: t.x, y: t.y + 1, z: t.z }, 0xa8a29e, 14, 2.5, 0.8);
    run.audio.play('sell');
    run.notify(`Turm verkauft (+${value} Gold)`, 'info');
  }

  showRanges(on: boolean, only = -1): void {
    this.towers.forEach((t, i) => {
      if (!t) return;
      const vis = on && (only < 0 || only === i);
      t.rig.rangeRing.visible = vis;
      if (vis) {
        const r = this.rangeOf(t);
        t.rig.rangeRing.scale.setScalar(r);
      }
    });
  }

  update(dt: number): void {
    const run = this.run;
    this.time += dt;
    const p = run.player;
    const fortress = p.alive && p.buff('fortress');
    const aura = run.flags.has('towerAura') && p.alive;
    for (const t of this.towers) {
      if (!t) continue;
      if (t.rig.spin) {
        t.rig.spin.rotation.y += dt * 1.8;
        t.rig.spin.position.y = Math.sin(this.time * 2 + t.padIndex) * 0.15;
      }
      if (t.cd > 0) t.cd -= dt;
      const s = t.stats;
      const range = this.rangeOf(t);
      if (t.rig.rangeRing.visible) t.rig.rangeRing.scale.setScalar(range);
      const near = dist(p.x, p.z, t.x, t.z);
      const rateMul = run.stats.towerRate * (fortress && near < 14 ? 1.4 : 1);
      const dmgMul = run.stats.towerDmg * (aura && near < 10 ? 1.3 : 1);

      if (t.def.id === 'frost') {
        if (t.cd > 0) continue;
        const inside = [...run.enemies.inRadius(t.x, t.z, range)];
        if (inside.length === 0) continue;
        t.cd = 1 / (s.rate * rateMul);
        const slowBonus = run.synergies.has('permafrost') ? 0.1 : 0;
        for (const e of inside) {
          run.combat.damageEnemy(e, s.damage * dmgMul, { source: 'tower', element: 'frost', canCrit: false, silent: true });
          if (!e.alive) continue;
          e.status.applySlow((s.slow ?? 0.3) + slowBonus, s.slowDuration ?? 1.5);
          if (s.freezeChance && !e.def.boss && run.rng.next() < s.freezeChance) {
            e.status.stunT = Math.max(e.status.stunT, run.synergies.has('permafrost') ? 1.5 : 1);
            run.effects.burst({ x: e.x, y: e.y + 1, z: e.z }, 0xe0f2fe, 8, 3, 0.4);
          }
        }
        run.effects.ring(t.x, t.y + 0.3, t.z, range, 0x67e8f9, 0.6, 0.15);
        run.audio.play('frost', 0.25);
        continue;
      }

      const target = run.enemies.furthestInRange(t.x, t.z, range);
      if (!target) continue;
      t.aimAt(target, dt);
      if (t.cd > 0) continue;
      t.cd = 1 / (s.rate * rateMul);
      const muzzle = new THREE.Vector3();
      t.rig.muzzle.getWorldPosition(muzzle);
      if (t.def.id === 'arrow') {
        const shots = s.multishot ?? 1;
        let fired = 0;
        const exclude = new Set<number>();
        let tgt: Enemy | null = target;
        while (tgt && fired < shots) {
          run.combat.towerShot('arrow', 0xfde68a, muzzle.x, muzzle.y, muzzle.z, tgt, 30, s.damage * dmgMul, 0);
          exclude.add(tgt.id);
          fired++;
          tgt = run.enemies.nearest(target.x, target.z, 5, exclude);
        }
        run.audio.play('arrow', 0.25);
      } else {
        const burn = s.burn ?? 0;
        run.combat.towerShot('arcane', 0xc4b5fd, muzzle.x, muzzle.y, muzzle.z, target, 17, s.damage * dmgMul, s.splash ?? 2.5, (x, z, hitEnemy) => {
          const splash = s.splash ?? 2.5;
          for (const e of [...run.enemies.inRadius(x, z, splash)]) {
            run.combat.damageEnemy(e, (e === hitEnemy ? 1 : 0.6) * s.damage * dmgMul, { source: 'tower', element: 'arcane', canCrit: false });
            if (burn && e.alive) {
              e.status.burnDps = Math.max(e.status.burnDps, burn * dmgMul);
              e.status.burnT = 3;
            }
          }
          const hy = run.world.heightAt(x, z);
          run.effects.ring(x, hy, z, splash, 0xa78bfa, 0.35);
          run.effects.burst({ x, y: hy + 0.8, z }, 0xc4b5fd, 12, 4, 0.4);
        });
        run.audio.play('cast', 0.3);
      }
    }
  }

  clear(): void {
    for (const t of this.towers) if (t) this.run.scene.remove(t.rig.root);
  }
}

