export type BiomeId = 'forest' | 'desert' | 'snow' | 'volcano';
export type DecorType = 'tree' | 'pine' | 'bush' | 'rock' | 'cactus' | 'deadtree' | 'snowpine' | 'icecrystal' | 'lavarock' | 'obelisk' | 'mushroom' | 'bones';
export type ParticleKind = 'leaves' | 'sand' | 'snow' | 'embers';

export interface DecorSpec {
  type: DecorType;
  count: number;
  scale: [number, number];
  colors: number[];
  /** Hindernis für Bewegungen (Kollision). */
  solid: boolean;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  groundLow: number;
  groundHigh: number;
  pathColor: number;
  pathEdge: number;
  cliff: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  skyTop: number;
  skyBottom: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  particle: ParticleKind;
  particleColor: number;
  pool?: { color: number; emissive: number; kind: 'water' | 'lava' | 'ice' };
  decor: DecorSpec[];
  enemyTint: number;
  accent: string;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Wald',
    groundLow: 0x3f7a3a,
    groundHigh: 0x77a94a,
    pathColor: 0x9a7b4f,
    pathEdge: 0x6e5a3a,
    cliff: 0x5d6b4a,
    fog: 0x9cc7b6,
    fogNear: 45,
    fogFar: 135,
    skyTop: 0x5fa8d3,
    skyBottom: 0xcfe9d8,
    sun: 0xfff1d0,
    sunIntensity: 2.2,
    hemiSky: 0xcfe8ff,
    hemiGround: 0x3a5a2a,
    particle: 'leaves',
    particleColor: 0xb7e36b,
    pool: { color: 0x3fa7c9, emissive: 0x0b3b4a, kind: 'water' },
    decor: [
      { type: 'tree', count: 120, scale: [0.9, 1.6], colors: [0x2f7d3a, 0x3e9447, 0x5aa84a, 0x2b6b33], solid: true },
      { type: 'pine', count: 60, scale: [1, 1.8], colors: [0x24603a, 0x2f7a46], solid: true },
      { type: 'bush', count: 90, scale: [0.6, 1.2], colors: [0x4a8f3c, 0x6aa84f], solid: false },
      { type: 'rock', count: 45, scale: [0.6, 1.8], colors: [0x8a8f86, 0x6f756c], solid: true },
      { type: 'mushroom', count: 30, scale: [0.6, 1.1], colors: [0xd94b4b, 0xe7a33b], solid: false },
    ],
    enemyTint: 0x7c8a3c,
    accent: '#4ade80',
  },
  desert: {
    id: 'desert',
    name: 'Wüste',
    groundLow: 0xd9b26f,
    groundHigh: 0xeccb88,
    pathColor: 0xb98d55,
    pathEdge: 0x9b7442,
    cliff: 0xc08a52,
    fog: 0xf1d9a8,
    fogNear: 40,
    fogFar: 130,
    skyTop: 0x4aa3df,
    skyBottom: 0xf5e2b8,
    sun: 0xffe2a8,
    sunIntensity: 2.6,
    hemiSky: 0xfff0d0,
    hemiGround: 0x8a6a3a,
    particle: 'sand',
    particleColor: 0xf3d7a0,
    pool: { color: 0x2bb3b8, emissive: 0x0a3a3a, kind: 'water' },
    decor: [
      { type: 'cactus', count: 70, scale: [0.8, 1.6], colors: [0x4f8a3c, 0x3f7a35], solid: true },
      { type: 'rock', count: 80, scale: [0.8, 2.6], colors: [0xc58b55, 0xa86f42, 0xd9a066], solid: true },
      { type: 'deadtree', count: 25, scale: [0.8, 1.4], colors: [0x7a5a3a], solid: true },
      { type: 'bones', count: 25, scale: [0.8, 1.3], colors: [0xf1e6d0], solid: false },
      { type: 'obelisk', count: 6, scale: [1, 1.5], colors: [0xd6b77d], solid: true },
    ],
    enemyTint: 0x9a7a4a,
    accent: '#fbbf24',
  },
  snow: {
    id: 'snow',
    name: 'Schnee',
    groundLow: 0xdfeaf2,
    groundHigh: 0xf7fbff,
    pathColor: 0x9fb3c4,
    pathEdge: 0x8296a8,
    cliff: 0xa9bccb,
    fog: 0xdbe8f3,
    fogNear: 35,
    fogFar: 120,
    skyTop: 0x7aa7d6,
    skyBottom: 0xe8f1fa,
    sun: 0xe8f4ff,
    sunIntensity: 2.0,
    hemiSky: 0xe0f0ff,
    hemiGround: 0x8aa0b8,
    particle: 'snow',
    particleColor: 0xffffff,
    pool: { color: 0xa5d8f0, emissive: 0x16384a, kind: 'ice' },
    decor: [
      { type: 'snowpine', count: 150, scale: [0.9, 1.9], colors: [0x2f5d4a, 0x3a6b55], solid: true },
      { type: 'rock', count: 50, scale: [0.8, 2.2], colors: [0x8b9aab, 0x6f7f90], solid: true },
      { type: 'icecrystal', count: 35, scale: [0.6, 1.6], colors: [0x9ee7ff, 0x7dd3fc], solid: true },
    ],
    enemyTint: 0x5a7a9a,
    accent: '#7dd3fc',
  },
  volcano: {
    id: 'volcano',
    name: 'Vulkan',
    groundLow: 0x2b2522,
    groundHigh: 0x4a3a32,
    pathColor: 0x5b4438,
    pathEdge: 0x3a2a22,
    cliff: 0x3a2f2a,
    fog: 0x4a2a22,
    fogNear: 35,
    fogFar: 115,
    skyTop: 0x2a1418,
    skyBottom: 0x8a3a1e,
    sun: 0xffb27a,
    sunIntensity: 1.9,
    hemiSky: 0xff9a6a,
    hemiGround: 0x2a1010,
    particle: 'embers',
    particleColor: 0xff8a3a,
    pool: { color: 0xff5a1a, emissive: 0xff3a00, kind: 'lava' },
    decor: [
      { type: 'lavarock', count: 110, scale: [0.8, 2.6], colors: [0x2f2724, 0x3d322c], solid: true },
      { type: 'deadtree', count: 40, scale: [0.8, 1.5], colors: [0x1f1a17, 0x2b2420], solid: true },
      { type: 'obelisk', count: 10, scale: [1, 1.8], colors: [0x1c1917], solid: true },
      { type: 'bones', count: 20, scale: [0.8, 1.4], colors: [0xc8bba8], solid: false },
    ],
    enemyTint: 0x6b2a20,
    accent: '#fb923c',
  },
};
