/**
 * Zentrales Wertesystem. Endwert = (Basis + Σadd) × (1 + Σmul), danach Caps.
 * Rein funktional (kein Three.js) – daher direkt per Unit-Test prüfbar.
 */
export const STAT_KEYS = [
  'maxHp',
  'hpRegen',
  'maxRes',
  'resRegen',
  'power',
  'attackSpeed',
  'crit',
  'critDmg',
  'moveSpeed',
  'armor',
  'cdr',
  'lifesteal',
  'skillPower',
  'aoe',
  'towerDmg',
  'towerRate',
  'towerRange',
  'towerCost',
  'gold',
  'mountSpeed',
  'mountPower',
  'racialCdr',
  'racialPower',
  'petPower',
  'dodgeCdr',
  'healing',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type StatBlock = Record<StatKey, number>;

export interface StatMod {
  stat: StatKey;
  add?: number;
  mul?: number;
}

export const DEFAULT_STATS: StatBlock = {
  maxHp: 100,
  hpRegen: 1,
  maxRes: 100,
  resRegen: 8,
  power: 10,
  attackSpeed: 1,
  crit: 0.05,
  critDmg: 1.5,
  moveSpeed: 7,
  armor: 0,
  cdr: 0,
  lifesteal: 0,
  skillPower: 1,
  aoe: 1,
  towerDmg: 1,
  towerRate: 1,
  towerRange: 1,
  towerCost: 1,
  gold: 1,
  mountSpeed: 1,
  mountPower: 1,
  racialCdr: 0,
  racialPower: 1,
  petPower: 1,
  dodgeCdr: 0,
  healing: 1,
};

const CAPS: Partial<Record<StatKey, [number, number]>> = {
  crit: [0, 0.75],
  armor: [0, 0.7],
  cdr: [0, 0.5],
  racialCdr: [0, 0.5],
  dodgeCdr: [0, 0.5],
  lifesteal: [0, 0.3],
  towerCost: [0.5, 2],
  attackSpeed: [0.3, 3.5],
  moveSpeed: [2, 16],
  maxHp: [1, 99999],
};

export function computeStats(base: Partial<StatBlock>, mods: readonly StatMod[]): StatBlock {
  const add: Partial<Record<StatKey, number>> = {};
  const mul: Partial<Record<StatKey, number>> = {};
  for (const m of mods) {
    if (m.add) add[m.stat] = (add[m.stat] ?? 0) + m.add;
    if (m.mul) mul[m.stat] = (mul[m.stat] ?? 0) + m.mul;
  }
  const out = { ...DEFAULT_STATS } as StatBlock;
  for (const key of STAT_KEYS) {
    const b = base[key] ?? DEFAULT_STATS[key];
    let v = (b + (add[key] ?? 0)) * (1 + (mul[key] ?? 0));
    const cap = CAPS[key];
    if (cap) v = Math.min(cap[1], Math.max(cap[0], v));
    out[key] = v;
  }
  return out;
}

/** Deutschsprachige Labels und Formatierung für UI-Tooltips. */
export const STAT_LABELS: Record<StatKey, { label: string; pct: boolean }> = {
  maxHp: { label: 'Leben', pct: false },
  hpRegen: { label: 'Lebensregeneration/s', pct: false },
  maxRes: { label: 'Ressource', pct: false },
  resRegen: { label: 'Ressourcen-Regeneration/s', pct: false },
  power: { label: 'Angriffskraft', pct: false },
  attackSpeed: { label: 'Angriffstempo', pct: true },
  crit: { label: 'Kritische Trefferchance', pct: true },
  critDmg: { label: 'Kritischer Schaden', pct: true },
  moveSpeed: { label: 'Bewegungstempo', pct: false },
  armor: { label: 'Schadensreduktion', pct: true },
  cdr: { label: 'Abklingzeitverkürzung', pct: true },
  lifesteal: { label: 'Lebensraub', pct: true },
  skillPower: { label: 'Fähigkeitsstärke', pct: true },
  aoe: { label: 'Flächenradius', pct: true },
  towerDmg: { label: 'Turmschaden', pct: true },
  towerRate: { label: 'Turm-Angriffstempo', pct: true },
  towerRange: { label: 'Turmreichweite', pct: true },
  towerCost: { label: 'Turmkosten', pct: true },
  gold: { label: 'Goldertrag', pct: true },
  mountSpeed: { label: 'Reittier-Tempo', pct: true },
  mountPower: { label: 'Reittier-Angriffskraft', pct: true },
  racialCdr: { label: 'Rassenfähigkeit-Abklingzeit', pct: true },
  racialPower: { label: 'Rassenfähigkeit-Stärke', pct: true },
  petPower: { label: 'Begleiterstärke', pct: true },
  dodgeCdr: { label: 'Ausweich-Abklingzeit', pct: true },
  healing: { label: 'Heilungseffekte', pct: true },
};

/** Lesbare Beschreibung eines Modifikators, z. B. "+12 % Turmschaden". */
export function describeMod(m: StatMod): string {
  const meta = STAT_LABELS[m.stat];
  const parts: string[] = [];
  if (m.add) {
    const v = meta.pct ? `${Math.round(m.add * 100)} %` : `${Math.round(m.add * 10) / 10}`;
    parts.push(`${m.add > 0 ? '+' : ''}${v} ${meta.label}`);
  }
  if (m.mul) {
    parts.push(`${m.mul > 0 ? '+' : ''}${Math.round(m.mul * 100)} % ${meta.label}`);
  }
  return parts.join(', ');
}
