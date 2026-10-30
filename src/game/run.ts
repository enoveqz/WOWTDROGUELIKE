import * as THREE from 'three';
import type { AudioEngine } from '../audio/audio.ts';
import { CLASSES, type ClassId } from '../config/classes.ts';
import { LEVEL_BY_ID, type LevelDef } from '../config/levels.ts';
import type { MountId } from '../config/mounts.ts';
import { RACES, type RaceId } from '../config/races.ts';
import { computeStats, type StatBlock, type StatMod } from '../config/stats.ts';
import { talentMods } from '../config/talents.ts';
import { activeSynergies, rollRunEvent, RUN_EVENTS, rollUpgradeOffer, UPGRADE_BY_ID, type RunEventDef, type SynergyId, type UpgradeDef, type UpgradeFlag } from '../config/upgrades.ts';
import { generateWaves } from '../config/waves.ts';
import { dist, dist2 } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import type { RunResult } from '../meta/progression.ts';
import type { SaveManager } from '../meta/save.ts';
import { Effects } from '../world/effects.ts';
import { World } from '../world/world.ts';
import { CameraRig } from './camera.ts';
import { Combat } from './combat.ts';
import { EnemyManager, type Enemy } from './enemies.ts';
import type { Input } from './input.ts';
import { Player } from './player.ts';
import { TowerManager } from './towers.ts';
import { WaveManager } from './waves.ts';
import { Tutorial } from './tutorial.ts';
import { accountLevelFromXp } from '../config/talents.ts';
import type { TowerId } from '../config/towers.ts';

export type FloatKind = 'hit' | 'crit' | 'dot' | 'tower' | 'heal' | 'gold' | 'info';
export type NoticeKind = 'info' | 'good' | 'warn' | 'danger';

export interface RunHooks {
  floatText(pos: THREE.Vector3, text: string, kind: FloatKind): void;
  notify(text: string, kind: NoticeKind, big?: boolean): void;
  openTowerPanel(pad: number): void;
  closeTowerPanel(): void;
  showUpgradeChoice(): void;
  onRunEnd(result: RunResult, victory: boolean): void;
  requestPause(): void;
}

export interface Selection {
  race: RaceId;
  cls: ClassId;
  mount: MountId;
  level: string;
}

interface Meteor {
  x: number;
  z: number;
  t: number;
  dur: number;
  dmg: number;
  mesh: THREE.Mesh | null;
}

/**
 * Ein einzelner Run: besitzt Szene, Welt, Held, Gegner, Türme, Wellen
 * und den gesamten Run-Zustand (Gold, Upgrades, Kristall, Ereignisse).
 */
export class Run {
  readonly scene = new THREE.Scene();
  readonly level: LevelDef;
  readonly world: World;
  readonly effects: Effects;
  readonly camera: CameraRig;
  readonly combat: Combat;
  readonly enemies: EnemyManager;
  readonly towers: TowerManager;
  readonly waves: WaveManager;
  readonly player: Player;
  readonly rng: Rng;
  readonly event: RunEventDef;
  readonly save: SaveManager;
  readonly audio: AudioEngine;
  readonly ui: RunHooks;
  readonly selection: Selection;
  readonly input: Input;

  stats!: StatBlock;
  flags = new Set<UpgradeFlag>();
  synergies = new Set<SynergyId>();
  taken: Record<string, number> = {};
  gold = 0;
  crystalHp = 1000;
  crystalMax = 1000;
  kills = 0;
  /** Kurzes Einfrieren bei wuchtigen Treffern (Hitstop). */
  hitstop = 0;
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  private framesKills = 0;
  private lastMulti = 0;
  deaths = 0;
  wavesCleared = 0;
  towersBuilt = 0;
  stats_damageDealt = 0;
  time = 0;
  frame = 0;
  paused = false;
  choosing = false;
  ended = false;
  victoryFlag = false;
  bossKilled = false;
  boss: Enemy | null = null;
  pendingOffer: UpgradeDef[] = [];
  rerolls = 0;
  buildMode = false;
  selectedPad = -1;
  hoverPad = -1;
  challengeActive = false;
  private challengeT = 0;
  private meteorT = 10;
  private meteors: Meteor[] = [];
  private endTimer = -1;
  private ambushAnnounced = false;
  readonly aim = new THREE.Vector3();
  /** Gewähltes Ziel (Linksklick / Tab), Rechtsklick startet den Angriff. */
  target: Enemy | null = null;
  private targetRing: THREE.Mesh;
  readonly accountLevel: number;
  readonly tutorial: Tutorial | null;
  private panelByKey = false;
  private tmpV = new THREE.Vector3();
  private fog: THREE.Fog;

