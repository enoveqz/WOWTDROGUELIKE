import type { Rng } from '../core/rng.ts';
import { ENEMIES, type EnemyId } from './enemies.ts';
import type { LevelDef, WaveTheme } from './levels.ts';

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  interval: number;
  path: number;
  delay: number;
}

export interface WaveSpec {
  index: number;
  theme: WaveTheme;
  groups: SpawnGroup[];
  bonusGold: number;
  isBoss: boolean;
  /** Gesamtanzahl Gegner (für HUD/Vorschau). */
  total: number;
}

export const THEME_INFO: Record<WaveTheme, { name: string; desc: string }> = {
  horde: { name: 'Horde', desc: 'Viele Nahkämpfer' },
  swift: { name: 'Hetzjagd', desc: 'Schnelle Gegner' },
  ranged: { name: 'Speerhagel', desc: 'Fernkämpfer mit Begleitschutz' },
  heavy: { name: 'Belagerung', desc: 'Gepanzerte Oger' },
  mixed: { name: 'Gemischte Kolonne', desc: 'Von allem etwas' },
  elite: { name: 'Elitetrupp', desc: 'Champions und Fluchwirker' },
  boss: { name: 'Bosswelle', desc: 'Der Herrscher dieses Landes' },
};

/** Budget-Anteile je Thema. */
const THEME_MIX: Record<WaveTheme, Partial<Record<EnemyId, number>>> = {
  horde: { grunt: 0.8, runner: 0.2 },
  swift: { runner: 0.7, grunt: 0.3 },
  ranged: { archer: 0.55, grunt: 0.45 },
  heavy: { brute: 0.55, grunt: 0.3, archer: 0.15 },
  mixed: { grunt: 0.35, runner: 0.2, archer: 0.25, brute: 0.2 },
  elite: { elite: 0.4, shaman: 0.2, grunt: 0.25, archer: 0.15 },
  boss: { grunt: 0.45, runner: 0.25, archer: 0.3 },
};

const BASE_INTERVAL: Partial<Record<EnemyId, number>> = {
  grunt: 1.0,
  runner: 0.6,
  archer: 1.15,
  brute: 2.6,
  shaman: 3,
  elite: 4,
};

/** Frühe Wellen bleiben überschaubar: Tank-/Elitetypen erst ab bestimmter Welle. */
const MIN_WAVE: Partial<Record<EnemyId, number>> = { brute: 2, shaman: 3, elite: 4 };

export const waveBudget = (level: LevelDef, index: number): number => (8 + 3.4 * index) * level.budgetMul;

export function generateWaves(level: LevelDef, rng: Rng, opts: { extraElites?: boolean } = {}): WaveSpec[] {
  const waves: WaveSpec[] = [];
  level.waves.forEach((tpl, index) => {
    const isBoss = tpl.theme === 'boss';
    const variance = rng.range(0.9, 1.12);
    const budget = waveBudget(level, index) * variance * (isBoss ? 0.6 : 1);
    const groups: SpawnGroup[] = [];
    const speedUp = 1 + 0.04 * index;
    let delay = 0;

    if (isBoss) {
      groups.push({ enemy: level.boss, count: 1, interval: 1, path: tpl.paths[0], delay: 6 });
    }

    // Kontrollierter Zufall: gemischte Wellen erhalten gelegentlich einen Extra-Tank.
    const mix = { ...THEME_MIX[tpl.theme] };
    if (tpl.theme === 'mixed' && rng.chance(0.35)) mix.brute = (mix.brute ?? 0) + 0.1;
    if (tpl.theme === 'horde' && index >= 3 && rng.chance(0.4)) mix.archer = 0.15;

    const entries = (Object.entries(mix) as [EnemyId, number][]).filter(([id]) => index >= (MIN_WAVE[id] ?? 0) || tpl.theme === 'elite');
    const shareSum = entries.reduce((a, [, s]) => a + s, 0) || 1;

    for (const [id, share] of entries) {
      const def = ENEMIES[id];
      const count = Math.max(id === 'elite' || id === 'shaman' ? 1 : 2, Math.round((budget * (share / shareSum)) / def.cost));
      // Auf aktive Pfade verteilen.
      const per = splitCount(count, tpl.paths.length);
      tpl.paths.forEach((pathIdx, i) => {
        if (per[i] <= 0) return;
        groups.push({
          enemy: id,
          count: per[i],
          interval: (BASE_INTERVAL[id] ?? 1) / speedUp,
          path: pathIdx,
          delay,
        });
      });
      delay += 3.5;
    }

    if (opts.extraElites && index >= 2 && !isBoss) {
      groups.push({ enemy: 'elite', count: 1, interval: 1, path: rng.pick(tpl.paths), delay: delay + 2 });
    }

    const total = groups.reduce((a, g) => a + g.count, 0);
    waves.push({ index, theme: tpl.theme, groups, bonusGold: 22 + index * 7, isBoss, total });
  });
  return waves;
}

function splitCount(count: number, parts: number): number[] {
  const base = Math.floor(count / parts);
  const out = new Array<number>(parts).fill(base);
  for (let i = 0; i < count - base * parts; i++) out[i]++;
  return out;
}

/** Leben eines Gegners in einer bestimmten Welle. */
export function enemyHpFor(baseHp: number, level: LevelDef, waveIndex: number, extraMul = 1): number {
  return Math.round(baseHp * level.hpMul * (1 + 0.075 * waveIndex) * extraMul);
}

/** Zusammenfassung für die HUD-Vorschau, z. B. [["Morling-Krieger", 12], …]. */
export function waveSummary(w: WaveSpec): { id: EnemyId; name: string; count: number }[] {
  const map = new Map<EnemyId, number>();
  for (const g of w.groups) map.set(g.enemy, (map.get(g.enemy) ?? 0) + g.count);
  return [...map.entries()].map(([id, count]) => ({ id, name: ENEMIES[id].name, count }));
}
