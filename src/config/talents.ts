import type { StatMod } from './stats.ts';

export type TalentTree = 'class' | 'race' | 'mount';
export type TalentFlag = 'signature' | 'racialAwaken' | 'quickMount' | 'chargeCdr' | 'riderLegend';

export interface TalentDef {
  id: string;
  tree: TalentTree;
  name: string;
  desc: string;
  icon: string;
  maxRank: number;
  /** Position im Baum (Reihe 0–3, Spalte 0–2). */
  row: number;
  col: number;
  requires: { id: string; rank: number }[];
  /** Mindestens so viele Punkte im selben Baum. */
  treePoints: number;
  modsPerRank: StatMod[];
  flag?: TalentFlag;
}

export const TREE_INFO: Record<TalentTree, { name: string; desc: string; color: string; icon: string }> = {
  class: { name: 'Kampfkunst', desc: 'Klassen-Talente – wirken auf alle Klassen und verstärken die Signaturfähigkeit.', color: '#22d3ee', icon: 'sword' },
  race: { name: 'Erbe', desc: 'Rassen-Talente – verstärken Rassenfähigkeiten, Heilung und Baukunst.', color: '#a78bfa', icon: 'crown' },
  mount: { name: 'Reitkunst', desc: 'Reittier-Talente – mehr Tempo, stärkere Ansturmangriffe und schnelleres Aufsitzen.', color: '#2dd4bf', icon: 'horse' },
};

