import { THEME_INFO, type WaveSpec } from '../config/waves.ts';
import type { Run } from './run.ts';
import { TOWERS } from '../config/towers.ts';

export type WavePhase = 'prep' | 'active' | 'done';

interface GroupRuntime {
  enemy: WaveSpec['groups'][number]['enemy'];
  remaining: number;
  interval: number;
  path: number;
  timer: number;
}

/**
 * Wellensteuerung: Vorbereitungs-Countdown, Spawning nach Gruppen,
 * Wellenbonus und Übergang zur Upgrade-Auswahl bzw. zum Sieg.
 */
export class WaveManager {
  readonly waves: WaveSpec[];
  index = 0;
  phase: WavePhase = 'prep';
  countdown = 25;
  private groups: GroupRuntime[] = [];
  private run: Run;
  waveTime = 0;

  constructor(run: Run, waves: WaveSpec[]) {
    this.run = run;
    this.waves = waves;
  }

  get current(): WaveSpec | undefined {
    return this.waves[this.index];
  }

  get total(): number {
    return this.waves.length;
  }

  get remainingToSpawn(): number {
    return this.groups.reduce((a, g) => a + g.remaining, 0);
  }

  /** Welle vorzeitig rufen – Bonusgold für verbleibende Sekunden. */
  callEarly(): void {
    if (this.phase !== 'prep') return;
    const bonus = Math.floor(this.countdown) * 2;
    if (bonus > 0) this.run.addGold(bonus);
    if (bonus > 0) this.run.notify(`Welle früh gerufen: +${bonus} Gold`, 'good');
    this.start();
  }

  private start(): void {
    const w = this.current;
    if (!w) return;
    this.phase = 'active';
    this.waveTime = 0;
    this.groups = w.groups.map((g) => ({ enemy: g.enemy, remaining: g.count, interval: g.interval, path: g.path, timer: g.delay }));
    this.run.audio.play(w.isBoss ? 'bossRoar' : 'waveStart');
    this.run.notify(`Welle ${w.index + 1}/${this.total}: ${THEME_INFO[w.theme].name}`, w.isBoss ? 'danger' : 'warn', true);
    if (w.isBoss) this.run.audio.setMusic('boss');
  }

  update(dt: number): void {
    const run = this.run;
    if (this.phase === 'prep') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.start();
      return;
    }
    if (this.phase !== 'active') return;
    this.waveTime += dt;
    for (const g of this.groups) {
      if (g.remaining <= 0) continue;
      g.timer -= dt;
      if (g.timer <= 0) {
        if (run.enemies.aliveCount >= run.enemies.cap) {
          g.timer = 0.5;
          continue;
        }
        run.enemies.spawn(g.enemy, g.path, this.index);
        g.remaining--;
        g.timer = g.interval * run.rng.range(0.85, 1.15);
      }
    }
    if (this.remainingToSpawn === 0 && run.enemies.aliveCount === 0) this.complete();
  }

  private complete(): void {
    const run = this.run;
    const w = this.current!;
    const bonus = Math.round(w.bonusGold * run.stats.gold);
    run.addGold(bonus);
    run.wavesCleared = this.index + 1;
    run.audio.play('waveClear');
    this.index++;
    if (this.index >= this.waves.length) {
      this.phase = 'done';
      run.victory();
      return;
    }
    run.notify(`Welle überstanden! +${bonus} Gold`, 'good', true);
    for (const id of ['arrow', 'arcane', 'frost'] as const) {
      if (run.towerUnlockWave(id) === this.index && this.index > 0) run.notify(`Neue Verteidigung verfügbar: ${TOWERS[id].name}`, 'good');
    }
    this.phase = 'prep';
    this.countdown = this.waves[this.index].isBoss ? 25 : 18;
    if (run.level.upgradeAfter.includes(this.index)) run.offerUpgrades();
  }
}
