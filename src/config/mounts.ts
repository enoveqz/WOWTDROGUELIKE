export type MountId = 'horse' | 'wolf' | 'lizard';

export interface MountDef {
  id: MountId;
  name: string;
  desc: string;
  icon: string;
  /** Multiplikator auf das Bewegungstempo im Sattel. */
  speed: number;
  chargeName: string;
  chargeDesc: string;
  chargeDamage: number;
  chargeDistance: number;
  chargeCooldown: number;
  /** Zusätzliche Schadensreduktion im Sattel. */
  mountedArmor: number;
  unlockCost: number;
  colors: { body: number; accent: number; mane: number };
}

export const MOUNTS: Record<MountId, MountDef> = {
  horse: {
    id: 'horse',
    name: 'Sturmross',
    desc: 'Ein ausdauerndes Schlachtross aus den Valcrest-Ställen. Schnellstes Reittier.',
    icon: 'horse',
    speed: 1.75,
    chargeName: 'Niedertrampeln',
    chargeDesc: 'Galoppiert 10 m nach vorn, schleudert Gegner zurück (200 % Schaden).',
    chargeDamage: 2.0,
    chargeDistance: 10,
    chargeCooldown: 8,
    mountedArmor: 0,
    unlockCost: 0,
    colors: { body: 0x7a4a2a, accent: 0x9b1c1c, mane: 0x2a1a10 },
  },
  wolf: {
    id: 'wolf',
    name: 'Schattenwolf',
    desc: 'Ein riesiger Wolf der Nordwälder. Seine Bisse hinterlassen blutende Wunden.',
    icon: 'wolf',
    speed: 1.65,
    chargeName: 'Reißender Sprung',
    chargeDesc: 'Springt 9 m nach vorn (260 % Schaden) und lässt Ziele 4 s bluten.',
    chargeDamage: 2.6,
    chargeDistance: 9,
    chargeCooldown: 7,
    mountedArmor: 0.05,
    unlockCost: 100,
    colors: { body: 0x3d4250, accent: 0x7c3aed, mane: 0x1b1d24 },
  },
  lizard: {
    id: 'lizard',
    name: 'Glutechse',
    desc: 'Eine gepanzerte Feuerechse aus dem Glutschlund. Langsamer, aber zäh und brandgefährlich.',
    icon: 'lizard',
    speed: 1.55,
    chargeName: 'Flammenspur',
    chargeDesc: 'Prescht 9 m vor (220 % Schaden) und hinterlässt eine brennende Spur.',
    chargeDamage: 2.2,
    chargeDistance: 9,
    chargeCooldown: 8,
    mountedArmor: 0.15,
    unlockCost: 160,
    colors: { body: 0x9a3412, accent: 0xfbbf24, mane: 0x431407 },
  },
};

export const MOUNT_ORDER: MountId[] = ['horse', 'wolf', 'lizard'];

export const MOUNT_MAX_LEVEL = 10;
/** Erfahrung für Stufe n → n+1. */
export const mountXpForLevel = (level: number): number => 80 + level * 60;

export function mountLevelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (level < MOUNT_MAX_LEVEL && rest >= mountXpForLevel(level)) {
    rest -= mountXpForLevel(level);
    level++;
  }
  return { level, into: rest, need: level >= MOUNT_MAX_LEVEL ? 0 : mountXpForLevel(level) };
}

/** Pro Mount-Stufe: +2 % Tempo, +6 % Ansturmschaden. */
export const mountLevelBonus = (level: number) => ({ speed: (level - 1) * 0.02, power: (level - 1) * 0.06 });