  constructor(opts: { save: SaveManager; audio: AudioEngine; hooks: RunHooks; selection: Selection; input: Input; aspect: number; seed?: number }) {
    this.save = opts.save;
    this.audio = opts.audio;
    this.ui = opts.hooks;
    this.selection = opts.selection;
    this.input = opts.input;
    this.level = LEVEL_BY_ID[opts.selection.level];
    const settings = opts.save.data.settings;
    this.rng = new Rng(opts.seed ?? Rng.randomSeed());
    this.accountLevel = accountLevelFromXp(opts.save.data.accountXp).level;
    // Der allererste Run ist bewusst ruhig – keine Zufallsereignisse
    this.event = opts.save.data.stats.runs === 0 ? RUN_EVENTS[0] : rollRunEvent(this.rng.fork(1));
    this.world = new World(this.level, settings.quality);
    this.scene.add(this.world.group);
    const b = this.world.biome;
    this.fog = new THREE.Fog(b.fog, b.fogNear, b.fogFar);
    this.scene.fog = this.fog;
    this.effects = new Effects(settings.particles);
    this.scene.add(this.effects.group);
    this.camera = new CameraRig(opts.aspect);
    this.camera.shakeEnabled = settings.screenShake;
    this.recalcStats();
    this.combat = new Combat(this);
    this.enemies = new EnemyManager(this);
    this.towers = new TowerManager(this);
    this.waves = new WaveManager(this, generateWaves(this.level, this.rng.fork(2), { extraElites: this.event.extraElites }));
    this.player = new Player(this);
    const s = this.level.playerStart;
    this.player.spawnAt(s.x, s.z);
    this.player.invulnT = 0;
    const boons = this.save.data.boons;
    this.crystalMax = Math.round(this.level.crystalHp * (1 + 0.1 * (boons.crystal ?? 0)));
    this.crystalHp = this.crystalMax;
    this.gold = this.level.startGold + 25 * (boons.gold ?? 0) + this.event.startGold;
    this.rerolls = boons.reroll ?? 0;
    // Kamera blickt vom Kristall Richtung Portale – Gegner kommen von "oben"
    const portals = this.level.paths.map((pt) => pt[0]);
    const px = portals.reduce((a, v) => a + v.x, 0) / portals.length;
    const pz = portals.reduce((a, v) => a + v.z, 0) / portals.length;
    const c = this.level.crystal;
    this.camera.yaw = Math.hypot(px - c.x, pz - c.z) > 4 ? Math.atan2(px - c.x, pz - c.z) : 0;
    this.player.facing = this.camera.yaw;
    this.camera.snapTo(s.x, 0, s.z);
    this.audio.setMusic(this.level.biome);
    if (this.level.firstPrep) this.waves.countdown = this.level.firstPrep;
    this.targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.targetRing.visible = false;
    this.scene.add(this.targetRing);
    this.tutorial = opts.save.data.tutorialDone ? null : new Tutorial(this);
  }

  /** Ist dieser Turmtyp in diesem Run schon verfügbar? (sanfter Einstieg im ersten Gebiet) */
  towerUnlockWave(id: TowerId): number {
    if (!this.level.towerUnlocks || this.accountLevel >= 4) return 0;
    return this.level.towerUnlocks[id] ?? 0;
  }

  towerAvailable(id: TowerId): boolean {
    return this.waves.index >= this.towerUnlockWave(id);
  }

