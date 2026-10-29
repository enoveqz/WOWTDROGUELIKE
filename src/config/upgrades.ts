import type { Rng } from '../core/rng.ts';
import type { StatMod } from './stats.ts';

export type Rarity = 'common' | 'rare' | 'epic' | 'relic';
export type UpgradeTag = 'klinge' | 'turm' | 'frost' | 'feuer' | 'arkan' | 'reittier' | 'schutz' | 'tempo' | 'gold' | 'rasse';

/**
 * Spielmechanische Flags, die von den Systemen ausgewertet werden
 * (z. B. "chillOnHit" im Schadenssystem).
 */
export type UpgradeFlag =
  | 'burnOnSkill'
  | 'chillOnHit'
  | 'shatter'
  | 'burnSpread'
  | 'crystalWard'
  | 'towerAura'
  | 'chargeStun'
  | 'fastCharge'
  | 'goldenCompass'
  | 'noRegen'
  | 'thorns';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  tags: UpgradeTag[];
  mods: StatMod[];
  flags?: UpgradeFlag[];
  maxStacks: number;
  /** Nur anbieten, wenn eine Bedingung erfüllt ist (z. B. Klasse). */
  requires?: { classId?: string };
}

export const RARITY_INFO: Record<Rarity, { name: string; weight: number; color: string }> = {
  common: { name: 'Gewöhnlich', weight: 10, color: '#94a3b8' },
  rare: { name: 'Selten', weight: 4.2, color: '#38bdf8' },
  epic: { name: 'Episch', weight: 1.6, color: '#c084fc' },
  relic: { name: 'Relikt', weight: 0.9, color: '#fb923c' },
};

