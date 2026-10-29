import type { Vec2 } from '../core/math.ts';
import type { BiomeId } from './biomes.ts';
import type { EnemyId } from './enemies.ts';

export type WaveTheme = 'horde' | 'swift' | 'ranged' | 'heavy' | 'mixed' | 'elite' | 'boss';
export type ChallengeId = 'ambush' | 'sandstorm' | 'blizzard' | 'meteors';

export interface WaveTemplate {
  theme: WaveTheme;
  /** Indizes der aktiven Gegnerrouten in dieser Welle. */
  paths: number[];
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  biome: BiomeId;
  difficulty: 1 | 2 | 3 | 4;
  desc: string;
  challenge: { id: ChallengeId; name: string; desc: string };
  paths: Vec2[][];
  pads: Vec2[];
  crystal: Vec2;
  playerStart: Vec2;
  waves: WaveTemplate[];
  boss: EnemyId;
  /** Nach diesen (1-basierten) Wellen erscheint eine Upgrade-Auswahl. */
  upgradeAfter: number[];
  hpMul: number;
  budgetMul: number;
  startGold: number;
  crystalHp: number;
  rewardShards: number;
  /** Benötigt den Abschluss dieses Levels. */
  unlockAfter?: string;
}

const p = (x: number, z: number): Vec2 => ({ x, z });