  get waveIndexForScaling(): number {
    return Math.min(this.waves.index, this.waves.total - 1);
  }

  recalcStats(): void {
    const sel = this.selection;
    const mods: StatMod[] = [...RACES[sel.race].mods, ...talentMods(this.save.data.talents), ...this.event.playerMods];
    this.flags.clear();
    for (const [id, stacks] of Object.entries(this.taken)) {
      const u = UPGRADE_BY_ID[id];
      if (!u) continue;
      for (let i = 0; i < stacks; i++) mods.push(...u.mods);
      for (const f of u.flags ?? []) this.flags.add(f);
    }
    this.synergies.clear();
    for (const syn of activeSynergies(this.taken)) {
      this.synergies.add(syn.id);
      mods.push(...syn.mods);
    }
    const prevMax = this.stats?.maxHp;
    this.stats = computeStats(CLASSES[sel.cls].base, mods);
    // Leben proportional mitskalieren, wenn sich das Maximum ändert
    if (prevMax && this.player) this.player.hp = Math.min(this.stats.maxHp, this.player.hp * (this.stats.maxHp / prevMax));
  }

  /* ── Hooks für Systeme ─────────────────────────────────────── */
  notify(text: string, kind: NoticeKind = 'info', big = false): void {
    this.ui.notify(text, kind, big);
  }

  addGold(amount: number, pos?: { x: number; y: number; z: number }): void {
    this.gold += amount;
    if (pos && this.save.data.settings.damageNumbers) this.ui.floatText(new THREE.Vector3(pos.x, pos.y, pos.z), `+${amount}`, 'gold');
    this.audio.play('coin', 0.25);
  }

  addHitstop(t: number): void {
    this.hitstop = Math.min(0.14, Math.max(this.hitstop, t));
  }

  /** Kombo-Zähler & Mehrfachtötungen – belohnt aggressives Spiel. */
  onKill(e: Enemy, source: string): void {
    if (source === 'tower' || source === 'env') return;
    this.framesKills++;
    this.combo++;
    this.comboT = 3.2;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const tiers: [number, string][] = [[50, 'GÖTTLICH!'], [30, 'UNAUFHALTSAM!'], [20, 'BLUTRAUSCH!'], [10, 'GEMETZEL!'], [5, 'KILLING SPREE!']];
    for (const [n, label] of tiers) {
      if (this.combo === n) {
        const bonus = Math.round(n * 1.5 * this.stats.gold);
        this.gold += bonus;
        this.notify(`${label}  ×${n} · +${bonus} Gold`, 'good', true);
        this.audio.play('levelup', 0.7);
        this.camera.shake(0.25, 0.25);
        break;
      }
    }
    void e;
  }

  onBossSpawn(e: Enemy): void {
    this.boss = e;
    this.notify(`${e.def.name} betritt das Schlachtfeld!`, 'danger', true);
    this.camera.shake(0.5, 0.6);
  }

  onBossKilled(e: Enemy): void {
    this.bossKilled = true;
    this.notify(`${e.def.name} ist besiegt!`, 'good', true);
    this.effects.ring(e.x, e.y, e.z, 10, 0xfbbf24, 1);
    this.camera.shake(0.7, 0.6);
    this.audio.play('victory', 0.6);
  }

  scheduleMeteor(x: number, z: number, delay: number, dmg: number): void {
    const y = this.world.heightAt(x, z);
    this.effects.telegraph(x, y, z, 3.2, delay, 0xf97316);
    this.meteors.push({ x, z, t: 0, dur: delay, dmg, mesh: null });
  }

  /* ── Upgrades ─────────────────────────────────────────────── */
  offerUpgrades(): void {
    this.pendingOffer = rollUpgradeOffer(this.rng, this.taken, { classId: this.selection.cls });
    if (this.pendingOffer.length === 0) return;
    this.choosing = true;
    this.input.releaseAll();
    this.ui.showUpgradeChoice();
  }

  reroll(): boolean {
    if (this.rerolls <= 0) return false;
    this.rerolls--;
    this.pendingOffer = rollUpgradeOffer(this.rng, this.taken, { classId: this.selection.cls });
    return true;
  }

