import * as THREE from 'three';
import { talentFlagRank } from '../config/talents.ts';
import { dist } from '../core/math.ts';
import { createTrap } from '../world/models.ts';
import type { Enemy } from './enemies.ts';
import { inCone } from './enemies.ts';
import type { Player } from './player.ts';
import type { Run } from './run.ts';

/**
 * Klassen- und Rassenfähigkeiten. Jede Fähigkeit wirkt spielmechanisch
 * (Schaden, Kontrolle, Buffs) und erzeugt passendes visuelles Feedback.
 */
export function castSkill(run: Run, p: Player, id: string, aim: THREE.Vector3, aimEnemy: Enemy | null): boolean {
  const s = run.stats;
  const aoe = s.aoe;
  const signature = p.cls.skills[3].id === id && talentFlagRank(run.save.data.talents, 'signature') > 0 ? 1.35 : 1;
  const sp = s.power * s.skillPower * p.damageMul() * signature;
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  const y = p.y;
  const hit = (e: Enemy, mul: number, element: 'physical' | 'fire' | 'frost' | 'arcane' | 'nature' | 'shadow' = 'physical') =>
    run.combat.damageEnemy(e, sp * mul, { source: 'hero', element, skill: true });

  switch (id) {
    // ── Krieger ──────────────────────────────────────────────
    case 'whirl': {
      const r = 4 * aoe;
      for (const e of [...run.enemies.inRadius(p.x, p.z, r)]) hit(e, 1.6);
      p.spinT = 0.4;
      run.effects.ring(p.x, y, p.z, r, 0xe2e8f0, 0.35);
      run.effects.burst({ x: p.x, y: y + 1, z: p.z }, 0xf8fafc, 18, 6, 0.35, 0);
      run.audio.play('swing');
      return true;
    }
    case 'bulwark': {
      p.addBuff('bulwark', 4);
      for (const e of run.enemies.inRadius(p.x, p.z, 9)) if (!e.def.boss) e.status.tauntT = 4;
      run.effects.ring(p.x, y, p.z, 9, 0xfbbf24, 0.6);
      run.effects.ring(p.x, y + 1, p.z, 1.6, 0xfde68a, 0.6, 1);
      run.audio.play('upgrade', 0.6);
      return true;
    }
    case 'charge': {
      const dx = aim.x - p.x;
      const dz = aim.z - p.z;
      run.audio.play('charge');
      p.startDash(dx, dz, 9, 0.28, {
        hitRadius: 1.7,
        onHit: (e) => {
          hit(e, 1.2);
          e.status.stunT = Math.max(e.status.stunT, 1);
          run.camera.shake(0.12, 0.1);
        },
      });
      run.effects.puff({ x: p.x, y: y + 0.3, z: p.z }, 0xd6d3d1, 8, 2, 0.6);
      return true;
    }
    case 'earthsplit': {
      const range = 7 * aoe;
      const angle = 1.25;
      for (const e of [...run.enemies.inRadius(p.x, p.z, range)]) {
        if (!inCone(p.x, p.z, p.facing, angle, range + e.radius, e.x, e.z)) continue;
        hit(e, 3.0);
        e.status.applySlow(0.5, 3);
      }
      for (let i = 1; i <= 7; i++) {
        const d = (i / 7) * range;
        for (const off of [-0.45, 0, 0.45]) {
          const a = p.facing + off * (i / 7);
          run.effects.burst({ x: p.x + Math.sin(a) * d, y: y + 0.3, z: p.z + Math.cos(a) * d }, 0xa16207, 4, 4, 0.5);
        }
      }
      run.camera.shake(0.35, 0.25);
      run.audio.play('explosion', 0.7);
      return true;
    }
    // ── Magier ──────────────────────────────────────────────
    case 'fireball': {
      const r = 3.5 * aoe;
      run.audio.play('fire');
      run.combat.heroShot('fireball', 0xff7a1a, p.x + fx, y + 1.5, p.z + fz, aim.x - p.x, aim.z - p.z, 22, 20, sp * 2.2, { source: 'hero', element: 'fire', skill: true }, {
        radius: 0.8,
        trail: 0xff9a3d,
        onHit: (x, z) => {
          const hy = run.world.heightAt(x, z);
          for (const e of [...run.enemies.inRadius(x, z, r)]) {
            hit(e, 2.2, 'fire');
            if (e.alive) {
              e.status.burnDps = Math.max(e.status.burnDps, s.power * 0.5 * (run.flags.has('burnSpread') ? 1.5 : 1));
              e.status.burnT = 3;
            }
          }
          run.effects.ring(x, hy, z, r, 0xff7a1a, 0.4);
          run.effects.burst({ x, y: hy + 1, z }, 0xff9a3d, 30, 7, 0.6);
          run.effects.puff({ x, y: hy + 1, z }, 0x7c2d12, 6, 2, 1);
          run.audio.play('explosion', 0.6);
          run.camera.shake(0.15, 0.15);
        },
      });
      return true;
    }
    case 'frostnova': {
      const r = 5.5 * aoe;
      const freeze = 2.2 + (run.synergies.has('permafrost') ? 0.8 : 0);
      for (const e of [...run.enemies.inRadius(p.x, p.z, r)]) {
        hit(e, 0.8, 'frost');
        if (e.alive) {
          e.status.stunT = Math.max(e.status.stunT, e.def.boss ? freeze * 0.35 : freeze);
          e.status.applySlow(0.4, freeze + 2);
        }
      }
      run.effects.ring(p.x, y, p.z, r, 0x67e8f9, 0.5);
      run.effects.zone(p.x, y, p.z, r, 0x0891b2, 1.2, 0.3, false);
      run.effects.burst({ x: p.x, y: y + 0.5, z: p.z }, 0xcffafe, 40, 8, 0.6, 1);
      run.audio.play('frost');
      return true;
    }
    case 'blink': {
      let dx = aim.x - p.x;
      let dz = aim.z - p.z;
      if (Math.hypot(dx, dz) < 0.5) {
        dx = fx;
        dz = fz;
      }
      run.effects.burst({ x: p.x, y: y + 1, z: p.z }, 0xa78bfa, 16, 3, 0.5);
      p.startDash(dx, dz, 8, 0.12, { invuln: true, ghost: true });
      run.audio.play('cast');
      return true;
    }
    case 'chain': {
      let target = aimEnemy && dist(aimEnemy.x, aimEnemy.z, p.x, p.z) < 15 ? aimEnemy : run.enemies.nearest(aim.x, aim.z, 6);
      if (!target || dist(target.x, target.z, p.x, p.z) > 16) target = run.enemies.nearest(p.x, p.z, 14);
      if (!target) {
        run.notify('Kein Ziel in Reichweite', 'info');
        return false;
      }
      const visited = new Set<number>();
      let from = new THREE.Vector3(p.x, y + 1.6, p.z);
      let mul = 2.0;
      let cur: Enemy | null = target;
      for (let i = 0; i < 7 && cur; i++) {
        visited.add(cur.id);
        const to = new THREE.Vector3(cur.x, cur.y + 1.2, cur.z);
        run.effects.beam(from, to, 0xa5f3fc, 0.14, 0.3);
        run.effects.burst(to, 0xe0f2fe, 8, 4, 0.3);
        hit(cur, mul, 'arcane');
        mul *= 0.85;
        from = to;
        cur = run.enemies.nearest(cur.x, cur.z, 6.5, visited);
      }
      run.audio.play('bolt');
      return true;
    }
    // ── Schurke ─────────────────────────────────────────────
    case 'fan': {
      const r = 4.5 * aoe;
      for (const e of [...run.enemies.inRadius(p.x, p.z, r)]) {
        hit(e, 1.2);
        if (e.alive) {
          e.status.poisonDps = Math.max(e.status.poisonDps, s.power * 0.4);
          e.status.poisonT = 4;
        }
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        run.combat.heroShot('knife', 0xc4b5fd, p.x, y + 1.1, p.z, Math.sin(a), Math.cos(a), 20, r, 0, { source: 'hero' }, { onHit: () => undefined, pierce: 99, radius: 0.1, trail: 0 });
      }
      run.effects.ring(p.x, y, p.z, r, 0x84cc16, 0.4);
      run.audio.play('swing');
      return true;
    }
    case 'shadowstep': {
      const target = aimEnemy && dist(aimEnemy.x, aimEnemy.z, p.x, p.z) < 13 ? aimEnemy : run.enemies.nearest(aim.x, aim.z, 5);
      if (!target || dist(target.x, target.z, p.x, p.z) > 13) {
        run.notify('Kein Ziel in Reichweite', 'info');
        return false;
      }
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      run.effects.puff({ x: p.x, y: y + 1, z: p.z }, 0x6d28d9, 10, 2, 0.7);
      p.startDash(dx, dz, d + target.radius + 0.9, 0.12, { invuln: true, ghost: true });
      p.addBuff('nextCrit', 6);
      run.audio.play('cast');
      return true;
    }
    case 'smoke': {
      const r = 5 * aoe;
      const sx = p.x;
      const sz = p.z;
      const remove = run.effects.zone(sx, y, sz, r, 0x6b7280, 5, 0.45);
      for (let i = 0; i < 3; i++) run.effects.puff({ x: sx, y: y + 1, z: sz }, 0x9ca3af, 12, 3, 1.4);
      run.combat.addZone({
        x: sx, z: sz, r, dur: 5, interval: 0.25, tag: 'smoke', removeVisual: remove,
        onTick: (inside) => {
          for (const e of inside) {
            e.status.applySlow(0.4, 0.5);
            e.status.vulnT = Math.max(e.status.vulnT, 0.5);
          }
        },
      });
      p.addBuff('smoke', 5);
      run.audio.play('explosion', 0.4);
      return true;
    }
    case 'execute': {
      const target = aimEnemy && dist(aimEnemy.x, aimEnemy.z, p.x, p.z) < 4 ? aimEnemy : run.enemies.nearest(p.x, p.z, 3.8);
      if (!target) {
        run.notify('Kein Ziel in Nahkampfreichweite', 'info');
        return false;
      }
      const low = target.hp / target.maxHp < 0.35;
      hit(target, low ? 8 : 4);
      run.effects.burst({ x: target.x, y: target.y + 1.2, z: target.z }, 0xef4444, 26, 6, 0.5);
      run.camera.shake(0.2, 0.15);
      run.audio.play('crit');
      if (!target.alive) {
        p.addBuff('executeReset', 0.5);
        run.notify('Todesstoß zurückgesetzt!', 'good');
      }
      return true;
    }
    // ── Waldläufer ──────────────────────────────────────────
    case 'multishot': {
      const base = Math.atan2(aim.x - p.x, aim.z - p.z);
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.17;
        run.combat.heroShot('arrow', 0xbbf7d0, p.x, y + 1.3, p.z, Math.sin(a), Math.cos(a), 38, 20, sp * 0.9, { source: 'hero', skill: true }, { pierce: 3, radius: 0.7, trail: 0x86efac });
      }
      run.audio.play('arrow');
      return true;
    }
    case 'trap': {
      let tx = aim.x;
      let tz = aim.z;
      const d = dist(tx, tz, p.x, p.z);
      if (d > 14) {
        tx = p.x + ((tx - p.x) / d) * 14;
        tz = p.z + ((tz - p.z) / d) * 14;
      }
      const traps = run.combat.zonesTagged('trap');
      if (traps.length >= 3) traps[0].done = true;
      const mesh = createTrap();
      mesh.position.set(tx, run.world.heightAt(tx, tz), tz);
      run.scene.add(mesh);
      const r = 2.5 * aoe;
      run.combat.addZone({
        x: tx, z: tz, r: 1.3, dur: 90, interval: 1, tag: 'trap', mesh,
        trigger: (zone) => {
          const inside = run.enemies.inRadius(zone.x, zone.z, zone.r);
          if (inside.length === 0) return false;
          const hy = run.world.heightAt(zone.x, zone.z);
          for (const e of [...run.enemies.inRadius(zone.x, zone.z, r)]) {
            hit(e, 2.0, 'nature');
            if (e.alive) e.status.rootT = Math.max(e.status.rootT, e.def.boss ? 0.8 : 2.5);
          }
          run.effects.ring(zone.x, hy, zone.z, r, 0x4ade80, 0.4);
          run.effects.burst({ x: zone.x, y: hy + 0.5, z: zone.z }, 0x86efac, 22, 6, 0.5);
          run.audio.play('hit');
          return true;
        },
      });
      run.audio.play('build', 0.5);
      return true;
    }
    case 'pack': {
      p.addBuff('pack', 8);
      if (p.pet) run.effects.ring(p.pet.x, y, p.pet.z, 3, 0x4ade80, 0.5);
      run.effects.ring(p.x, y, p.z, 3, 0x86efac, 0.5);
      run.audio.play('levelup', 0.5);
      return true;
    }
    case 'volley': {
      let tx = aim.x;
      let tz = aim.z;
      const d = dist(tx, tz, p.x, p.z);
      if (d > 18) {
        tx = p.x + ((tx - p.x) / d) * 18;
        tz = p.z + ((tz - p.z) / d) * 18;
      }
      const r = 5 * aoe;
      const hy = run.world.heightAt(tx, tz);
      const remove = run.effects.zone(tx, hy, tz, r, 0x4ade80, 3.1, 0.25);
      run.combat.addZone({
        x: tx, z: tz, r, dur: 3.05, interval: 0.5, tag: 'volley', removeVisual: remove,
        onTick: (inside) => {
          for (const e of [...inside]) {
            hit(e, 0.6);
            e.status.applySlow(0.3, 1);
          }
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.random() * r;
            run.effects.burst({ x: tx + Math.cos(a) * rr, y: hy + 0.3, z: tz + Math.sin(a) * rr }, 0xe5e7eb, 3, 2, 0.3);
          }
          run.audio.play('arrow', 0.4);
        },
      });
      return true;
    }
  }
  return false;
}

