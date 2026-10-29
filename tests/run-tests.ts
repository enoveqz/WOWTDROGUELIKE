/**
 * Leichtgewichtige Unit-Tests ohne Test-Framework.
 * Ausführen: npm test  (Node ≥ 22, nutzt --experimental-strip-types)
 */
import { Rng } from '../src/core/rng.ts';
import { distToPolyline } from '../src/core/math.ts';
import { computeStats } from '../src/config/stats.ts';
import { rollUpgradeOffer, activeSynergies, UPGRADES, rollRunEvent } from '../src/config/upgrades.ts';
import { generateWaves } from '../src/config/waves.ts';
import { LEVELS } from '../src/config/levels.ts';
import { canRankUp, talentMods, TALENTS, TALENT_BY_ID } from '../src/config/talents.ts';
import { CLASSES, CLASS_ORDER } from '../src/config/classes.ts';
import { RACES, RACE_ORDER } from '../src/config/races.ts';
import { mountLevelFromXp } from '../src/config/mounts.ts';
import { SaveManager, migrate, type StorageLike } from '../src/meta/save.ts';
import { applyRewards, buyUnlock, rankUpTalent, talentPoints } from '../src/meta/progression.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

class MemStore implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

console.log('Kingshot — Riders of Aether · Tests');

test('Rng ist deterministisch', () => {
  const a = new Rng(1234);
  const b = new Rng(1234);
  for (let i = 0; i < 100; i++) assert(a.next() === b.next(), 'Sequenzen weichen ab');
  const c = new Rng(99);
  const vals = Array.from({ length: 1000 }, () => c.next());
  assert(vals.every((v) => v >= 0 && v < 1), 'Werte außerhalb [0,1)');
  const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
  assert(Math.abs(mean - 0.5) < 0.05, `Mittelwert unplausibel: ${mean}`);
});

test('Stats: add/mul und Caps', () => {
  const s = computeStats({ power: 10, crit: 0.7 }, [
    { stat: 'power', add: 5 },
    { stat: 'power', mul: 0.2 },
    { stat: 'crit', add: 0.3 },
  ]);
  assert(Math.abs(s.power - 18) < 1e-9, `power=${s.power}`);
  assert(s.crit === 0.75, `crit cap verletzt: ${s.crit}`);
});

test('Jede Rassen-/Klassenkombination liefert gültige Werte', () => {
  for (const r of RACE_ORDER) {
    for (const c of CLASS_ORDER) {
      const s = computeStats(CLASSES[c].base, RACES[r].mods);
      assert(s.maxHp > 60 && s.maxHp < 260, `${r}/${c} maxHp ${s.maxHp}`);
      assert(s.power > 8 && s.power < 25, `${r}/${c} power ${s.power}`);
      // grobe Balance: "Effektives Schadenspotenzial" innerhalb eines Korridors
      const dps = (s.power * CLASSES[c].attack.damageMul * s.attackSpeed * (1 + s.crit * (s.critDmg - 1))) / CLASSES[c].attack.interval;
      assert(dps > 10 && dps < 32, `${r}/${c} DPS-Proxy ${dps.toFixed(1)}`);
    }
  }
});

test('Upgrade-Angebot: 3 eindeutige Karten, deterministisch, max. 1 Relikt', () => {
  for (let seed = 1; seed < 300; seed++) {
    const offer = rollUpgradeOffer(new Rng(seed), {});
    assert(offer.length === 3, 'nicht 3 Karten');
    assert(new Set(offer.map((o) => o.id)).size === 3, 'Duplikate');
    assert(offer.filter((o) => o.rarity === 'relic').length <= 1, 'mehrere Relikte');
    const again = rollUpgradeOffer(new Rng(seed), {});
    assert(again.map((o) => o.id).join() === offer.map((o) => o.id).join(), 'nicht deterministisch');
  }
});

test('Upgrade-Angebot respektiert maxStacks', () => {
  const taken: Record<string, number> = {};
  for (const u of UPGRADES) taken[u.id] = u.maxStacks;
  taken.sharp = 0;
  const offer = rollUpgradeOffer(new Rng(5), taken);
  assert(offer.length === 1 && offer[0].id === 'sharp', 'Ausgereizte Upgrades angeboten');
});

test('Relikt-Häufigkeit ist plausibel (2–25 % der Angebote)', () => {
  let relics = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) if (rollUpgradeOffer(new Rng(i * 7 + 3), {}).some((u) => u.rarity === 'relic')) relics++;
  const share = relics / n;
  assert(share > 0.02 && share < 0.25, `Relikt-Anteil ${share}`);
});