export const TALENTS: TalentDef[] = [
  // ── Kampfkunst ─────────────────────────────────────────────
  { id: 'k_power', tree: 'class', name: 'Waffenmeisterschaft', desc: '+4 % Angriffskraft pro Rang.', icon: 'sword', maxRank: 3, row: 0, col: 0, requires: [], treePoints: 0, modsPerRank: [{ stat: 'power', mul: 0.04 }] },
  { id: 'k_vital', tree: 'class', name: 'Zähigkeit', desc: '+6 % Leben pro Rang.', icon: 'heart', maxRank: 3, row: 0, col: 2, requires: [], treePoints: 0, modsPerRank: [{ stat: 'maxHp', mul: 0.06 }] },
  { id: 'k_crit', tree: 'class', name: 'Präzision', desc: '+3 % kritische Trefferchance pro Rang.', icon: 'eye', maxRank: 2, row: 1, col: 0, requires: [{ id: 'k_power', rank: 1 }], treePoints: 2, modsPerRank: [{ stat: 'crit', add: 0.03 }] },
  { id: 'k_haste', tree: 'class', name: 'Kampfrhythmus', desc: '+5 % Angriffstempo pro Rang.', icon: 'whirl', maxRank: 2, row: 1, col: 1, requires: [{ id: 'k_power', rank: 2 }], treePoints: 2, modsPerRank: [{ stat: 'attackSpeed', mul: 0.05 }] },
  { id: 'k_focus', tree: 'class', name: 'Konzentration', desc: '3 % kürzere Abklingzeiten pro Rang.', icon: 'clock', maxRank: 3, row: 1, col: 2, requires: [{ id: 'k_vital', rank: 1 }], treePoints: 2, modsPerRank: [{ stat: 'cdr', add: 0.03 }] },
  { id: 'k_skill', tree: 'class', name: 'Fähigkeitsfokus', desc: '+6 % Fähigkeitsstärke und +4 % Flächenradius pro Rang.', icon: 'sparkle', maxRank: 2, row: 2, col: 1, requires: [{ id: 'k_haste', rank: 1 }], treePoints: 5, modsPerRank: [{ stat: 'skillPower', mul: 0.06 }, { stat: 'aoe', mul: 0.04 }] },
  { id: 'k_sig', tree: 'class', name: 'Signaturmeister', desc: 'Signaturfähigkeit (Taste 4): +35 % Schaden, −20 % Abklingzeit.', icon: 'star', maxRank: 1, row: 3, col: 1, requires: [{ id: 'k_skill', rank: 1 }], treePoints: 8, modsPerRank: [], flag: 'signature' },
  // ── Erbe ────────────────────────────────────────────────────
  { id: 'r_power', tree: 'race', name: 'Ahnenkraft', desc: '+10 % Stärke der Rassenfähigkeit pro Rang.', icon: 'crown', maxRank: 3, row: 0, col: 0, requires: [], treePoints: 0, modsPerRank: [{ stat: 'racialPower', mul: 0.1 }] },
  { id: 'r_gold', tree: 'race', name: 'Kriegsbeute', desc: '+6 % Goldertrag pro Rang.', icon: 'coin', maxRank: 3, row: 0, col: 2, requires: [], treePoints: 0, modsPerRank: [{ stat: 'gold', mul: 0.06 }] },
  { id: 'r_cd', tree: 'race', name: 'Ahnenruf', desc: '−8 % Abklingzeit der Rassenfähigkeit pro Rang.', icon: 'clock', maxRank: 3, row: 1, col: 0, requires: [{ id: 'r_power', rank: 1 }], treePoints: 2, modsPerRank: [{ stat: 'racialCdr', add: 0.08 }] },
  { id: 'r_regen', tree: 'race', name: 'Erneuerung', desc: '+1 Lebensregeneration und +8 % Heilung pro Rang.', icon: 'leaf', maxRank: 2, row: 1, col: 1, requires: [], treePoints: 2, modsPerRank: [{ stat: 'hpRegen', add: 1 }, { stat: 'healing', mul: 0.08 }] },
  { id: 'r_tower', tree: 'race', name: 'Ingenieurskunst', desc: '+5 % Turmschaden und −3 % Turmkosten pro Rang.', icon: 'hammer', maxRank: 3, row: 1, col: 2, requires: [{ id: 'r_gold', rank: 1 }], treePoints: 2, modsPerRank: [{ stat: 'towerDmg', mul: 0.05 }, { stat: 'towerCost', mul: -0.03 }] },
  { id: 'r_tough', tree: 'race', name: 'Ahnenschild', desc: '+4 % Schadensreduktion pro Rang.', icon: 'shield', maxRank: 2, row: 2, col: 1, requires: [{ id: 'r_regen', rank: 1 }], treePoints: 5, modsPerRank: [{ stat: 'armor', add: 0.04 }] },
  { id: 'r_awaken', tree: 'race', name: 'Erwachtes Blut', desc: 'Die Rassenfähigkeit gewährt zusätzlich 5 s lang +25 % Angriffstempo.', icon: 'star', maxRank: 1, row: 3, col: 1, requires: [{ id: 'r_tough', rank: 1 }], treePoints: 8, modsPerRank: [], flag: 'racialAwaken' },
  // ── Reitkunst ───────────────────────────────────────────────
  { id: 'm_speed', tree: 'mount', name: 'Reiterpraxis', desc: '+6 % Reittier-Tempo pro Rang.', icon: 'wind', maxRank: 3, row: 0, col: 0, requires: [], treePoints: 0, modsPerRank: [{ stat: 'mountSpeed', mul: 0.06 }] },
  { id: 'm_power', tree: 'mount', name: 'Lanzenstoß', desc: '+10 % Ansturmschaden pro Rang.', icon: 'charge', maxRank: 3, row: 0, col: 2, requires: [], treePoints: 0, modsPerRank: [{ stat: 'mountPower', mul: 0.1 }] },
  { id: 'm_quick', tree: 'mount', name: 'Schnelles Aufsitzen', desc: 'Aufsitzen erfolgt sofort statt nach 0,6 s.', icon: 'clock', maxRank: 1, row: 1, col: 0, requires: [{ id: 'm_speed', rank: 1 }], treePoints: 1, modsPerRank: [], flag: 'quickMount' },
  { id: 'm_charge', tree: 'mount', name: 'Sturmritt', desc: '−15 % Abklingzeit des Ansturms pro Rang.', icon: 'bolt', maxRank: 2, row: 1, col: 2, requires: [{ id: 'm_power', rank: 1 }], treePoints: 2, modsPerRank: [], flag: 'chargeCdr' },
  { id: 'm_pet', tree: 'mount', name: 'Tierbande', desc: '+12 % Begleiterstärke und +3 % Bewegungstempo pro Rang.', icon: 'paw', maxRank: 2, row: 2, col: 1, requires: [], treePoints: 4, modsPerRank: [{ stat: 'petPower', mul: 0.12 }, { stat: 'moveSpeed', mul: 0.03 }] },
  { id: 'm_legend', tree: 'mount', name: 'Reiterlegende', desc: 'Ansturm betäubt 1,2 s. Nach dem Absitzen 4 s lang +25 % Schaden.', icon: 'star', maxRank: 1, row: 3, col: 1, requires: [{ id: 'm_pet', rank: 1 }], treePoints: 7, modsPerRank: [], flag: 'riderLegend' },
];

