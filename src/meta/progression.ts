import { CLASSES, type ClassId } from '../config/classes.ts';
import { LEVEL_BY_ID, type LevelDef } from '../config/levels.ts';
import { MOUNTS, mountLevelFromXp, type MountId } from '../config/mounts.ts';
import { RACES, type RaceId } from '../config/races.ts';
import { accountLevelFromXp, canRankUp, META_BOONS, TALENTS } from '../config/talents.ts';
import type { SaveData } from './save.ts';

export function talentPoints(save: SaveData): { total: number; spent: number; free: number } {
  const lvl = accountLevelFromXp(save.accountXp).level;
  const total = lvl - 1 + (save.boons.tome ?? 0);
  let spent = 0;
  for (const t of TALENTS) spent += save.talents[t.id] ?? 0;
  return { total, spent, free: total - spent };
}

export function rankUpTalent(save: SaveData, id: string): { ok: boolean; reason?: string } {
  const check = canRankUp(save.talents, id, talentPoints(save).free);
  if (!check.ok) return check;
  save.talents[id] = (save.talents[id] ?? 0) + 1;
  return { ok: true };
}

export function resetTalents(save: SaveData): void {
  save.talents = {};
}

export function isLevelUnlocked(save: SaveData, level: LevelDef): boolean {
  if (!level.unlockAfter) return true;
  return !!save.levels[level.unlockAfter]?.cleared;
}

export type UnlockKind = 'race' | 'class' | 'mount';

export function unlockCost(kind: UnlockKind, id: string): number {
  if (kind === 'race') return RACES[id as RaceId].unlockCost;
  if (kind === 'class') return CLASSES[id as ClassId].unlockCost;
  return MOUNTS[id as MountId].unlockCost;
}

export function isUnlocked(save: SaveData, kind: UnlockKind, id: string): boolean {
  if (kind === 'race') return save.unlocked.races.includes(id as RaceId);
  if (kind === 'class') return save.unlocked.classes.includes(id as ClassId);
  return save.unlocked.mounts.includes(id as MountId);
}

export function buyUnlock(save: SaveData, kind: UnlockKind, id: string): boolean {
  if (isUnlocked(save, kind, id)) return true;
  const cost = unlockCost(kind, id);
  if (save.shards < cost) return false;
  save.shards -= cost;
  if (kind === 'race') save.unlocked.races.push(id as RaceId);
  else if (kind === 'class') save.unlocked.classes.push(id as ClassId);
  else save.unlocked.mounts.push(id as MountId);
  return true;
}

export function buyBoon(save: SaveData, id: string): boolean {
  const def = META_BOONS.find((b) => b.id === id);
  if (!def) return false;
  const rank = save.boons[id] ?? 0;
  if (rank >= def.maxRank) return false;
  const cost = def.cost(rank);
  if (save.shards < cost) return false;
  save.shards -= cost;
  save.boons[id] = rank + 1;
  return true;
}

export interface RunResult {
  levelId: string;
  victory: boolean;
  wavesCleared: number;
  totalWaves: number;
  kills: number;
  bossKilled: boolean;
  shardMul: number;
  mountId: MountId;
  mountXp: number;
  timeSec: number;
}

export interface RewardSummary {
  shards: number;
  xp: number;
  lines: { label: string; value: number }[];
  accountLevelBefore: number;
  accountLevelAfter: number;
  mountLevelBefore: number;
  mountLevelAfter: number;
  firstClear: boolean;
  unlockedLevel?: string;
}

export function computeRewards(save: SaveData, r: RunResult): RewardSummary {
  const level = LEVEL_BY_ID[r.levelId];
  const lines: { label: string; value: number }[] = [];
  const waveShards = Math.round(r.wavesCleared * (5 + level.difficulty * 2));
  lines.push({ label: `Wellen überstanden (${r.wavesCleared}/${r.totalWaves})`, value: waveShards });
  let shards = waveShards;
  if (r.bossKilled) {
    const b = 25 + level.difficulty * 10;
    lines.push({ label: 'Boss bezwungen', value: b });
    shards += b;
  }
  const firstClear = r.victory && !save.levels[r.levelId]?.cleared;
  if (r.victory) {
    lines.push({ label: 'Sieg', value: level.rewardShards });
    shards += level.rewardShards;
    if (firstClear) {
      const bonus = Math.round(level.rewardShards * 0.5);
      lines.push({ label: 'Erstabschluss-Bonus', value: bonus });
      shards += bonus;
    }
  }
  const mul = r.shardMul * (1 + 0.08 * (save.boons.shards ?? 0));
  if (mul !== 1) {
    const extra = Math.round(shards * (mul - 1));
    if (extra !== 0) lines.push({ label: 'Boni (Ereignis & Aetherkunde)', value: extra });
    shards += extra;
  }
  const xp = Math.round(r.kills * 1.5 + r.wavesCleared * 22 + (r.victory ? 160 : 0) + (r.bossKilled ? 60 : 0));
  const accBefore = accountLevelFromXp(save.accountXp).level;
  const accAfter = accountLevelFromXp(save.accountXp + xp).level;
  const mBefore = mountLevelFromXp(save.mountXp[r.mountId] ?? 0).level;
  const mAfter = mountLevelFromXp((save.mountXp[r.mountId] ?? 0) + r.mountXp).level;
  let unlockedLevel: string | undefined;
  if (firstClear) {
    const next = Object.values(LEVEL_BY_ID).find((l) => l.unlockAfter === r.levelId);
    if (next) unlockedLevel = next.id;
  }
  return {
    shards: Math.max(0, shards),
    xp,
    lines,
    accountLevelBefore: accBefore,
    accountLevelAfter: accAfter,
    mountLevelBefore: mBefore,
    mountLevelAfter: mAfter,
    firstClear,
    unlockedLevel,
  };
}

export function applyRewards(save: SaveData, r: RunResult): RewardSummary {
  const summary = computeRewards(save, r);
  save.shards += summary.shards;
  save.totalShards += summary.shards;
  save.accountXp += summary.xp;
  save.mountXp[r.mountId] = (save.mountXp[r.mountId] ?? 0) + Math.round(r.mountXp);
  const lp = save.levels[r.levelId] ?? { cleared: false, bestWave: 0, clears: 0 };
  lp.bestWave = Math.max(lp.bestWave, r.wavesCleared);
  if (r.victory) {
    lp.cleared = true;
    lp.clears++;
  }
  save.levels[r.levelId] = lp;
  save.stats.runs++;
  save.stats.kills += r.kills;
  if (r.victory) save.stats.victories++;
  if (r.bossKilled) save.stats.bossKills++;
  return summary;
}
