import * as THREE from 'three';
import { AudioEngine } from './audio/audio.ts';
import { formatTime } from './core/math.ts';
import { Input } from './game/input.ts';
import { Run } from './game/run.ts';
import { Showcase } from './game/showcase.ts';
import { applyRewards, isLevelUnlocked, isUnlocked, syncLevelUnlocks, type RunResult } from './meta/progression.ts';
import { SaveManager } from './meta/save.ts';
import { LEVEL_BY_ID } from './config/levels.ts';
import { fmt } from './ui/dom.ts';
import { UI } from './ui/ui.ts';
import { setMaxAnisotropy } from './world/textures.ts';

type AppState = 'menu' | 'run';

/**
 * Anwendungsrahmen: Renderer, Hauptschleife, Zustandswechsel
 * (Menü ↔ Run), Pause, Einstellungen und Meta-Progression.
 */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly save: SaveManager;
  readonly audio: AudioEngine;
  readonly input: Input;
  readonly showcase: Showcase;
  readonly ui: UI;
  run: Run | null = null;
  state: AppState = 'menu';
  private paused = false;
  private last = performance.now();
  private resizeQueued = true;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.save = new SaveManager();
    const s = this.save.data.settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: s.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.audio = new AudioEngine(s);
    this.input = new Input(canvas, this.save.data.keys);
    this.showcase = new Showcase(window.innerWidth / window.innerHeight);
    // Bereits erreichte Kontostufen schalten kostenlose Inhalte frei
    if (syncLevelUnlocks(this.save.data).length) this.save.save();
    this.ui = new UI(this, uiRoot);
    this.applySettings();

    window.addEventListener('resize', () => (this.resizeQueued = true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'run' && !this.paused && !this.run?.choosing && !this.run?.ended) this.pause();
    });
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }

  start(): void {
    this.ui.screens.show('menu');
    this.audio.setMusic('menu');
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.resizeQueued) this.resize();

    if (this.state === 'run' && this.run) {
      const run = this.run;
      const frozen = this.paused || run.choosing;
      if (!frozen) run.update(dt);
      else this.input.endFrame();
      this.renderer.render(run.scene, run.camera.camera);
      this.ui.update(frozen ? 0 : dt, run.camera.camera);
    } else {
      this.showcase.update(dt);
      this.input.endFrame();
      this.renderer.render(this.showcase.scene, this.showcase.camera);
      this.ui.update(dt, null);
    }
  };

  private resize(): void {
    this.resizeQueued = false;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const q = this.save.data.settings.quality;
    const maxDpr = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setSize(w, h, false);
    this.showcase.resize(w / h);
    this.run?.camera.resize(w / h);
  }

  applySettings(): void {
    const s = this.save.data.settings;
    document.body.dataset.quality = s.quality;
    this.audio.applySettings(s);
    const shadows = s.shadows && s.quality !== 'low';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      const scenes = [this.showcase.scene, this.run?.scene].filter(Boolean) as THREE.Scene[];
      for (const sc of scenes) {
        sc.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!m) return;
          for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
        });
      }
    }
    if (this.run) {
      this.run.world.sun.castShadow = shadows;
      this.run.camera.shakeEnabled = s.screenShake;
      this.run.effects.particleScale = s.particles ? 1 : 0.25;
    }
    this.input.setKeys(this.save.data.keys);
    this.resizeQueued = true;
  }

  /* ── Runs ────────────────────────────────────────────────── */
  startRun(seed?: number): void {
    const d = this.save.data;
    const sel = d.selection;
    // Sicherheitsnetz: nur freigeschaltete Inhalte starten
    if (!isUnlocked(d, 'race', sel.race)) sel.race = 'human';
    if (!isUnlocked(d, 'class', sel.cls)) sel.cls = 'warrior';
    if (!isUnlocked(d, 'mount', sel.mount)) sel.mount = 'horse';
    if (!LEVEL_BY_ID[sel.level] || !isLevelUnlocked(d, LEVEL_BY_ID[sel.level])) sel.level = 'whisperwood';
    this.save.save();
    this.disposeRun();
    this.audio.unlock();
    try {
      this.run = new Run({
        save: this.save,
        audio: this.audio,
        hooks: this.ui,
        selection: { ...sel },
        input: this.input,
        aspect: window.innerWidth / window.innerHeight,
        seed,
      });
    } catch (err) {
      console.error(err);
      this.ui.notify('Level konnte nicht geladen werden.', 'danger');
      this.run = null;
      this.state = 'menu';
      this.ui.screens.show('menu');
      return;
    }
    this.applySettings();
    this.state = 'run';
    this.paused = false;
    this.input.releaseAll();
    this.ui.screens.show('none');
    this.ui.hud.build(this.run);
    const lv = this.run.level;
    this.ui.notify(`${lv.name} – ${lv.subtitle}`, 'info', true);
    if (!d.seenTutorial) {
      d.seenTutorial = true;
      this.save.save();

    }
  }

  restartRun(): void {
    this.startRun();
  }

  /** Aufgeben: gilt als Niederlage mit den bisher erreichten Wellen. */
  abandonRun(): void {
    const run = this.run;
    if (!run) return;
    if (!run.ended) {
      run.ended = true;
      run.victoryFlag = false;
    }
    this.finishRun(run.buildResult(), false);
  }

  finishRun(result: RunResult, victory: boolean): void {
    const run = this.run;
    const summary = applyRewards(this.save.data, result);
    this.save.save();
    const stats = [
      { label: 'Wellen', value: `${result.wavesCleared}/${result.totalWaves}` },
      { label: 'Besiegte Gegner', value: fmt(result.kills) },
      { label: 'Spielzeit', value: formatTime(result.timeSec) },
      { label: 'Heldenschaden', value: fmt(run?.stats_damageDealt ?? 0) },
      { label: 'Türme gebaut', value: String(run?.towersBuilt ?? 0) },
      { label: 'Niederlagen des Helden', value: String(run?.deaths ?? 0) },
    ];
    this.disposeRun();
    this.state = 'menu';
    this.paused = false;
    this.audio.setMusic('menu');
    this.ui.screens.showResults(summary, victory, stats);
  }

  quitToMenu(): void {
    this.disposeRun();
    this.state = 'menu';
    this.paused = false;
    this.audio.setMusic('menu');
    this.ui.screens.show('menu');
  }

  private disposeRun(): void {
    this.ui.hud.hide();
    this.ui.clearFloats();
    if (this.run) {
      this.run.dispose();
      this.run = null;
    }
  }

  pause(): void {
    if (this.state !== 'run' || !this.run || this.run.ended || this.run.choosing) return;
    this.paused = true;
    this.input.releaseAll();
    this.ui.hud.showPause();
  }

  resume(): void {
    this.paused = false;
    this.input.releaseAll();
    this.ui.hud.hideOverlay();
    if (this.ui.screens.current !== 'none') this.ui.screens.show('none');
  }

  isPaused(): boolean {
    return this.paused;
  }
}
