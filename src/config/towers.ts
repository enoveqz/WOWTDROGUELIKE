export type TowerId = 'arrow' | 'arcane' | 'frost';

export interface TowerLevel {
  damage: number;
  /** Angriffe bzw. Pulse pro Sekunde. */
  rate: number;
  range: number;
  splash?: number;
  slow?: number;
  slowDuration?: number;
  freezeChance?: number;
  multishot?: number;
  burn?: number;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  upgradeCost: [number, number];
  levels: [TowerLevel, TowerLevel, TowerLevel];
  color: string;
}

export const TOWERS: Record<TowerId, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: 'Pfeilturm',
    desc: 'Schnelle Einzelschüsse auf den Gegner, der dem Kristall am nächsten ist. Stufe 3: Doppelschuss.',
    icon: 'tower',
    cost: 60,
    upgradeCost: [70, 120],
    levels: [
      { damage: 11, rate: 1.4, range: 11 },
      { damage: 18, rate: 1.6, range: 12 },
      { damage: 28, rate: 1.9, range: 13, multishot: 2 },
    ],
    color: '#fbbf24',
  },
  arcane: {
    id: 'arcane',
    name: 'Arkanturm',
    desc: 'Langsame, wuchtige Arkangeschosse mit Flächenschaden. Stufe 3: Ziele brennen nach.',
    icon: 'gem',
    cost: 90,
    upgradeCost: [100, 160],
    levels: [
      { damage: 24, rate: 0.6, range: 10, splash: 2.5 },
      { damage: 36, rate: 0.7, range: 11, splash: 3 },
      { damage: 56, rate: 0.8, range: 12, splash: 3.5, burn: 8 },
    ],
    color: '#a78bfa',
  },
  frost: {
    id: 'frost',
    name: 'Frostobelisk',
    desc: 'Sendet eisige Pulse aus, die alle Gegner im Umkreis verlangsamen. Stufe 3: Chance zu gefrieren.',
    icon: 'frost',
    cost: 75,
    upgradeCost: [80, 130],
    levels: [
      { damage: 4, rate: 0.8, range: 7, slow: 0.35, slowDuration: 1.6 },
      { damage: 7, rate: 0.9, range: 8, slow: 0.45, slowDuration: 1.8 },
      { damage: 12, rate: 1.0, range: 9, slow: 0.55, slowDuration: 2, freezeChance: 0.12 },
    ],
    color: '#67e8f9',
  },
};

export const TOWER_ORDER: TowerId[] = ['arrow', 'arcane', 'frost'];
export const SELL_REFUND = 0.6;

export function towerInvested(def: TowerDef, level: number): number {
  let total = def.cost;
  for (let i = 0; i < level - 1; i++) total += def.upgradeCost[i];
  return total;
}
