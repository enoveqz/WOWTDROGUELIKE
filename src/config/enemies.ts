export type EnemyId =
  | 'grunt'
  | 'archer'
  | 'runner'
  | 'brute'
  | 'shaman'
  | 'elite'
  | 'boss_treant'
  | 'boss_scarab'
  | 'boss_wyrm'
  | 'boss_colossus';

export type EnemyModel = 'grunt' | 'archer' | 'runner' | 'brute' | 'shaman' | 'elite' | 'treant' | 'scarab' | 'wyrm' | 'colossus';
export type BossAbility = 'slam' | 'summon' | 'charge' | 'breath' | 'meteor' | 'enrage';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  role: string;
  model: EnemyModel;
  hp: number;
  speed: number;
  damage: number;
  /** Angriffe pro Sekunde. */
  attackRate: number;
  range: number;
  armor: number;
  gold: number;
  radius: number;
  scale: number;
  ranged: boolean;
  elite: boolean;
  boss: boolean;
  /** Budget-Kosten für den Wellengenerator. */
  cost: number;
  /** Reichweite, in der der Held angegriffen wird. */
  aggro: number;
  color: number;
  abilities?: BossAbility[];
  summon?: EnemyId;
}

const base = {
  armor: 0,
  ranged: false,
  elite: false,
  boss: false,
  scale: 1,
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  grunt: { ...base, id: 'grunt', name: 'Morling-Krieger', role: 'Nahkämpfer', model: 'grunt', hp: 62, speed: 3.2, damage: 8, attackRate: 1, range: 1.6, gold: 6, radius: 0.6, cost: 1, aggro: 5, color: 0x7c8a3c },
  archer: { ...base, id: 'archer', name: 'Morling-Speerwerfer', role: 'Fernkämpfer', model: 'archer', hp: 44, speed: 3.0, damage: 7, attackRate: 0.7, range: 9, gold: 7, radius: 0.55, ranged: true, cost: 1.2, aggro: 10, color: 0x6b7f9a },
  runner: { ...base, id: 'runner', name: 'Schattenhetzer', role: 'Schnell', model: 'runner', hp: 36, speed: 6.3, damage: 6, attackRate: 1.2, range: 1.4, gold: 5, radius: 0.55, cost: 0.8, aggro: 4, color: 0x4b3b6b },
  brute: { ...base, id: 'brute', name: 'Fels-Oger', role: 'Tank', model: 'brute', hp: 280, speed: 2.0, damage: 18, attackRate: 0.6, range: 2.3, armor: 0.3, gold: 18, radius: 1.1, scale: 1, cost: 4, aggro: 5, color: 0x8b6f5a },
  shaman: { ...base, id: 'shaman', name: 'Fluchwirker', role: 'Elite · Heiler', model: 'shaman', hp: 130, speed: 2.6, damage: 9, attackRate: 0.6, range: 8, gold: 15, radius: 0.7, ranged: true, elite: true, cost: 4, aggro: 9, color: 0x7e22ce },
  elite: { ...base, id: 'elite', name: 'Verderbter Champion', role: 'Elite · Anführer', model: 'elite', hp: 430, speed: 2.6, damage: 20, attackRate: 0.8, range: 2.4, armor: 0.3, gold: 40, radius: 1.0, elite: true, cost: 10, aggro: 6, color: 0x9f1239 },
  boss_treant: {
    ...base, id: 'boss_treant', name: 'Morgrath, der Verdorrte', role: 'Boss', model: 'treant', hp: 4200, speed: 1.4, damage: 42, attackRate: 0.5, range: 3.4, armor: 0.25, gold: 200, radius: 2.2, boss: true, cost: 0, aggro: 9, color: 0x5b4636,
    abilities: ['slam', 'summon'], summon: 'grunt',
  },
  boss_scarab: {
    ...base, id: 'boss_scarab', name: 'Khepra, Herr der Dünen', role: 'Boss', model: 'scarab', hp: 5400, speed: 1.8, damage: 46, attackRate: 0.55, range: 3.2, armor: 0.35, gold: 240, radius: 2.3, boss: true, cost: 0, aggro: 10, color: 0x1e6f78,
    abilities: ['charge', 'summon', 'slam'], summon: 'runner',
  },
  boss_wyrm: {
    ...base, id: 'boss_wyrm', name: 'Valdris, die Frostschwinge', role: 'Boss', model: 'wyrm', hp: 6400, speed: 1.6, damage: 50, attackRate: 0.5, range: 3.6, armor: 0.25, gold: 280, radius: 2.4, boss: true, cost: 0, aggro: 12, color: 0x7dd3fc,
    abilities: ['breath', 'slam', 'summon'], summon: 'archer',
  },
  boss_colossus: {
    ...base, id: 'boss_colossus', name: 'Pyrax, der Glutkoloss', role: 'Boss', model: 'colossus', hp: 8200, speed: 1.3, damage: 58, attackRate: 0.5, range: 3.8, armor: 0.3, gold: 340, radius: 2.6, boss: true, cost: 0, aggro: 10, color: 0x3f3f46,
    abilities: ['slam', 'meteor', 'summon', 'enrage'], summon: 'brute',
  },
};

export interface EliteAffix {
  id: string;
  name: string;
  hpMul: number;
  speedMul: number;
  armorAdd: number;
  scaleMul: number;
}

export const ELITE_AFFIXES: EliteAffix[] = [
  { id: 'armored', name: 'Gepanzert', hpMul: 1.2, speedMul: 1, armorAdd: 0.25, scaleMul: 1.08 },
  { id: 'frenzied', name: 'Rasend', hpMul: 1.1, speedMul: 1.35, armorAdd: 0, scaleMul: 1.05 },
  { id: 'giant', name: 'Riesig', hpMul: 1.8, speedMul: 0.9, armorAdd: 0.05, scaleMul: 1.3 },
];
