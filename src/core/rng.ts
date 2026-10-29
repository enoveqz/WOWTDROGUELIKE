/**
 * Deterministischer, seedbarer Zufallsgenerator (mulberry32).
 * Jeder Run erhält einen Seed – damit sind Upgrade-Angebote, Events und
 * Gegnervarianten reproduzierbar und testbar.
 */
export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  static randomSeed(): number {
    return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: leere Liste');
    return items[Math.floor(this.next() * items.length)];
  }

  /** Gewichtete Auswahl. Gewichte <= 0 werden ignoriert. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const it of items) {
      const w = Math.max(0, weight(it));
      if (roll < w) return it;
      roll -= w;
    }
    return items[items.length - 1];
  }

  /** Erzeugt einen unabhängigen Unter-Generator (z. B. pro System). */
  fork(salt: number): Rng {
    return new Rng((this.seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
  }
}

/** Seed als kurzer, lesbarer Code (für HUD/Ergebnisbildschirm). */
export function seedToCode(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase().padStart(7, '0');
}