export const TALENT_BY_ID: Record<string, TalentDef> = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

export function treePointsSpent(ranks: Record<string, number>, tree: TalentTree): number {
  let sum = 0;
  for (const t of TALENTS) if (t.tree === tree) sum += ranks[t.id] ?? 0;
  return sum;
}

export function canRankUp(ranks: Record<string, number>, id: string, freePoints: number): { ok: boolean; reason?: string } {
  const t = TALENT_BY_ID[id];
  if (!t) return { ok: false, reason: 'Unbekanntes Talent' };
  const cur = ranks[id] ?? 0;
  if (cur >= t.maxRank) return { ok: false, reason: 'Maximaler Rang erreicht' };
  if (freePoints <= 0) return { ok: false, reason: 'Keine freien Talentpunkte' };
  if (treePointsSpent(ranks, t.tree) < t.treePoints) return { ok: false, reason: `Benötigt ${t.treePoints} Punkte in diesem Baum` };
  for (const r of t.requires) {
    if ((ranks[r.id] ?? 0) < r.rank) return { ok: false, reason: `Benötigt ${TALENT_BY_ID[r.id]?.name ?? r.id} Rang ${r.rank}` };
  }
  return { ok: true };
}

export function talentMods(ranks: Record<string, number>): StatMod[] {
  const mods: StatMod[] = [];
  for (const t of TALENTS) {
    const r = ranks[t.id] ?? 0;
    if (!r) continue;
    for (const m of t.modsPerRank) mods.push({ stat: m.stat, add: m.add ? m.add * r : undefined, mul: m.mul ? m.mul * r : undefined });
  }
  return mods;
}

export function talentFlagRank(ranks: Record<string, number>, flag: TalentFlag): number {
  let r = 0;
  for (const t of TALENTS) if (t.flag === flag) r += ranks[t.id] ?? 0;
  return r;
}

// ── Fortschritt: Fähigkeiten werden nach und nach erlernt (MMORPG-typisch) ──
/** Kontostufe, ab der Fähigkeit 1–4 verfügbar ist. */
export const SKILL_UNLOCK_LEVEL = [1, 1, 2, 3] as const;
export const RACIAL_UNLOCK_LEVEL = 2;

// ── Kontostufe → Talentpunkte ─────────────────────────────────
export const accountXpForLevel = (level: number): number => 140 + (level - 1) * 70;

export function accountLevelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (rest >= accountXpForLevel(level)) {
    rest -= accountXpForLevel(level);
    level++;
  }
  return { level, into: rest, need: accountXpForLevel(level) };
}

// ── Dauerhafte Boni (mit Aethersplittern kaufbar) ─────────────
export interface MetaBoonDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  maxRank: number;
  cost: (rank: number) => number;
}

export const META_BOONS: MetaBoonDef[] = [
  { id: 'crystal', name: 'Kristallsegen', desc: '+10 % Leben des Aetherkristalls pro Rang.', icon: 'crystal', maxRank: 5, cost: (r) => 40 + r * 30 },
  { id: 'gold', name: 'Startkapital', desc: '+25 Startgold pro Rang.', icon: 'coin', maxRank: 4, cost: (r) => 35 + r * 30 },
  { id: 'shards', name: 'Aetherkunde', desc: '+8 % Aethersplitter pro Rang.', icon: 'gem', maxRank: 5, cost: (r) => 50 + r * 40 },
  { id: 'reroll', name: 'Schicksalsweber', desc: '+1 Neuwurf der Upgrade-Auswahl pro Run und Rang.', icon: 'sparkle', maxRank: 3, cost: (r) => 60 + r * 50 },
  { id: 'tome', name: 'Talentfoliant', desc: '+1 zusätzlicher Talentpunkt pro Rang.', icon: 'book', maxRank: 6, cost: (r) => 70 + r * 45 },
];