export function castRacial(run: Run, p: Player, _aim: THREE.Vector3): void {
  const s = run.stats;
  const y = p.y;
  const pow = s.racialPower;
  switch (p.race.id) {
    case 'human': {
      p.status.slowT = 0;
      p.status.stunT = 0;
      p.status.rootT = 0;
      p.heal(p.maxHp * 0.25 * pow);
      p.addBuff('crown', 6);
      run.effects.ring(p.x, y, p.z, 4, 0xfbbf24, 0.6);
      run.effects.burst({ x: p.x, y: y + 1.5, z: p.z }, 0xfde68a, 30, 4, 0.8, -1);
      run.audio.play('heal');
      break;
    }
    case 'elf': {
      const r = 7 * s.aoe;
      const remove = run.effects.zone(p.x, y, p.z, r, 0x22c55e, 3, 0.3);
      for (const e of run.enemies.inRadius(p.x, p.z, r)) e.status.rootT = Math.max(e.status.rootT, e.def.boss ? 1 : 3);
      const sx = p.x;
      const sz = p.z;
      run.combat.addZone({
        x: sx, z: sz, r, dur: 3, interval: 0.5, tag: 'roots', removeVisual: remove,
        onTick: (inside) => {
          for (const e of [...inside]) run.combat.damageEnemy(e, s.power * 0.5 * pow, { source: 'hero', element: 'nature', canCrit: false });
        },
      });
      run.effects.ring(p.x, y, p.z, r, 0x4ade80, 0.6);
      run.effects.burst({ x: p.x, y: y + 0.5, z: p.z }, 0x86efac, 30, 6, 0.6);
      run.audio.play('cast');
      break;
    }
    case 'orc': {
      const r = 6 * s.aoe;
      for (const e of [...run.enemies.inRadius(p.x, p.z, r)]) {
        run.combat.damageEnemy(e, s.power * 2 * pow * p.damageMul(), { source: 'hero', element: 'physical' });
        if (e.alive) e.status.stunT = Math.max(e.status.stunT, e.def.boss ? 0.6 : 1.8);
      }
      run.effects.ring(p.x, y, p.z, r, 0xf97316, 0.5);
      run.effects.burst({ x: p.x, y: y + 0.3, z: p.z }, 0xfdba74, 40, 8, 0.6);
      run.camera.shake(0.5, 0.35);
      run.audio.play('explosion');
      break;
    }
    case 'dwarf': {
      p.addBuff('fortress', 6);
      run.effects.ring(p.x, y, p.z, 14, 0xf59e0b, 0.8);
      run.effects.ring(p.x, y + 1, p.z, 1.8, 0xfcd34d, 0.6, 1);
      run.audio.play('build');
      break;
    }
  }
}
