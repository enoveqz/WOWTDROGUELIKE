import type { ClassId } from '../config/classes.ts';
import { DEFAULT_KEYS, type Action } from '../config/keybinds.ts';
import type { MountId } from '../config/mounts.ts';
import type { RaceId } from '../config/races.ts';

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
  quality: Quality;
  shadows: boolean;
  particles: boolean;
  damageNumbers: boolean;
  screenShake: boolean;
  showMinimap: boolean;
  cameraSensitivity: number;
}

export interface LevelProgress {
  cleared: boolean;
  bestWave: number;
  clears: number;
}

export interface SaveData {
  version: 1;
  shards: number;
  totalShards: number;
  accountXp: number;
  unlocked: { races: RaceId[]; classes: ClassId[]; mounts: MountId[] };
  levels: Record<string, LevelProgress>;
  talents: Record<string, number>;
  boons: Record<string, number>;
  mountXp: Record<MountId, number>;
  selection: { race: RaceId; cls: ClassId; mount: MountId; level: string };
  settings: Settings;
  keys: Record<Action, string>;
  stats: { runs: number; victories: number; kills: number; bossKills: number };
  seenTutorial: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  sfx: 0.8,
  music: 0.45,
  muted: false,
  quality: 'high',
  shadows: true,
  particles: true,
  damageNumbers: true,
  screenShake: true,
  showMinimap: true,
  cameraSensitivity: 1,
};

export function defaultSave(): SaveData {
  return {
    version: 1,
    shards: 0,
    totalShards: 0,
    accountXp: 0,
    unlocked: { races: ['human', 'elf', 'orc'], classes: ['warrior', 'mage', 'ranger'], mounts: ['horse'] },
    levels: {},
    talents: {},
    boons: {},
    mountXp: { horse: 0, wolf: 0, lizard: 0 },
    selection: { race: 'human', cls: 'warrior', mount: 'horse', level: 'whisperwood' },
    settings: { ...DEFAULT_SETTINGS },
    keys: { ...DEFAULT_KEYS },
    stats: { runs: 0, victories: 0, kills: 0, bossKills: 0 },
    seenTutorial: false,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Fallback, falls localStorage blockiert ist (z. B. privater Modus). */
class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const KEY = 'kingshot-riders-of-aether.save';

export class SaveManager {
  data: SaveData;
  readonly persistent: boolean;
  private storage: StorageLike;

  constructor(storage?: StorageLike) {
    let s = storage;
    let persistent = true;
    if (!s) {
      try {
        s = globalThis.localStorage;
        const probe = '__ks_probe__';
        s.setItem(probe, '1');
        s.removeItem(probe);
      } catch {
        s = undefined;
      }
    }
    if (!s) {
      s = new MemoryStorage();
      persistent = false;
    }
    this.storage = s;
    this.persistent = persistent;
    this.data = this.load();
  }

  private load(): SaveData {
    const raw = this.storage.getItem(KEY);
    if (!raw) return defaultSave();
    try {
      return migrate(JSON.parse(raw));
    } catch (err) {
      console.warn('[Save] Speicherstand beschädigt – starte neu.', err);
      return defaultSave();
    }
  }

  save(): void {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[Save] Speichern fehlgeschlagen.', err);
    }
  }

  reset(): void {
    const keepSettings = this.data.settings;
    const keepKeys = this.data.keys;
    this.data = defaultSave();
    this.data.settings = keepSettings;
    this.data.keys = keepKeys;
    this.save();
  }
}

/** Ergänzt fehlende Felder älterer/teilweiser Spielstände. */
export function migrate(input: unknown): SaveData {
  const def = defaultSave();
  if (!input || typeof input !== 'object') return def;
  const d = input as Partial<SaveData>;
  return {
    ...def,
    ...d,
    version: 1,
    unlocked: {
      races: uniq([...def.unlocked.races, ...(d.unlocked?.races ?? [])]),
      classes: uniq([...def.unlocked.classes, ...(d.unlocked?.classes ?? [])]),
      mounts: uniq([...def.unlocked.mounts, ...(d.unlocked?.mounts ?? [])]),
    },
    levels: { ...(d.levels ?? {}) },
    talents: { ...(d.talents ?? {}) },
    boons: { ...(d.boons ?? {}) },
    mountXp: { ...def.mountXp, ...(d.mountXp ?? {}) },
    selection: { ...def.selection, ...(d.selection ?? {}) },
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    keys: { ...DEFAULT_KEYS, ...(d.keys ?? {}) },
    stats: { ...def.stats, ...(d.stats ?? {}) },
  };
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
