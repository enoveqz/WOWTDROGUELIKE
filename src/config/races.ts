import type { StatMod } from './stats.ts';

export type RaceId = 'human' | 'elf' | 'orc' | 'dwarf';

export interface RaceDef {
  id: RaceId;
  name: string;
  desc: string;
  passiveName: string;
  passiveDesc: string;
  activeName: string;
  activeDesc: string;
  activeIcon: string;
  cooldown: number;
  /** UI-Akzentfarbe und Effektfarbe der Rassenfähigkeit. */
  color: string;
  fx: number;
  mods: StatMod[];
  unlockCost: number;
  look: {
    skin: number;
    hair: number;
    height: number;
    bulk: number;
    ears: 'round' | 'pointy';
    tusks: boolean;
    beard: boolean;
  };
}

export const RACES: Record<RaceId, RaceDef> = {
  human: {
    id: 'human',
    name: 'Menschen von Valcrest',
    desc: 'Disziplinierte Krieger der Grenzlande. Vielseitig, robust und gut organisiert.',
    passiveName: 'Vielseitigkeit',
    passiveDesc: '+6 % Angriffskraft, +8 % Leben, +10 % Gold.',
    activeName: 'Wille der Krone',
    activeDesc: 'Entfernt Verlangsamungen, heilt 25 % Leben und gewährt 6 s lang +25 % Schaden.',
    activeIcon: 'crown',
    cooldown: 60,
    color: '#fbbf24',
    fx: 0xfbbf24,
    mods: [
      { stat: 'power', mul: 0.06 },
      { stat: 'maxHp', mul: 0.08 },
      { stat: 'gold', mul: 0.1 },
    ],
    unlockCost: 0,
    look: { skin: 0xe2b48c, hair: 0x5b3a22, height: 1, bulk: 1, ears: 'round', tusks: false, beard: false },
  },
  elf: {
    id: 'elf',
    name: 'Waldelfen der Sylvaren',
    desc: 'Hüter der uralten Haine. Präzise, schnell und mit der Natur verbunden.',
    passiveName: 'Elfengespür',
    passiveDesc: '+8 % kritische Trefferchance, +10 % Bewegungstempo, −5 % Leben.',
    activeName: 'Wurzelgriff',
    activeDesc: 'Wurzeln fesseln alle Gegner im Umkreis von 7 m für 3 s und verursachen Naturschaden.',
    activeIcon: 'leaf',
    cooldown: 40,
    color: '#34d399',
    fx: 0x34d399,
    mods: [
      { stat: 'crit', add: 0.08 },
      { stat: 'moveSpeed', mul: 0.1 },
      { stat: 'maxHp', mul: -0.05 },
    ],
    unlockCost: 0,
    look: { skin: 0xf0d2b4, hair: 0xe9e3c6, height: 1.06, bulk: 0.88, ears: 'pointy', tusks: false, beard: false },
  },
  orc: {
    id: 'orc',
    name: 'Grollhauer-Orks',
    desc: 'Stolze Clans der Aschensteppe. Wilde Kraft, die mit jeder Wunde wächst.',
    passiveName: 'Blutrausch',
    passiveDesc: '+10 % Leben. Bis zu +30 % Schaden, je weniger Leben du hast.',
    activeName: 'Kriegsstampfen',
    activeDesc: 'Erschüttert den Boden: betäubt Gegner im Umkreis von 6 m für 1,8 s (200 % Schaden).',
    activeIcon: 'fist',
    cooldown: 35,
    color: '#f97316',
    fx: 0xf97316,
    mods: [{ stat: 'maxHp', mul: 0.1 }],
    unlockCost: 0,
    look: { skin: 0x6f9a4a, hair: 0x1f1a17, height: 1.08, bulk: 1.22, ears: 'pointy', tusks: true, beard: false },
  },
  dwarf: {
    id: 'dwarf',
    name: 'Steinbart-Zwerge',
    desc: 'Meisterhafte Baumeister aus den Tiefenhallen. Zäh wie Granit, Freunde jeder Festung.',
    passiveName: 'Steinhaut & Ingenieurskunst',
    passiveDesc: '+10 % Schadensreduktion, +15 % Turmschaden.',
    activeName: 'Bergfestung',
    activeDesc: '6 s lang 60 % weniger Schaden; Türme im Umkreis von 14 m feuern 40 % schneller.',
    activeIcon: 'mountain',
    cooldown: 50,
    color: '#f59e0b',
    fx: 0xf59e0b,
    mods: [
      { stat: 'armor', add: 0.1 },
      { stat: 'towerDmg', mul: 0.15 },
    ],
    unlockCost: 120,
    look: { skin: 0xd9a17e, hair: 0xb4532a, height: 0.8, bulk: 1.25, ears: 'round', tusks: false, beard: true },
  },
};

export const RACE_ORDER: RaceId[] = ['human', 'elf', 'orc', 'dwarf'];
