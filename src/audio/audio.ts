import type { Settings } from '../meta/save.ts';

export type Sfx =
  | 'hit'
  | 'crit'
  | 'swing'
  | 'cast'
  | 'fire'
  | 'frost'
  | 'bolt'
  | 'arrow'
  | 'coin'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'waveStart'
  | 'waveClear'
  | 'bossRoar'
  | 'crystalHit'
  | 'playerHit'
  | 'enemyDie'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'hover'
  | 'mount'
  | 'charge'
  | 'heal'
  | 'levelup'
  | 'error'
  | 'explosion';

/**
 * Prozedurale Audio-Engine auf Basis der Web Audio API.
 * Keine Audiodateien nötig – das Spiel startet auch ohne Assets.
 * Fehlt die Web Audio API, bleibt das Spiel stumm, aber voll spielbar.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private lastPlayed = new Map<Sfx, number>();
  private music: { stop: () => void } | null = null;
  private musicMood: 'menu' | 'forest' | 'desert' | 'snow' | 'volcano' | 'boss' | null = null;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** Muss nach einer Nutzerinteraktion aufgerufen werden (Autoplay-Richtlinien). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.applySettings(this.settings);
    if (this.musicMood) {
      const mood = this.musicMood;
      this.musicMood = null;
      this.setMusic(mood);
    }
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, t, 0.2);
  }

  play(name: Sfx, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted) return;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.035) return;
    this.lastPlayed.set(name, now);
    try {
      this.synth(name, now, volume);
    } catch {
      /* Audio ist optional */
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1: number, q = 1): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private synth(name: Sfx, t: number, v: number): void {
    switch (name) {
      case 'hit':
        this.noise(t, 0.09, 0.25 * v, 'bandpass', 1800, 500, 1.2);
        this.tone('triangle', 220, 90, t, 0.08, 0.15 * v);
        break;
      case 'crit':
        this.noise(t, 0.12, 0.3 * v, 'bandpass', 3000, 700, 1.5);
        this.tone('square', 660, 330, t, 0.1, 0.08 * v);
        break;
      case 'swing':
        this.noise(t, 0.16, 0.18 * v, 'bandpass', 600, 2400, 2);
        break;
      case 'cast':
        this.tone('sine', 400, 900, t, 0.25, 0.12 * v, 0.02);
        this.tone('triangle', 600, 1300, t + 0.03, 0.22, 0.06 * v, 0.02);
        break;
      case 'fire':
        this.noise(t, 0.35, 0.3 * v, 'lowpass', 2500, 300, 0.7);
        this.tone('sawtooth', 160, 60, t, 0.3, 0.06 * v);
        break;
      case 'frost':
        this.tone('sine', 1800, 900, t, 0.4, 0.08 * v, 0.01);
        this.tone('sine', 2400, 1200, t + 0.05, 0.35, 0.05 * v, 0.01);
        this.noise(t, 0.3, 0.12 * v, 'highpass', 4000, 6000, 0.5);
        break;
      case 'bolt':
        this.noise(t, 0.2, 0.3 * v, 'highpass', 2500, 900, 0.8);
        this.tone('sawtooth', 900, 120, t, 0.18, 0.08 * v);
        break;
      case 'arrow':
        this.noise(t, 0.1, 0.14 * v, 'bandpass', 3500, 1500, 3);
        break;
      case 'coin':
        this.tone('square', 1320, 1320, t, 0.06, 0.05 * v);
        this.tone('square', 1760, 1760, t + 0.06, 0.1, 0.05 * v);
        break;
      case 'build':
        this.tone('triangle', 200, 120, t, 0.12, 0.2 * v);
        this.noise(t + 0.08, 0.1, 0.15 * v, 'lowpass', 900, 200);
        this.tone('triangle', 260, 160, t + 0.16, 0.12, 0.18 * v);
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.07, 0.18, 0.09 * v));
        break;
      case 'sell':
        this.tone('triangle', 784, 392, t, 0.25, 0.1 * v);
        break;
      case 'waveStart':
        this.tone('sawtooth', 110, 110, t, 0.9, 0.08 * v, 0.15);
        this.tone('sawtooth', 165, 165, t + 0.05, 0.9, 0.06 * v, 0.15);
        this.tone('sine', 55, 55, t, 1.1, 0.15 * v, 0.1);
        break;
      case 'waveClear':
        [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.1, 0.4, 0.09 * v, 0.02));
        break;
      case 'bossRoar':
        this.tone('sawtooth', 90, 45, t, 1.4, 0.18 * v, 0.1);
        this.noise(t, 1.2, 0.25 * v, 'lowpass', 800, 150, 1);
        break;
      case 'crystalHit':
        this.tone('sine', 1200, 1100, t, 0.25, 0.06 * v);
        this.tone('sine', 1650, 1500, t, 0.2, 0.04 * v);
        break;
      case 'playerHit':
        this.tone('square', 180, 90, t, 0.12, 0.08 * v);
        this.noise(t, 0.08, 0.15 * v, 'lowpass', 1200, 300);
        break;
      case 'enemyDie':
        this.tone('triangle', 300, 70, t, 0.2, 0.1 * v);
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.13, 0.6, 0.1 * v, 0.02));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, t + i * 0.25, 0.5, 0.06 * v, 0.03));
        break;
      case 'click':
        this.tone('sine', 900, 700, t, 0.05, 0.06 * v);
        break;
      case 'hover':
        this.tone('sine', 1400, 1400, t, 0.03, 0.02 * v);
        break;
      case 'mount':
        this.noise(t, 0.25, 0.12 * v, 'lowpass', 600, 200);
        this.tone('triangle', 300, 500, t, 0.2, 0.08 * v);
        break;
      case 'charge':
        this.noise(t, 0.5, 0.25 * v, 'bandpass', 300, 1200, 1);
        this.tone('sawtooth', 120, 240, t, 0.4, 0.06 * v);
        break;
      case 'heal':
        [660, 880, 1100].forEach((f, i) => this.tone('sine', f, f * 1.02, t + i * 0.06, 0.35, 0.06 * v, 0.03));
        break;
      case 'levelup':
        [523, 784, 1046, 1568].forEach((f, i) => this.tone('square', f, f, t + i * 0.08, 0.2, 0.05 * v));
        break;
      case 'error':
        this.tone('square', 200, 150, t, 0.15, 0.06 * v);
        break;
      case 'explosion':
        this.noise(t, 0.6, 0.4 * v, 'lowpass', 1500, 80, 0.7);
        this.tone('sine', 120, 35, t, 0.5, 0.2 * v);
        break;
    }
  }

  /** Generative, ruhige Hintergrundmusik pro Stimmung. */
  setMusic(mood: 'menu' | 'forest' | 'desert' | 'snow' | 'volcano' | 'boss' | null): void {
    if (mood === this.musicMood) return;
    this.musicMood = mood;
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
    const ctx = this.ctx;
    if (!ctx || !mood) return;
    const scales: Record<string, number[][]> = {
      menu: [[0, 7, 12, 16], [5, 12, 17, 21], [3, 10, 15, 19], [7, 14, 19, 22]],
      forest: [[0, 7, 12, 16], [9, 16, 21, 24], [5, 12, 17, 21], [7, 14, 19, 23]],
      desert: [[0, 7, 13, 16], [1, 8, 13, 17], [0, 7, 12, 15], [-2, 5, 10, 13]],
      snow: [[0, 7, 14, 19], [-3, 4, 11, 16], [-7, 0, 7, 12], [-5, 2, 9, 14]],
      volcano: [[0, 7, 12, 15], [-4, 3, 8, 12], [-2, 5, 10, 13], [-5, 2, 7, 10]],
      boss: [[0, 6, 12, 15], [-1, 6, 11, 14], [0, 6, 12, 15], [1, 7, 13, 16]],
    };
    const root = mood === 'volcano' || mood === 'boss' ? 98 : mood === 'snow' ? 130.8 : 110;
    const chords = scales[mood];
    const nodes: AudioScheduledSourceNode[] = [];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood === 'boss' ? 1400 : 900;
    filter.connect(out);
    out.connect(this.musicBus);
    const voices: { o: OscillatorNode; g: GainNode }[] = [];
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.09 : 0.05;
      o.connect(g);
      g.connect(filter);
      o.start();
      nodes.push(o);
      voices.push({ o, g });
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);
    let step = 0;
    const barLen = mood === 'boss' ? 3.2 : 6;
    const schedule = () => {
      const chord = chords[step % chords.length];
      const t = ctx.currentTime;
      voices.forEach((v, i) => {
        const f = root * Math.pow(2, chord[i] / 12) * (i === 0 ? 0.5 : 1);
        v.o.frequency.setTargetAtTime(f, t, 0.8);
      });
      step++;
    };
    schedule();
    const timer = setInterval(schedule, barLen * 1000);
    this.music = {
      stop: () => {
        clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.6);
        setTimeout(() => {
          for (const n of nodes) {
            try {
              n.stop();
            } catch {
              /* bereits gestoppt */
            }
          }
          out.disconnect();
        }, 2500);
      },
    };
  }
}