export const UPGRADES: UpgradeDef[] = [
  // ── Gewöhnlich ────────────────────────────────────────────────
  { id: 'sharp', name: 'Geschärfte Klingen', desc: '+12 % Angriffskraft.', icon: 'sword', rarity: 'common', tags: ['klinge'], mods: [{ stat: 'power', mul: 0.12 }], maxStacks: 3 },
  { id: 'hands', name: 'Flinke Hände', desc: '+12 % Angriffstempo.', icon: 'whirl', rarity: 'common', tags: ['klinge', 'tempo'], mods: [{ stat: 'attackSpeed', mul: 0.12 }], maxStacks: 3 },
  { id: 'tough', name: 'Robustheit', desc: '+15 % Leben, +1,5 Lebensregeneration.', icon: 'heart', rarity: 'common', tags: ['schutz'], mods: [{ stat: 'maxHp', mul: 0.15 }, { stat: 'hpRegen', add: 1.5 }], maxStacks: 3 },
  { id: 'swift', name: 'Leichtfüßig', desc: '+8 % Bewegungstempo, −15 % Ausweich-Abklingzeit.', icon: 'wind', rarity: 'common', tags: ['tempo'], mods: [{ stat: 'moveSpeed', mul: 0.08 }, { stat: 'dodgeCdr', add: 0.15 }], maxStacks: 2 },
  { id: 'depth', name: 'Arkane Tiefe', desc: '+15 % maximale Ressource, +20 % Regeneration.', icon: 'sparkle', rarity: 'common', tags: ['arkan'], mods: [{ stat: 'maxRes', mul: 0.15 }, { stat: 'resRegen', mul: 0.2 }], maxStacks: 3 },
  { id: 'focus', name: 'Fokussierter Geist', desc: '8 % kürzere Abklingzeiten.', icon: 'clock', rarity: 'common', tags: ['arkan'], mods: [{ stat: 'cdr', add: 0.08 }], maxStacks: 3 },
  { id: 'precision', name: 'Kalte Präzision', desc: '+6 % kritische Trefferchance.', icon: 'eye', rarity: 'common', tags: ['klinge'], mods: [{ stat: 'crit', add: 0.06 }], maxStacks: 3 },
  { id: 'builder', name: 'Baumeister', desc: 'Türme kosten 12 % weniger.', icon: 'hammer', rarity: 'common', tags: ['turm', 'gold'], mods: [{ stat: 'towerCost', mul: -0.12 }], maxStacks: 2 },
  { id: 'bolts', name: 'Verstärkte Bolzen', desc: '+15 % Turmschaden.', icon: 'tower', rarity: 'common', tags: ['turm'], mods: [{ stat: 'towerDmg', mul: 0.15 }], maxStacks: 3 },
  { id: 'greed', name: 'Goldgier', desc: '+20 % Goldertrag.', icon: 'coin', rarity: 'common', tags: ['gold'], mods: [{ stat: 'gold', mul: 0.2 }], maxStacks: 3 },
  { id: 'ember', name: 'Glühende Glut', desc: 'Fähigkeiten setzen Ziele in Brand. +8 % Fähigkeitsstärke.', icon: 'flame', rarity: 'common', tags: ['feuer'], mods: [{ stat: 'skillPower', mul: 0.08 }], flags: ['burnOnSkill'], maxStacks: 2 },
  { id: 'chill', name: 'Frostsplitter', desc: 'Angriffe verlangsamen Ziele 1,5 s lang um 20 %.', icon: 'frost', rarity: 'common', tags: ['frost'], mods: [{ stat: 'power', mul: 0.04 }], flags: ['chillOnHit'], maxStacks: 1 },
  { id: 'saddle', name: 'Sattelgurt', desc: '+15 % Reittier-Tempo, +20 % Reittier-Angriffskraft.', icon: 'horse', rarity: 'common', tags: ['reittier', 'tempo'], mods: [{ stat: 'mountSpeed', mul: 0.15 }, { stat: 'mountPower', mul: 0.2 }], maxStacks: 2 },
  // ── Selten ───────────────────────────────────────────────────
  { id: 'reap', name: 'Wirbelnde Ernte', desc: '+15 % Flächenradius, +10 % Fähigkeitsstärke.', icon: 'whirl', rarity: 'rare', tags: ['arkan'], mods: [{ stat: 'aoe', mul: 0.15 }, { stat: 'skillPower', mul: 0.1 }], maxStacks: 2 },
  { id: 'vamp', name: 'Vampirische Schneide', desc: '+5 % Lebensraub auf allen Schaden des Helden.', icon: 'heart', rarity: 'rare', tags: ['klinge'], mods: [{ stat: 'lifesteal', add: 0.05 }], maxStacks: 2 },
  { id: 'resonance', name: 'Turmresonanz', desc: '+15 % Turm-Angriffstempo, +10 % Turmreichweite.', icon: 'tower', rarity: 'rare', tags: ['turm', 'arkan'], mods: [{ stat: 'towerRate', mul: 0.15 }, { stat: 'towerRange', mul: 0.1 }], maxStacks: 2 },
  { id: 'ancestors', name: 'Blut der Ahnen', desc: 'Rassenfähigkeit: −20 % Abklingzeit, +25 % Stärke.', icon: 'crown', rarity: 'rare', tags: ['rasse'], mods: [{ stat: 'racialCdr', add: 0.2 }, { stat: 'racialPower', mul: 0.25 }], maxStacks: 2 },
  { id: 'gallop', name: 'Stürmischer Galopp', desc: 'Reittier-Ansturm: −30 % Abklingzeit, +30 % Schaden.', icon: 'charge', rarity: 'rare', tags: ['reittier'], mods: [{ stat: 'mountPower', mul: 0.3 }], flags: ['fastCharge'], maxStacks: 1 },
  { id: 'shatter', name: 'Eiseskälte', desc: 'Verlangsamte Gegner erleiden 20 % mehr Schaden durch dich und Türme.', icon: 'frost', rarity: 'rare', tags: ['frost'], mods: [], flags: ['shatter'], maxStacks: 1 },
  { id: 'wildfire', name: 'Flammenzunge', desc: 'Brand verursacht 50 % mehr Schaden und springt beim Tod auf nahe Gegner über.', icon: 'flame', rarity: 'rare', tags: ['feuer'], mods: [{ stat: 'skillPower', mul: 0.05 }], flags: ['burnSpread'], maxStacks: 1 },
  { id: 'ward', name: 'Kristallschild', desc: 'Der Kristall erhält +20 % Leben und regeneriert zwischen den Wellen 1,5 %/s.', icon: 'crystal', rarity: 'rare', tags: ['schutz'], mods: [], flags: ['crystalWard'], maxStacks: 1 },
  { id: 'spikes', name: 'Dornenpanzer', desc: '+8 % Schadensreduktion. Nahkämpfer erleiden 40 % ihres Schadens selbst.', icon: 'shield', rarity: 'rare', tags: ['schutz'], mods: [{ stat: 'armor', add: 0.08 }], flags: ['thorns'], maxStacks: 1 },
  // ── Episch ───────────────────────────────────────────────────
  { id: 'warlord', name: 'Kriegsherr', desc: '+20 % Angriffskraft, +10 % Schadensreduktion.', icon: 'trophy', rarity: 'epic', tags: ['klinge', 'schutz'], mods: [{ stat: 'power', mul: 0.2 }, { stat: 'armor', add: 0.1 }], maxStacks: 1 },
  { id: 'aura', name: 'Arkanes Bollwerk', desc: 'Türme im Umkreis von 10 m um den Helden verursachen 30 % mehr Schaden.', icon: 'gem', rarity: 'epic', tags: ['turm', 'arkan'], mods: [{ stat: 'towerDmg', mul: 0.05 }], flags: ['towerAura'], maxStacks: 1 },
  { id: 'packlord', name: 'Rudelführer', desc: '+60 % Begleiterstärke. Der Reittier-Ansturm betäubt 1,2 s.', icon: 'paw', rarity: 'epic', tags: ['reittier'], mods: [{ stat: 'petPower', mul: 0.6 }, { stat: 'mountPower', mul: 0.15 }], flags: ['chargeStun'], maxStacks: 1 },
  { id: 'inferno', name: 'Inferno-Kern', desc: '+25 % Fähigkeitsstärke, +10 % Flächenradius. Fähigkeiten entzünden Ziele.', icon: 'flame', rarity: 'epic', tags: ['feuer', 'arkan'], mods: [{ stat: 'skillPower', mul: 0.25 }, { stat: 'aoe', mul: 0.1 }], flags: ['burnOnSkill'], maxStacks: 1 },
  // ── Relikte (stark, mit Kompromiss) ──────────────────────────
  { id: 'glasscannon', name: 'Glaskanonen-Amulett', desc: '+45 % Angriffskraft, aber −30 % Leben.', icon: 'gem', rarity: 'relic', tags: ['klinge'], mods: [{ stat: 'power', mul: 0.45 }, { stat: 'maxHp', mul: -0.3 }], maxStacks: 1 },
  { id: 'towerlord', name: 'Krone des Turmfürsten', desc: '+35 % Turmschaden, +20 % Turmtempo, aber −20 % Heldenschaden.', icon: 'crown', rarity: 'relic', tags: ['turm'], mods: [{ stat: 'towerDmg', mul: 0.35 }, { stat: 'towerRate', mul: 0.2 }, { stat: 'power', mul: -0.2 }], maxStacks: 1 },
  { id: 'aetherheart', name: 'Herz des Aethers', desc: '20 % kürzere Abklingzeiten, +50 % Ressourcen-Regeneration, aber −15 % Leben.', icon: 'crystal', rarity: 'relic', tags: ['arkan'], mods: [{ stat: 'cdr', add: 0.2 }, { stat: 'resRegen', mul: 0.5 }, { stat: 'maxHp', mul: -0.15 }], maxStacks: 1 },
  { id: 'bloodpact', name: 'Blutpakt-Siegel', desc: '+12 % Lebensraub, aber keine natürliche Lebensregeneration.', icon: 'skull', rarity: 'relic', tags: ['klinge'], mods: [{ stat: 'lifesteal', add: 0.12 }], flags: ['noRegen'], maxStacks: 1 },
  { id: 'compass', name: 'Goldener Kompass', desc: '+60 % Goldertrag, aber Gegner haben 12 % mehr Leben.', icon: 'coin', rarity: 'relic', tags: ['gold'], mods: [{ stat: 'gold', mul: 0.6 }], flags: ['goldenCompass'], maxStacks: 1 },
  { id: 'spurs', name: 'Sturmreiter-Sporen', desc: '+40 % Reittier-Tempo, +60 % Ansturmschaden, aber −10 % Angriffstempo.', icon: 'horse', rarity: 'relic', tags: ['reittier', 'tempo'], mods: [{ stat: 'mountSpeed', mul: 0.4 }, { stat: 'mountPower', mul: 0.6 }, { stat: 'attackSpeed', mul: -0.1 }], flags: ['fastCharge'], maxStacks: 1 },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// ── Synergien ───────────────────────────────────────────────────
export type SynergyId = 'bladeDance' | 'fortress' | 'permafrost' | 'wildfire' | 'aetherflow' | 'cavalry' | 'unyielding' | 'windrunner';

export interface SynergyDef {
  id: SynergyId;
  tag: UpgradeTag;
  need: number;
  name: string;
  desc: string;
  mods: StatMod[];
}

export const SYNERGIES: SynergyDef[] = [
  { id: 'bladeDance', tag: 'klinge', need: 3, name: 'Klingentanz', desc: 'Kritische Treffer heilen 1,5 % Leben.', mods: [] },
  { id: 'fortress', tag: 'turm', need: 3, name: 'Festungsnetz', desc: '+15 % Turm-Angriffstempo.', mods: [{ stat: 'towerRate', mul: 0.15 }] },
  { id: 'permafrost', tag: 'frost', need: 2, name: 'Permafrost', desc: 'Verlangsamungen sind 15 % stärker; Frostnova & Frostobelisk frieren länger ein.', mods: [] },
  { id: 'wildfire', tag: 'feuer', need: 2, name: 'Flächenbrand', desc: 'Brandschaden +60 %.', mods: [] },
  { id: 'aetherflow', tag: 'arkan', need: 3, name: 'Aetherfluss', desc: 'Fähigkeiten erstatten 25 % ihrer Kosten.', mods: [] },
  { id: 'cavalry', tag: 'reittier', need: 3, name: 'Kavallerie', desc: 'Nach dem Absitzen 4 s lang +25 % Schaden.', mods: [] },
  { id: 'unyielding', tag: 'schutz', need: 3, name: 'Unbeugsam', desc: '+12 % Schadensreduktion.', mods: [{ stat: 'armor', add: 0.12 }] },
  { id: 'windrunner', tag: 'tempo', need: 3, name: 'Windläufer', desc: '+10 % Bewegungstempo, −20 % Ausweich-Abklingzeit.', mods: [{ stat: 'moveSpeed', mul: 0.1 }, { stat: 'dodgeCdr', add: 0.2 }] },
];

export function tagCounts(taken: Record<string, number>): Partial<Record<UpgradeTag, number>> {
  const counts: Partial<Record<UpgradeTag, number>> = {};
  for (const [id, stacks] of Object.entries(taken)) {
    const def = UPGRADE_BY_ID[id];
    if (!def) continue;
    for (const t of def.tags) counts[t] = (counts[t] ?? 0) + stacks;
  }
  return counts;
}

export function activeSynergies(taken: Record<string, number>): SynergyDef[] {
  const counts = tagCounts(taken);
  return SYNERGIES.filter((s) => (counts[s.tag] ?? 0) >= s.need);
}

/**
 * Zieht drei unterschiedliche Upgrades. Bereits ausgereizte Upgrades werden
 * übersprungen; Synergie-Tags, die der Spieler bereits besitzt, erhalten
 * einen leichten Gewichtsbonus (kontrollierter Zufall statt reinem Glück).
 */
export function rollUpgradeOffer(
  rng: Rng,
  taken: Record<string, number>,
  opts: { count?: number; classId?: string; relicBonus?: number } = {},
): UpgradeDef[] {
  const count = opts.count ?? 3;
  const counts = tagCounts(taken);
  const pool = UPGRADES.filter((u) => {
    if ((taken[u.id] ?? 0) >= u.maxStacks) return false;
    if (u.requires?.classId && u.requires.classId !== opts.classId) return false;
    return true;
  });
  const offer: UpgradeDef[] = [];
  let hasRelic = false;
  while (offer.length < count && pool.length > 0) {
    const pickDef = rng.weighted(pool, (u) => {
      let w = RARITY_INFO[u.rarity].weight;
      if (u.rarity === 'relic') {
        if (hasRelic) return 0;
        w *= 1 + (opts.relicBonus ?? 0);
      }
      const synergyBonus = u.tags.reduce((acc, t) => acc + Math.min(2, counts[t] ?? 0), 0);
      return w * (1 + synergyBonus * 0.18);
    });
    if (!pickDef) break;
    if (pickDef.rarity === 'relic') hasRelic = true;
    offer.push(pickDef);
    pool.splice(pool.indexOf(pickDef), 1);
  }
  return offer;
}

// ── Run-Ereignisse ──────────────────────────────────────────────
export type RunEventId = 'calm' | 'bloodmoon' | 'aetherstorm' | 'goldvein' | 'elitehunt';

export interface RunEventDef {
  id: RunEventId;
  name: string;
  desc: string;
  icon: string;
  weight: number;
  enemyHpMul: number;
  enemySpeedMul: number;
  goldMul: number;
  shardMul: number;
  startGold: number;
  playerMods: StatMod[];
  extraElites: boolean;
}

export const RUN_EVENTS: RunEventDef[] = [
  { id: 'calm', name: 'Ruhige Winde', desc: 'Keine besonderen Vorkommnisse.', icon: 'wind', weight: 3, enemyHpMul: 1, enemySpeedMul: 1, goldMul: 1, shardMul: 1, startGold: 0, playerMods: [], extraElites: false },
  { id: 'bloodmoon', name: 'Blutmond', desc: 'Gegner sind 12 % schneller, lassen aber 30 % mehr Gold fallen.', icon: 'skull', weight: 2, enemyHpMul: 1, enemySpeedMul: 1.12, goldMul: 1.3, shardMul: 1.1, startGold: 0, playerMods: [], extraElites: false },
  { id: 'aetherstorm', name: 'Aethersturm', desc: 'Deine Abklingzeiten sind 15 % kürzer, Gegner haben 12 % mehr Leben.', icon: 'bolt', weight: 2, enemyHpMul: 1.12, enemySpeedMul: 1, goldMul: 1, shardMul: 1.1, startGold: 0, playerMods: [{ stat: 'cdr', add: 0.15 }], extraElites: false },
  { id: 'goldvein', name: 'Goldader', desc: 'Du startest mit 80 zusätzlichem Gold.', icon: 'coin', weight: 2, enemyHpMul: 1, enemySpeedMul: 1, goldMul: 1, shardMul: 1, startGold: 80, playerMods: [], extraElites: false },
  { id: 'elitehunt', name: 'Elitejagd', desc: 'Ab Welle 3 erscheint in jeder Welle ein zusätzlicher Elitegegner. +40 % Aethersplitter.', icon: 'trophy', weight: 1.5, enemyHpMul: 1, enemySpeedMul: 1, goldMul: 1.1, shardMul: 1.4, startGold: 0, playerMods: [], extraElites: true },
];

export function rollRunEvent(rng: Rng): RunEventDef {
  return rng.weighted(RUN_EVENTS, (e) => e.weight) ?? RUN_EVENTS[0];
}