  chooseUpgrade(id: string): void {
    const u = UPGRADE_BY_ID[id];
    if (!u) return;
    const synBefore = new Set(this.synergies);
    this.taken[id] = (this.taken[id] ?? 0) + 1;
    this.recalcStats();
    if (u.flags?.includes('crystalWard') && (this.taken[id] ?? 0) === 1) {
      const add = Math.round(this.crystalMax * 0.2);
      this.crystalMax += add;
      this.crystalHp += add;
    }
    for (const s of this.synergies) {
      if (!synBefore.has(s)) {
        const def = activeSynergies(this.taken).find((x) => x.id === s);
        if (def) this.notify(`Synergie aktiviert: ${def.name}`, 'good', true);
      }
    }
    this.pendingOffer = [];
    this.choosing = false;
    this.audio.play('upgrade');
    const p = this.player;
    this.effects.ring(p.x, p.y, p.z, 3, 0xc084fc, 0.6);
  }

  /* ── Rundenende ───────────────────────────────────────────── */
  victory(): void {
    if (this.ended) return;
    this.ended = true;
    this.victoryFlag = true;
    this.endTimer = 2.6;
    this.audio.play('victory');
    this.audio.setMusic(null);
    this.notify('Sieg! Der Aetherkristall ist gerettet.', 'good', true);
    this.closeBuild();
  }

  defeat(): void {
    if (this.ended) return;
    this.ended = true;
    this.victoryFlag = false;
    this.endTimer = 2.6;
    const c = this.world.crystal;
    c.core.visible = false;
    c.light.intensity = 0;
    const lc = this.level.crystal;
    this.effects.burst({ x: lc.x, y: 3, z: lc.z }, 0x67e8f9, 120, 12, 1.2);
    this.effects.ring(lc.x, 0, lc.z, 12, 0x22d3ee, 1.2);
    this.camera.shake(0.8, 0.8);
    this.audio.play('explosion');
    this.audio.play('defeat');
    this.audio.setMusic(null);
    this.notify('Der Aetherkristall ist zerbrochen …', 'danger', true);
    this.closeBuild();
  }

  buildResult(): RunResult {
    return {
      levelId: this.level.id,
      victory: this.victoryFlag,
      wavesCleared: this.wavesCleared,
      totalWaves: this.waves.total,
      kills: this.kills,
      bossKilled: this.bossKilled,
      shardMul: this.event.shardMul,
      mountId: this.selection.mount,
      mountXp: this.player.mountXpGain,
      timeSec: this.time,
    };
  }

  /* ── Bauen & Interaktion ─────────────────────────────────── */
  toggleBuildMode(): void {
    this.buildMode = !this.buildMode;
    if (!this.buildMode) this.closeBuild();
    this.towers.showRanges(this.buildMode);
    this.notify(this.buildMode ? 'Baumodus: Klicke auf einen Bauplatz' : 'Baumodus beendet', 'info');
  }

  setTarget(e: Enemy | null, attack = false): void {
    this.target = e;
    this.player.autoAttack = !!e && (attack || this.player.autoAttack);
    if (!e) this.player.autoAttack = false;
  }

