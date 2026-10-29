import type { StatBlock } from './stats.ts';

export type ClassId = 'warrior' | 'mage' | 'rogue' | 'ranger';
export type Element = 'physical' | 'fire' | 'frost' | 'arcane' | 'nature' | 'shadow';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cooldown: number;
  cost: number;
}

export interface BasicAttackDef {
  kind: 'melee' | 'projectile';
  range: number;
  /** Öffnungswinkel (rad) für Nahkampf-Hiebe. */
  arc: number;
  /** Sekunden zwischen Angriffen bei Angriffstempo 1. */
  interval: number;
  damageMul: number;
  projectileSpeed: number;
  element: Element;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  desc: string;
  icon: string;
  color: string;
  resource: { name: string; color: string; onHit: number; startFull: boolean };
  base: Partial<StatBlock>;
  attack: BasicAttackDef;
  skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  unlockCost: number;
  /** Visuelle Ausrüstung des prozeduralen Modells. */
  gear: 'sword' | 'staff' | 'daggers' | 'bow';
  armorColor: number;
  trimColor: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Krieger',
    role: 'Nahkampf · Verteidigung',
    desc: 'Hält die Linie mit Schwert und Schild. Teilt Flächenschaden aus, blockt Angriffe und stürmt in feindliche Reihen.',
    icon: 'sword',
    color: '#f87171',
    resource: { name: 'Wut', color: '#ef4444', onHit: 9, startFull: false },
    base: { maxHp: 165, hpRegen: 2, maxRes: 100, resRegen: 3, power: 14, armor: 0.15, moveSpeed: 7, attackSpeed: 1, crit: 0.05 },
    attack: { kind: 'melee', range: 2.9, arc: 2.3, interval: 0.75, damageMul: 1.0, projectileSpeed: 0, element: 'physical' },
    skills: [
      { id: 'whirl', name: 'Wirbelklinge', desc: 'Wirbelt herum und trifft alle Gegner im Umkreis (4 m) für 160 % Angriffskraft.', icon: 'whirl', cooldown: 6, cost: 25 },
      { id: 'bulwark', name: 'Bollwerk', desc: '4 s lang 50 % weniger Schaden, wirft 30 % des Schadens zurück und zieht nahe Gegner auf dich.', icon: 'shield', cooldown: 15, cost: 20 },
      { id: 'charge', name: 'Sturmangriff', desc: 'Stürmt 9 m nach vorn, trifft alle Gegner auf dem Weg (120 %) und betäubt sie 1 s.', icon: 'charge', cooldown: 9, cost: 15 },
      { id: 'earthsplit', name: 'Erdspalter', desc: 'Spaltet den Boden in einem 7-m-Kegel: 300 % Schaden und 50 % Verlangsamung für 3 s.', icon: 'axe', cooldown: 16, cost: 40 },
    ],
    unlockCost: 0,
    gear: 'sword',
    armorColor: 0x8a94a6,
    trimColor: 0xc9a227,
  },
  mage: {
    id: 'mage',
    name: 'Magier',
    role: 'Fernkampf · Elementar · Kontrolle',
    desc: 'Beherrscht Feuer, Frost und Blitz. Zerstört Gruppen aus der Distanz und friert gefährliche Gegner ein.',
    icon: 'flame',
    color: '#60a5fa',
    resource: { name: 'Mana', color: '#3b82f6', onHit: 0, startFull: true },
    base: { maxHp: 105, hpRegen: 1, maxRes: 150, resRegen: 12, power: 16, armor: 0, moveSpeed: 7, attackSpeed: 1, crit: 0.06 },
    attack: { kind: 'projectile', range: 16, arc: 0, interval: 0.85, damageMul: 1.0, projectileSpeed: 26, element: 'fire' },
    skills: [
      { id: 'fireball', name: 'Feuerball', desc: 'Schleudert einen Feuerball, der in 3,5 m Umkreis explodiert (220 %) und Ziele entzündet.', icon: 'flame', cooldown: 5, cost: 30 },
      { id: 'frostnova', name: 'Frostnova', desc: 'Friert alle Gegner im Umkreis von 5,5 m für 2,2 s ein (80 % Frostschaden).', icon: 'frost', cooldown: 12, cost: 35 },
      { id: 'blink', name: 'Aethersprung', desc: 'Gleitet blitzschnell 8 m in Zeigerrichtung. Kollidiert nicht mit Gegnern.', icon: 'blink', cooldown: 8, cost: 20 },
      { id: 'chain', name: 'Kettenblitz', desc: 'Blitz springt zwischen bis zu 7 Gegnern (200 %, −15 % pro Sprung).', icon: 'bolt', cooldown: 10, cost: 45 },
    ],
    unlockCost: 0,
    gear: 'staff',
    armorColor: 0x3b2f7a,
    trimColor: 0x22d3ee,
  },
  rogue: {
    id: 'rogue',
    name: 'Schurke',
    role: 'Nahkampf · Kritische Treffer · Burst',
    desc: 'Schnell, tödlich und schwer zu fassen. Vergiftet Gruppen, springt durch Schatten und vollstreckt geschwächte Ziele.',
    icon: 'dagger',
    color: '#facc15',
    resource: { name: 'Energie', color: '#eab308', onHit: 0, startFull: true },
    base: { maxHp: 118, hpRegen: 1.5, maxRes: 100, resRegen: 20, power: 12, armor: 0.05, moveSpeed: 7.6, attackSpeed: 1.35, crit: 0.2, critDmg: 1.8 },
    attack: { kind: 'melee', range: 2.4, arc: 1.7, interval: 0.55, damageMul: 0.8, projectileSpeed: 0, element: 'physical' },
    skills: [
      { id: 'fan', name: 'Klingenfächer', desc: 'Wirft Klingen um dich (4,5 m): 120 % Schaden und Gift (40 %/s für 4 s).', icon: 'poison', cooldown: 5, cost: 30 },
      { id: 'shadowstep', name: 'Schattenschritt', desc: 'Springt hinter den Gegner am Zeiger (12 m). Der nächste Angriff trifft garantiert kritisch (×2).', icon: 'shadow', cooldown: 8, cost: 25 },
      { id: 'smoke', name: 'Rauchbombe', desc: '5 s lang Rauch (5 m): Gegner darin sind 40 % langsamer und erleiden 20 % mehr Schaden; du weichst 50 % der Angriffe aus.', icon: 'smoke', cooldown: 18, cost: 35 },
      { id: 'execute', name: 'Todesstoß', desc: 'Vernichtender Stoß (400 %), doppelter Schaden unter 35 % Leben. Setzt die Abklingzeit bei Tötung zurück.', icon: 'skull', cooldown: 14, cost: 40 },
    ],
    unlockCost: 80,
    gear: 'daggers',
    armorColor: 0x2b2f3a,
    trimColor: 0x8b5cf6,
  },
  ranger: {
    id: 'ranger',
    name: 'Waldläufer',
    role: 'Fernkampf · Fallen · Begleiter',
    desc: 'Kämpft mit Bogen und einem treuen Geisterwolf an der Seite. Kontrolliert das Schlachtfeld mit Fallen und Pfeilhagel.',
    icon: 'bow',
    color: '#4ade80',
    resource: { name: 'Fokus', color: '#22c55e', onHit: 3, startFull: true },
    base: { maxHp: 122, hpRegen: 1.5, maxRes: 100, resRegen: 13, power: 13, armor: 0.05, moveSpeed: 7.3, attackSpeed: 1, crit: 0.1 },
    attack: { kind: 'projectile', range: 18, arc: 0, interval: 0.7, damageMul: 0.95, projectileSpeed: 36, element: 'physical' },
    skills: [
      { id: 'multishot', name: 'Mehrfachschuss', desc: 'Feuert 5 durchschlagende Pfeile in einem Fächer (je 90 %).', icon: 'arrows', cooldown: 6, cost: 25 },
      { id: 'trap', name: 'Dornenfalle', desc: 'Legt eine Falle am Zeiger (max. 3). Auslösung: 200 % Flächenschaden und 2,5 s Festwurzeln.', icon: 'trap', cooldown: 6, cost: 20 },
      { id: 'pack', name: 'Rudelruf', desc: '8 s lang: Begleiter greift doppelt so schnell an (+50 % Schaden), du erhältst +20 % Angriffstempo.', icon: 'paw', cooldown: 20, cost: 30 },
      { id: 'volley', name: 'Pfeilhagel', desc: 'Lässt 3 s lang Pfeile auf einen 5-m-Bereich regnen (6 × 60 %) und verlangsamt um 30 %.', icon: 'rain', cooldown: 14, cost: 45 },
    ],
    unlockCost: 0,
    gear: 'bow',
    armorColor: 0x4a5d3a,
    trimColor: 0x86efac,
  },
};

export const CLASS_ORDER: ClassId[] = ['warrior', 'mage', 'rogue', 'ranger'];