test('Synergien aktivieren sich ab Schwelle', () => {
  assert(activeSynergies({ bolts: 2, builder: 1 }).some((s) => s.id === 'fortress'), 'Festungsnetz fehlt');
  assert(!activeSynergies({ bolts: 1 }).some((s) => s.id === 'fortress'), 'Festungsnetz zu früh');
});

test('Run-Ereignis-Auswahl ist deterministisch', () => {
  assert(rollRunEvent(new Rng(42)).id === rollRunEvent(new Rng(42)).id, 'nicht deterministisch');
});

test('Wellen: jede Welle hat Gegner, letzte Welle ist Bosswelle', () => {
  for (const level of LEVELS) {
    const waves = generateWaves(level, new Rng(77), { extraElites: true });
    assert(waves.length === level.waves.length, 'Anzahl falsch');
    for (const w of waves) {
      assert(w.total > 0, `${level.id} Welle ${w.index} leer`);
      assert(w.total < 70, `${level.id} Welle ${w.index} zu groß (${w.total})`);
      for (const g of w.groups) assert(g.path >= 0 && g.path < level.paths.length, 'ungültiger Pfad');
    }
    const last = waves[waves.length - 1];
    assert(last.isBoss && last.groups.some((g) => g.enemy === level.boss), `${level.id}: Boss fehlt`);
  }
});

test('Level: Bauplätze liegen neben (nicht auf) den Routen', () => {
  for (const level of LEVELS) {
    for (const pad of level.pads) {
      const d = Math.min(...level.paths.map((path) => distToPolyline(pad.x, pad.z, path)));
      assert(d >= 3.5 && d <= 10.5, `${level.id}: Bauplatz (${pad.x},${pad.z}) Abstand ${d.toFixed(2)}`);
    }
    for (const path of level.paths) {
      const end = path[path.length - 1];
      const dc = Math.hypot(end.x - level.crystal.x, end.z - level.crystal.z);
      assert(dc < 6, `${level.id}: Route endet nicht am Kristall (${dc.toFixed(1)})`);
      for (const pt of path) assert(Math.abs(pt.x) <= 38 && Math.abs(pt.z) <= 40, 'Route außerhalb der Karte');
    }
  }
});

test('Talente: Voraussetzungen werden geprüft', () => {
  assert(!canRankUp({}, 'k_crit', 5).ok, 'Präzision ohne Voraussetzung');
  assert(canRankUp({}, 'k_power', 1).ok, 'Startknoten gesperrt');
  assert(!canRankUp({}, 'k_power', 0).ok, 'ohne Punkte möglich');
  const mods = talentMods({ k_power: 3 });
  assert(mods.length === 1 && Math.abs((mods[0].mul ?? 0) - 0.12) < 1e-9, 'Rangskalierung falsch');
  for (const t of TALENTS) for (const r of t.requires) assert(TALENT_BY_ID[r.id], `${t.id}: unbekannte Voraussetzung`);
});

test('Mount-Stufen aus Erfahrung', () => {
  assert(mountLevelFromXp(0).level === 1, 'Startstufe');
  assert(mountLevelFromXp(140).level === 2, 'Stufe 2');
  assert(mountLevelFromXp(1e9).level === 10, 'Maximalstufe');
});

test('Speichern/Laden, Migration, Belohnungen und Freischaltungen', () => {
  const store = new MemStore();
  const sm = new SaveManager(store);
  assert(sm.persistent, 'Storage nicht persistent');
  sm.data.shards = 500;
  assert(buyUnlock(sm.data, 'class', 'rogue'), 'Schurke nicht kaufbar');
  assert(sm.data.unlocked.classes.includes('rogue'), 'Schurke fehlt');
  const summary = applyRewards(sm.data, {
    levelId: 'whisperwood', victory: true, wavesCleared: 8, totalWaves: 8, kills: 150, bossKilled: true, shardMul: 1, mountId: 'horse', mountXp: 300, timeSec: 600,
  });
  assert(summary.shards > 0 && summary.firstClear && summary.unlockedLevel === 'sunscorch', 'Belohnung/Erstabschluss falsch');
  assert(talentPoints(sm.data).free >= 1, 'keine Talentpunkte nach Sieg');
  assert(rankUpTalent(sm.data, 'k_power').ok, 'Talent nicht steigerbar');
  sm.save();
  const sm2 = new SaveManager(store);
  assert(sm2.data.levels.whisperwood.cleared, 'Fortschritt nicht geladen');
  assert(sm2.data.talents.k_power === 1, 'Talent nicht geladen');
  const migrated = migrate({ shards: 3 });
  assert(migrated.shards === 3 && migrated.unlocked.races.length >= 3, 'Migration unvollständig');
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) (globalThis as unknown as { process?: { exit(code: number): void } }).process?.exit(1);
