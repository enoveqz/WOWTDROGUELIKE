import { keyLabel } from '../config/keybinds.ts';
import type { Run } from './run.ts';

export interface TutorialStep {
  title: string;
  text: string;
  done: (run: Run) => boolean;
}

/**
 * Geführter Einstieg wie ein Questlog: immer nur eine Aufgabe gleichzeitig.
 * Läuft, bis alle Schritte einmal erledigt wurden (danach dauerhaft aus).
 */
export class Tutorial {
  readonly steps: TutorialStep[];
  index = 0;
  private run: Run;
  private delay = 1.2;
  /** Erhöht sich bei jedem Schrittwechsel – HUD rendert dann neu. */
  version = 0;

  constructor(run: Run) {
    this.run = run;
    const k = (a: Parameters<typeof keyLabel>[0]) => `<kbd>${keyLabel(a)}</kbd>`;
    const keys = run.save.data.keys;
    this.steps = [
      {
        title: 'Erste Schritte',
        text: `Laufe mit ${k(keys.up)}${k(keys.left)}${k(keys.down)}${k(keys.right)}. Halte die <b>rechte Maustaste</b> und bewege die Maus, um dich umzusehen.`,
        done: (r) => r.player.distanceWalked > 6,
      },
      {
        title: 'Ein Platz für Verteidigung',
        text: `Gehe zu einem leuchtenden <b>Sechseck-Bauplatz</b> und drücke ${k(keys.interact)} – oder klicke ihn an.`,
        done: (r) => r.selectedPad >= 0 || r.towers.count > 0,
      },
      {
        title: 'Der erste Turm',
        text: 'Baue im Turmmenü einen <b>Pfeilturm</b>. Türme schießen von selbst auf Gegner in Reichweite.',
        done: (r) => r.towers.count > 0,
      },
      {
        title: 'Sie kommen!',
        text: `Rufe die erste Welle mit ${k(keys.nextWave)} – oder warte, bis der Countdown abläuft.`,
        done: (r) => r.waves.phase === 'active' || r.waves.index > 0,
      },
      {
        title: 'Zum Angriff',
        text: `<b>Rechtsklick</b> auf einen Gegner greift ihn automatisch an. ${k(keys.target)} wählt das nächste Ziel.`,
        done: (r) => r.player.attacksDone >= 3,
      },
      {
        title: 'Deine Fähigkeiten',
        text: `Setze <b>Fähigkeit 1</b> mit ${k(keys.skill1)} ein. Sie trifft dein Ziel oder den Gegner vor dir.`,
        done: (r) => r.player.skillCd[0] > 0,
      },
      {
        title: 'In den Sattel',
        text: `Drücke ${k(keys.interact)} abseits der Bauplätze, um aufzusitzen. Im Sattel bist du viel schneller.`,
        done: (r) => r.player.mounted,
      },
      {
        title: 'Halte die Stellung',
        text: 'Überstehe die zweite Welle. Danach darfst du dir eine Verstärkung aussuchen.',
        done: (r) => r.waves.index >= 2,
      },
    ];
  }

  get current(): TutorialStep | null {
    return this.steps[this.index] ?? null;
  }

  get finished(): boolean {
    return this.index >= this.steps.length;
  }

  update(dt: number): void {
    if (this.finished) return;
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    const step = this.steps[this.index];
    if (!step.done(this.run)) return;
    this.index++;
    this.version++;
    this.delay = 0.8;
    this.run.audio.play('waveClear', 0.4);
    if (this.finished) {
      this.run.save.data.tutorialDone = true;
      this.run.save.save();
      this.run.notify('Grundausbildung abgeschlossen!', 'good', true);
    } else {
      this.run.notify(`Aufgabe erledigt: ${step.title}`, 'good');
    }
  }
}