  /** Gegner unter einem Bildschirmpunkt (Projektion der Körpermitte). */
  pickEnemy(ndcX: number, ndcY: number): Enemy | null {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const v = this.camera.project(e.x, e.y + e.rig.barHeight * 0.5, e.z, this.tmpV);
      if (v.z > 1) continue;
      const dx = ((v.x - ndcX) * w) / 2;
      const dy = ((v.y - ndcY) * h) / 2;
      const d = Math.hypot(dx, dy);
      const camDist = this.camera.camera.position.distanceTo(this.tmpV.set(e.x, e.y, e.z));
      const radiusPx = Math.max(26, (e.rig.barHeight * 0.6 * h) / Math.max(4, camDist));
      if (d < radiusPx && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Tab: nächstes Ziel vor dem Helden, reihum. */
  cycleTarget(): void {
    const p = this.player;
    const fx = Math.sin(p.facing);
    const fz = Math.cos(p.facing);
    const cands = this.enemies.list
      .filter((e) => e.alive && dist2(e.x, e.z, p.x, p.z) < 30 * 30)
      .map((e) => {
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        return { e, score: d * (1.6 - (dx * fx + dz * fz) / d) };
      })
      .sort((a, b) => a.score - b.score)
      .map((c) => c.e);
    if (cands.length === 0) {
      this.notify('Kein Ziel in der Nähe', 'info');
      return;
    }
    const i = this.target ? cands.indexOf(this.target) : -1;
    this.setTarget(cands[(i + 1) % cands.length]);
  }

  selectPad(i: number, byKey = false): void {
    this.panelByKey = byKey;
    this.selectedPad = i;
    this.towers.showRanges(true, this.buildMode ? -1 : i);
    this.ui.openTowerPanel(i);
    this.audio.play('click');
  }

  closeBuild(): void {
    if (this.selectedPad >= 0) {
      this.selectedPad = -1;
      this.ui.closeTowerPanel();
    }
    if (!this.buildMode) this.towers.showRanges(false);
  }

  /** Escape-Logik: erst Panel, dann Baumodus, dann Pause. */
  handleEscape(): void {
    if (this.selectedPad >= 0) {
      this.closeBuild();
      return;
    }
    if (this.buildMode) {
      this.toggleBuildMode();
      return;
    }
    if (this.target) {
      this.setTarget(null);
      return;
    }
    this.ui.requestPause();
  }

  private nearestPad(x: number, z: number, maxDist: number): number {
    let best = -1;
    let bd = maxDist * maxDist;
    this.level.pads.forEach((p, i) => {
      const d = dist2(p.x, p.z, x, z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /* ── Hauptupdate ─────────────────────────────────────────── */
  update(dt: number): void {
    const input = this.input;
    this.frame++;
    if (this.choosing) {
      input.endFrame();
      return;
    }
    this.time += dt;

    if (input.pressed('pause')) this.handleEscape();
    if (!this.ended) {
      if (input.pressed('build')) this.toggleBuildMode();
      if (input.pressed('nextWave')) this.waves.callEarly();
    }

    const p = this.player;
    const sens = this.save.data.settings.cameraSensitivity;

    // Kamera: Ziehen mit linker oder rechter Maustaste dreht/neigt
    if (input.wheel) this.camera.zoom(input.wheel);
    if ((input.leftDrag || input.rightDrag) && (input.lookDX || input.lookDY)) this.camera.orbit(input.lookDX, input.lookDY, sens);

    // Ziel ungültig?
    if (this.target && !this.target.alive) this.setTarget(null);

    // Bauplatz unter dem Mauszeiger (für Baumodus & Klicks)
    if (!input.leftDown && !input.rightDown) this.camera.groundPoint(input.mouse.x, input.mouse.y, (x, z) => this.world.heightAt(x, z), this.aim);
    this.hoverPad = this.nearestPad(this.aim.x, this.aim.z, 2.6);
    const nearPad = p.alive ? this.nearestPad(p.x, p.z, 3.6) : -1;

    if (!this.ended) {
      if (input.pressed('target')) this.cycleTarget();
      // Linksklick: Ziel wählen – oder Bauplatz öffnen
      const lc = input.leftClick;
      if (lc) {
        const e = this.pickEnemy(lc.x, lc.y);
        if (e) this.setTarget(e);
        else {
          this.camera.groundPoint(lc.x, lc.y, (x, z) => this.world.heightAt(x, z), this.aim);
          const pad = this.nearestPad(this.aim.x, this.aim.z, 2.6);
          if (pad >= 0) this.selectPad(pad);
          else if (this.selectedPad >= 0) this.closeBuild();
          else this.setTarget(null);
        }
      }
      // Rechtsklick: angreifen – oder mit Bauplatz interagieren
      const rc = input.rightClick;
      if (rc) {
        const e = this.pickEnemy(rc.x, rc.y);
        if (e) this.setTarget(e, true);
        else {
          this.camera.groundPoint(rc.x, rc.y, (x, z) => this.world.heightAt(x, z), this.aim);
          const pad = this.nearestPad(this.aim.x, this.aim.z, 2.6);
          if (pad >= 0) this.selectPad(pad);
        }
      }
      if (input.pressed('interact')) {
        if (nearPad >= 0 && this.selectedPad !== nearPad) this.selectPad(nearPad, true);
        else if (this.selectedPad >= 0) this.closeBuild();
        else p.toggleMount();
      }
      // Per Taste geöffnetes Turmmenü schließt sich, wenn man weggeht
      if (this.selectedPad >= 0 && this.panelByKey) {
        const pad = this.level.pads[this.selectedPad];
        if (dist(p.x, p.z, pad.x, pad.z) > 8) this.closeBuild();
      }
    }
    this.nearPad = nearPad;
    this.world.setPadHighlight(this.buildMode || this.selectedPad >= 0, this.selectedPad >= 0 ? this.selectedPad : this.buildMode ? this.hoverPad : -1, this.towers.towers.map((t) => !!t));

    // Das Turmmenü ist nicht modal: Kämpfen bleibt jederzeit möglich
    p.update(dt, input, this.target, !this.ended);

    // Kamera folgt der Figur, solange man sie nicht selbst führt
    if (!input.leftDown && !input.rightDown) {
      const moving = Math.hypot(p.vx, p.vz) > 0.5;
      if (moving || p.turning) this.camera.followBehind(p.facing, dt, p.turning ? 9 : 3);
    }

    // Zielmarkierung
    const t = this.target;
    this.targetRing.visible = !!t;
    if (t) {
      const r = t.radius + 0.5;
      this.targetRing.position.set(t.x, t.y + 0.08, t.z);
      this.targetRing.scale.setScalar(r);
      (this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(p.autoAttack ? 0xff4d4d : 0xffd166);
    }
    this.tutorial?.update(dt);

    if (!this.ended || !this.victoryFlag) this.waves.update(this.ended ? 0 : dt);
    this.enemies.update(dt);
    this.towers.update(dt);
    this.combat.update(dt);
    this.updateChallenge(dt);
    this.updateMeteors(dt);

    // Kristall-Regeneration zwischen Wellen (Kristallschild)
    if (this.flags.has('crystalWard') && this.waves.phase === 'prep' && !this.ended) {
      this.crystalHp = Math.min(this.crystalMax, this.crystalHp + this.crystalMax * 0.015 * dt);
    }

    // Kamera & Welt
    const focusX = p.alive ? p.x : this.level.crystal.x;
    const focusZ = p.alive ? p.z : this.level.crystal.z;
    this.camera.update(dt, focusX, p.alive ? p.y : 0, focusZ, (x, z) => this.world.heightAt(x, z));
    const weatherMul = this.challengeActive ? 3 : 1;
    this.world.update(dt, this.camera.camera.position, weatherMul);
    const b = this.world.biome;
    const targetFar = this.challengeActive ? 55 : b.fogFar;
    this.fog.far += (targetFar - this.fog.far) * Math.min(1, dt * 1.5);
    this.fog.near += ((this.challengeActive ? 12 : b.fogNear) - this.fog.near) * Math.min(1, dt * 1.5);
    this.effects.update(dt);

    if (this.boss && !this.boss.alive && this.boss.deathT > 1) this.boss = null;

    if (this.endTimer >= 0) {
      this.endTimer -= dt;
      if (this.endTimer < 0) this.ui.onRunEnd(this.buildResult(), this.victoryFlag);
    }
    // Kombo verfällt, Mehrfachtötung in einem Moment = Hitstop + Wackeln
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.framesKills >= 3 && this.time - this.lastMulti > 0.4) {
      this.lastMulti = this.time;
      this.addHitstop(0.07 + Math.min(0.05, this.framesKills * 0.01));
      this.camera.shake(0.3, 0.2);
      if (this.framesKills >= 4) this.ui.floatText(new THREE.Vector3(this.player.x, this.player.y + 3.2, this.player.z), `${this.framesKills}× KILL`, 'crit');
    }
    this.framesKills = 0;
    input.endFrame();
  }

  nearPad = -1;

  private updateChallenge(dt: number): void {
    const id = this.level.challenge.id;
    const active = this.waves.phase === 'active' && !this.ended;
    if (id === 'ambush') {
      const w = this.waves.current;
      if (!this.ambushAnnounced && active && w && w.groups.some((g) => g.path === 1)) {
        this.ambushAnnounced = true;
        this.notify('Hinterhalt! Ein zweites Portal öffnet sich im Osten.', 'warn', true);
      }
      return;
    }
    if (id === 'meteors') {
      if (!active) return;
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = 16;
        const p = this.player;
        for (let i = 0; i < 3; i++) {
          const path = this.rng.pick(this.level.paths);
          const pt = this.rng.pick(path);
          const nearPlayer = i === 0 && p.alive;
          const x = nearPlayer ? p.x + this.rng.range(-3, 3) : pt.x + this.rng.range(-3, 3);
          const z = nearPlayer ? p.z + this.rng.range(-3, 3) : pt.z + this.rng.range(-3, 3);
          this.scheduleMeteor(x, z, 2 + i * 0.3, 45);
        }
        this.notify('Meteoritenregen!', 'warn');
      }
      return;
    }
    // Sandsturm & Schneesturm: periodisch
    const period = id === 'sandstorm' ? 45 : 40;
    const dur = id === 'sandstorm' ? 12 : 10;
    if (!active && !this.challengeActive) return;
    this.challengeT += dt;
    if (!this.challengeActive && this.challengeT >= period) {
      this.challengeActive = true;
      this.challengeT = 0;
      this.notify(id === 'sandstorm' ? 'Ein Sandsturm zieht auf – Turmreichweite reduziert!' : 'Schneesturm! Du wirst langsamer, Gegner schneller.', 'warn', true);
      this.world.setWeatherIntensity(2);
    } else if (this.challengeActive && this.challengeT >= dur) {
      this.challengeActive = false;
      this.challengeT = 0;
      this.world.setWeatherIntensity(1);
      this.notify('Der Sturm legt sich.', 'info');
    }
  }

  private updateMeteors(dt: number): void {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt;
      const y = this.world.heightAt(m.x, m.z);
      const fallStart = m.dur - 0.6;
      if (m.t >= fallStart) {
        if (!m.mesh) m.mesh = this.effects.acquireProjectile('meteor', 0xff4d00);
        const f = Math.min(1, (m.t - fallStart) / 0.6);
        m.mesh.position.set(m.x - 6 * (1 - f), y + 24 * (1 - f), m.z);
        m.mesh.rotation.x += dt * 5;
        this.effects.trail(m.mesh.position, 0xff7a1a);
      }
      if (m.t >= m.dur) {
        if (m.mesh) this.effects.releaseProjectile(m.mesh);
        this.meteors.splice(i, 1);
        this.effects.burst({ x: m.x, y: y + 0.5, z: m.z }, 0xff7a1a, 40, 9, 0.8);
        this.effects.ring(m.x, y, m.z, 3.5, 0xf97316, 0.5);
        this.effects.puff({ x: m.x, y: y + 1, z: m.z }, 0x44403c, 8, 2, 1.2);
        this.audio.play('explosion', 0.7);
        this.camera.shake(0.3, 0.25);
        const p = this.player;
        if (p.alive && dist(p.x, p.z, m.x, m.z) < 3.4) this.combat.damagePlayer(m.dmg);
        for (const e of [...this.enemies.inRadius(m.x, m.z, 3.2)]) {
          if (!e.def.boss) this.combat.damageEnemy(e, m.dmg * 2.5, { source: 'env', element: 'fire', canCrit: false });
        }
      }
    }
  }

  dispose(): void {
    this.combat.clear();
    this.enemies.clear();
    this.towers.clear();
    this.player.dispose();
    this.world.dispose();
    this.effects.dispose();
    this.scene.clear();
  }
}