export const LEVELS: LevelDef[] = [
  {
    id: 'whisperwood',
    name: 'Flüsterwald',
    subtitle: 'Der Hain der ersten Wacht',
    biome: 'forest',
    difficulty: 1,
    desc: 'Ein uralter Wald, in dem verderbte Morlinge zum Aetherkristall vordringen. Ideal, um Held und Türme kennenzulernen.',
    challenge: { id: 'ambush', name: 'Hinterhalt', desc: 'In einzelnen Wellen öffnet sich ein zweites Portal im Osten.' },
    paths: [
      [p(-30, -36), p(-30, -16), p(-10, -16), p(-10, 0), p(16, 0), p(16, 14), p(0, 14), p(0, 22)],
      [p(36, -10), p(26, -10), p(26, 0), p(16, 0), p(16, 14), p(0, 14), p(0, 22)],
    ],
    pads: [p(-25, -22), p(-16, -10), p(-4, -8), p(-4, 6), p(10, -6), p(22, 6), p(8, 8), p(6, 19), p(-6, 18), p(31, -4)],
    crystal: p(0, 26.5),
    playerStart: p(6, 22),
    waves: [
      { theme: 'horde', paths: [0] },
      { theme: 'swift', paths: [0] },
      { theme: 'ranged', paths: [0] },
      { theme: 'mixed', paths: [0, 1] },
      { theme: 'heavy', paths: [0] },
      { theme: 'swift', paths: [0, 1] },
      { theme: 'elite', paths: [0] },
      { theme: 'boss', paths: [0, 1] },
    ],
    boss: 'boss_treant',
    upgradeAfter: [1, 3, 5, 7],
    hpMul: 1,
    budgetMul: 1,
    startGold: 170,
    crystalHp: 1000,
    rewardShards: 60,
  },
  {
    id: 'sunscorch',
    name: 'Sonnenglut-Dünen',
    subtitle: 'Die Gräber unter dem Sand',
    biome: 'desert',
    difficulty: 2,
    desc: 'Zwei Karawanenstraßen treffen sich vor dem Kristall. Gegner kommen von beiden Seiten.',
    challenge: { id: 'sandstorm', name: 'Sandsturm', desc: 'Regelmäßig zieht ein Sandsturm auf: Turmreichweite −30 %, Sicht eingeschränkt.' },
    paths: [
      [p(-34, -34), p(-34, -14), p(-16, -14), p(-16, -2), p(0, -2), p(0, 8), p(-12, 8), p(-12, 18), p(0, 18), p(0, 24)],
      [p(34, -34), p(34, -20), p(14, -20), p(14, -2), p(0, -2), p(0, 8), p(-12, 8), p(-12, 18), p(0, 18), p(0, 24)],
    ],
    pads: [p(-28, -20), p(-22, -6), p(-8, -8), p(28, -26), p(20, -12), p(8, -8), p(6, 4), p(-6, 13), p(-18, 13), p(6, 15), p(-6, 24)],
    crystal: p(0, 28.5),
    playerStart: p(6, 24),
    waves: [
      { theme: 'horde', paths: [0] },
      { theme: 'swift', paths: [1] },
      { theme: 'mixed', paths: [0, 1] },
      { theme: 'ranged', paths: [0, 1] },
      { theme: 'heavy', paths: [1] },
      { theme: 'swift', paths: [0, 1] },
      { theme: 'elite', paths: [0, 1] },
      { theme: 'mixed', paths: [0, 1] },
      { theme: 'boss', paths: [0, 1] },
    ],
    boss: 'boss_scarab',
    upgradeAfter: [1, 3, 5, 7],
    hpMul: 1.2,
    budgetMul: 1.12,
    startGold: 190,
    crystalHp: 1100,
    rewardShards: 90,
    unlockAfter: 'whisperwood',
  },
  {
    id: 'frostspire',
    name: 'Frostzinnen',
    subtitle: 'Das Herz des ewigen Winters',
    biome: 'snow',
    difficulty: 3,
    desc: 'Der Kristall steht im Zentrum eines vereisten Tals. Angriffe kommen aus Nord und Süd – später auch aus dem Westen.',
    challenge: { id: 'blizzard', name: 'Schneesturm', desc: 'Periodische Schneestürme: Held −25 % Tempo, Gegner +15 % Tempo.' },
    paths: [
      [p(-36, -34), p(-20, -34), p(-20, -18), p(-6, -18), p(-6, -6), p(-2.6, -2.6)],
      [p(36, 34), p(20, 34), p(20, 18), p(6, 18), p(6, 6), p(2.6, 2.6)],
      [p(-36, 30), p(-18, 30), p(-18, 8), p(-6, 8), p(-2.8, 2.8)],
    ],
    pads: [p(-26, -28), p(-14, -24), p(-12, -10), p(0, -12), p(26, 28), p(14, 24), p(12, 10), p(0, 12), p(-12, 20), p(-12, 2), p(10, -4)],
    crystal: p(0, 0),
    playerStart: p(5, -4),
    waves: [
      { theme: 'horde', paths: [0, 1] },
      { theme: 'ranged', paths: [0, 1] },
      { theme: 'swift', paths: [0, 1] },
      { theme: 'heavy', paths: [0, 1] },
      { theme: 'mixed', paths: [0, 1, 2] },
      { theme: 'elite', paths: [0, 1] },
      { theme: 'swift', paths: [0, 1, 2] },
      { theme: 'heavy', paths: [0, 1, 2] },
      { theme: 'mixed', paths: [0, 1, 2] },
      { theme: 'boss', paths: [0, 1, 2] },
    ],
    boss: 'boss_wyrm',
    upgradeAfter: [1, 3, 5, 7, 9],
    hpMul: 1.45,
    budgetMul: 1.22,
    startGold: 220,
    crystalHp: 1250,
    rewardShards: 130,
    unlockAfter: 'sunscorch',
  },
  {
    id: 'embermaw',
    name: 'Glutschlund',
    subtitle: 'Wo die Welt zerbricht',
    biome: 'volcano',
    difficulty: 4,
    desc: 'Drei Lavapfade, Meteoritenregen und der gewaltige Glutkoloss. Nur für erfahrene Verteidiger.',
    challenge: { id: 'meteors', name: 'Meteoritenregen', desc: 'Regelmäßig schlagen markierte Meteore ein – sie treffen Held und Gegner.' },
    paths: [
      [p(-36, -36), p(-36, -6), p(-18, -6), p(-18, 10), p(-4, 10), p(-2, 24)],
      [p(0, -38), p(0, -24), p(-8, -24), p(-8, -14), p(6, -14), p(6, 4), p(0, 4), p(0, 24)],
      [p(36, -36), p(36, -4), p(20, -4), p(20, 12), p(4, 12), p(2, 24)],
    ],
    pads: [p(-30, -14), p(-24, 2), p(-12, 4), p(-12, 18), p(-6, -30), p(-16, -18), p(12, -20), p(12, -2), p(28, 4), p(28, -20), p(12, 18), p(7, 31), p(-7, 31)],
    crystal: p(0, 28.5),
    playerStart: p(5, 25),
    waves: [
      { theme: 'horde', paths: [1] },
      { theme: 'swift', paths: [0, 2] },
      { theme: 'mixed', paths: [0, 1, 2] },
      { theme: 'ranged', paths: [0, 2] },
      { theme: 'heavy', paths: [1] },
      { theme: 'elite', paths: [0, 1, 2] },
      { theme: 'swift', paths: [0, 1, 2] },
      { theme: 'heavy', paths: [0, 2] },
      { theme: 'elite', paths: [0, 1, 2] },
      { theme: 'mixed', paths: [0, 1, 2] },
      { theme: 'boss', paths: [0, 1, 2] },
    ],
    boss: 'boss_colossus',
    upgradeAfter: [1, 3, 5, 7, 9],
    hpMul: 1.7,
    budgetMul: 1.32,
    startGold: 250,
    crystalHp: 1400,
    rewardShards: 180,
    unlockAfter: 'frostspire',
  },
];

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
