import { keyLabel, type Action } from '../config/keybinds.ts';
import { TOWERS, TOWER_ORDER, type TowerId } from '../config/towers.ts';
import { RACIAL_UNLOCK_LEVEL, SKILL_UNLOCK_LEVEL } from '../config/talents.ts';
import { activeSynergies, RARITY_INFO, SYNERGIES, tagCounts, UPGRADE_BY_ID, type UpgradeDef, type UpgradeTag } from '../config/upgrades.ts';
import { THEME_INFO, waveSummary } from '../config/waves.ts';
import { formatTime } from '../core/math.ts';
import { seedToCode } from '../core/rng.ts';
import type { Run } from '../game/run.ts';
import { el, esc, fmt, onAction } from './dom.ts';
import { icon } from './icons.ts';
import type { UI } from './ui.ts';

const TAG_LABEL: Record<UpgradeTag, string> = {
  klinge: 'Klinge',
  turm: 'Turm',
  frost: 'Frost',
  feuer: 'Feuer',
  arkan: 'Arkan',
  reittier: 'Reittier',
  schutz: 'Schutz',
  tempo: 'Tempo',
  gold: 'Gold',
  rasse: 'Rasse',
};

const BUFF_INFO: Record<string, { name: string; icon: string; good: boolean }> = {
  crown: { name: 'Wille der Krone', icon: 'crown', good: true },
  bulwark: { name: 'Bollwerk', icon: 'shield', good: true },
  fortress: { name: 'Bergfestung', icon: 'mountain', good: true },
  cavalry: { name: 'Kavallerie', icon: 'horse', good: true },
  pack: { name: 'Rudelruf', icon: 'paw', good: true },
  awaken: { name: 'Erwachtes Blut', icon: 'star', good: true },
  smoke: { name: 'Rauchbombe', icon: 'smoke', good: true },
  nextCrit: { name: 'Schattenschritt', icon: 'shadow', good: true },
};

interface Slot {
  root: HTMLElement;
  cd: HTMLElement;
  txt: HTMLElement;
  ico: HTMLElement;
  lastIcon: string;
}

/**
 * Kampf-HUD: Kristall, Gold, Wellen, Bossleiste, Einheitenrahmen,
 * Aktionsleiste mit Abklingzeiten, Minimap, Turmmenü, Upgrade-Auswahl, Pause.
 */
export class Hud {
  private ui: UI;
  readonly root: HTMLElement;
  private q: Record<string, HTMLElement> = {};
  private slots: Record<string, Slot> = {};
  private minimap!: HTMLCanvasElement;
  private mmAcc = 0;
  private slowAcc = 0;
  private overlay: HTMLElement;
  private towerPanel: HTMLElement;
  private panelPad = -1;
  private panelKey = '';
  private choiceVisible = false;
  private questVersion = -1;
  private sellConfirmUntil = 0;
  pauseVisible = false;

  constructor(ui: UI, layer: HTMLElement) {
    this.ui = ui;
    this.root = el('div', 'hud is-hidden');
    layer.appendChild(this.root);
    this.overlay = el('div', 'hud-overlay is-hidden');
    layer.appendChild(this.overlay);
    this.towerPanel = el('div', 'tower-panel glass is-hidden');
    layer.appendChild(this.towerPanel);
    onAction(this.root, (a, t) => this.handle(a, t));
    onAction(this.overlay, (a, t) => this.handle(a, t));
    onAction(this.towerPanel, (a, t) => this.handle(a, t));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private get run(): Run | null {
    return this.ui.app.run;
  }

  build(run: Run): void {
    const d = this.ui.app.save.data;
    const cls = run.player.cls;
    const race = run.player.race;
    const k = (a: Action) => esc(keyLabel(d.keys[a]));
    const slot = (id: string, ico: string, key: string, tip: string, extra = '') =>
      `<div class="slot ${extra}" data-slot="${id}" data-tip="${esc(tip)}"><span class="slot-ico">${icon(ico, 26)}</span><span class="slot-cd"></span><span class="slot-txt"></span><kbd>${key}</kbd></div>`;
    this.root.innerHTML = `
      <div class="hud-tl glass">
        <div class="crystal-row" data-tip="Aetherkristall – wird er zerstört, endet der Run.">
          <span class="crys-ico">${icon('crystal', 22)}</span>
          <div class="crys-bar"><div class="bar bar-crystal"><i data-q="crysBar"></i></div><small data-q="crysTxt"></small></div>
        </div>
        <div class="tl-row">
          <span class="gold" data-tip="Gold – für Türme und Aufwertungen">${icon('coin', 18)}<b data-q="gold">0</b></span>
          <span class="chip" data-q="event"></span>
        </div>
        <div class="tl-row small muted"><span data-q="time">0:00</span><span>·</span><span data-q="kills">0</span><span>·</span><span data-tip="Seed dieses Runs (reproduzierbare Zufallswerte)">Seed ${seedToCode(run.rng.seed)}</span></div>
      </div>
      <div class="quest glass is-hidden" data-q="quest"></div>
      <div class="hud-preview glass" data-q="preview"></div>
      <div class="hud-tc">
        <div class="wave-panel glass">
          <div class="wave-title"><b data-q="waveTitle"></b><span data-q="waveSub"></span></div>
          <button class="btn btn-sm btn-primary call-btn" data-action="callWave" data-q="callBtn">${icon('flag', 14)}<span data-q="callTxt">Welle rufen</span><kbd>${k('nextWave')}</kbd></button>
        </div>
        <div class="boss-panel glass is-hidden" data-q="boss">
          <div class="boss-name">${icon('skull', 16)}<b data-q="bossName"></b><span data-q="bossPct"></span></div>
          <div class="bar bar-boss"><i data-q="bossBar"></i></div>
        </div>
        <div class="target-frame glass is-hidden" data-q="tframe">
          <div class="tf-head"><b data-q="tName"></b><span data-q="tRole"></span></div>
          <div class="bar bar-target"><i data-q="tBar"></i><span data-q="tTxt"></span></div>
        </div>
        <div class="challenge-chip is-hidden" data-q="challenge">${icon('wind', 14)}<span>${esc(run.level.challenge.name)} aktiv</span></div>
      </div>
      <div class="hud-tr">
        <div class="minimap-wrap glass" data-q="mmWrap"><canvas width="200" height="200" data-q="minimap"></canvas><span class="mm-n">${icon('arrowUp', 12)}</span></div>
        <div class="upgrades glass" data-q="upgrades"></div>
      </div>
      <div class="hud-bc">
        <div class="prompt" data-q="prompt"></div>
        <div class="unit-frame glass">
          <div class="portrait" style="--accent:${race.color}">${icon(cls.icon, 30)}</div>
          <div class="uf-bars">
            <div class="uf-name"><b>${esc(race.name.split(' ')[0])} ${esc(cls.name)}</b><span data-q="mountState"></span></div>
            <div class="bar bar-hp"><i data-q="hpBar"></i><span data-q="hpTxt"></span></div>
            <div class="bar bar-res" style="--res:${cls.resource.color}"><i data-q="resBar"></i><span data-q="resTxt"></span></div>
            <div class="buffs" data-q="buffs"></div>
          </div>
        </div>
        <div class="actionbar glass">
          ${slot('attack', cls.icon, 'RMB', `Automatischer Angriff – Rechtsklick auf einen Gegner (${cls.attack.kind === 'melee' ? 'Nahkampf' : 'Fernkampf'}). Klick hier schaltet ihn ein/aus.`)}
          ${cls.skills.map((s, i) => slot(`s${i}`, s.icon, k(`skill${i + 1}` as Action), `${s.name} (${s.cost} ${cls.resource.name}, ${s.cooldown} s): ${s.desc}`)).join('')}
          <span class="ab-sep"></span>
          ${slot('racial', race.activeIcon, k('racial'), `${race.activeName} (${race.cooldown} s): ${race.activeDesc}`, 'slot-racial')}
          ${slot('dodge', 'wind', k('dodge'), 'Ausweichrolle (unverwundbar) – im Sattel: Reittier-Ansturm')}
          ${slot('mount', run.player.mountDef.icon, k('interact'), `${run.player.mountDef.name}: Auf-/Absitzen (am Bauplatz: Turmmenü)`)}
          ${slot('build', 'hammer', k('build'), 'Baumodus: Bauplätze anklicken, um Türme zu bauen')}
        </div>
      </div>
      <div class="dmg-vignette" data-q="vign"></div>
      <div class="combo is-hidden" data-q="combo"><b data-q="comboN">0</b><span>KOMBO</span><i data-q="comboBar"></i></div>
      <div class="hud-death is-hidden" data-q="death"><b>Gefallen</b><span data-q="deathTxt"></span></div>
    `;
    this.q = {};
    for (const n of this.root.querySelectorAll<HTMLElement>('[data-q]')) this.q[n.dataset.q!] = n;
    this.slots = {};
    for (const n of this.root.querySelectorAll<HTMLElement>('[data-slot]')) {
      this.slots[n.dataset.slot!] = { root: n, cd: n.querySelector('.slot-cd')!, txt: n.querySelector('.slot-txt')!, ico: n.querySelector('.slot-ico')!, lastIcon: '' };
    }
    this.slots.build.root.dataset.action = 'toggleBuild';
    this.slots.attack.root.dataset.action = 'toggleAttack';
    // Noch nicht erlernte Fähigkeiten sichtbar sperren
    cls.skills.forEach((sk, i) => {
      if (!run.player.skillUnlocked(i)) {
        const sl = this.slots[`s${i}`];
        sl.root.classList.add('is-locked');
        sl.ico.innerHTML = icon('lock', 22);
        sl.root.dataset.tip = esc(`${sk.name} – erlernst du ab Kontostufe ${SKILL_UNLOCK_LEVEL[i]}`);
      }
    });
    if (!run.player.racialUnlocked) {
      const sl = this.slots.racial;
      sl.root.classList.add('is-locked');
      sl.ico.innerHTML = icon('lock', 22);
      sl.root.dataset.tip = esc(`${race.activeName} – erlernst du ab Kontostufe ${RACIAL_UNLOCK_LEVEL}`);
    }
    this.questVersion = -1;
    this.minimap = this.q.minimap as unknown as HTMLCanvasElement;
    this.q.event.innerHTML = `${icon(run.event.icon, 14)}<span>${esc(run.event.name)}</span>`;
    this.q.event.dataset.tip = run.event.desc;
    this.renderUpgrades(run);
    this.root.classList.remove('is-hidden');
    this.hideOverlay();
    this.closeTowerPanel();
  }

  hide(): void {
    this.root.classList.add('is-hidden');
    this.hideOverlay();
    this.closeTowerPanel();
  }

  /* ── Laufende Aktualisierung ─────────────────────────────── */
  update(run: Run, dt: number): void {
    const p = run.player;
    const q = this.q;
    if (!q.hpBar) return;
    const setW = (e: HTMLElement, r: number) => (e.style.transform = `scaleX(${Math.max(0, Math.min(1, r)).toFixed(4)})`);
    setW(q.hpBar, p.hp / p.maxHp);
    setW(q.resBar, p.res / p.maxRes);
    setW(q.crysBar, run.crystalHp / run.crystalMax);
    q.crysBar.parentElement!.classList.toggle('is-low', run.crystalHp / run.crystalMax < 0.3);

    // Aktionsleiste
    const cdSet = (id: string, cd: number, max: number, extraCls?: { disabled?: boolean; active?: boolean }) => {
      const s = this.slots[id];
      if (!s) return;
      const r = max > 0 ? Math.max(0, Math.min(1, cd / max)) : 0;
      s.cd.style.setProperty('--p', r.toFixed(3));
      s.cd.style.display = r > 0 ? 'block' : 'none';
      const txt = cd > 0.05 && max >= 1.5 ? (cd >= 10 ? Math.ceil(cd).toString() : cd.toFixed(1).replace('.', ',')) : '';
      if (s.txt.textContent !== txt) s.txt.textContent = txt;
      s.root.classList.toggle('is-disabled', !!extraCls?.disabled);
      s.root.classList.toggle('is-active', !!extraCls?.active);
    };
    const atkMax = p.cls.attack.interval / p.attackSpeedMul();
    cdSet('attack', p.autoAttack ? p.attackCd : 0, atkMax, { active: p.autoAttack && !!run.target });
    p.cls.skills.forEach((s, i) => {
      if (p.skillUnlocked(i)) cdSet(`s${i}`, p.skillCd[i], p.skillMax[i], { disabled: p.res < s.cost || !p.alive });
    });
    if (p.racialUnlocked) cdSet('racial', p.racialCd, p.racialMax, { disabled: !p.alive });
    // Treffer-Vignette & niedriges Leben
    const low = p.alive ? Math.max(0, 0.35 - p.hp / p.maxHp) / 0.35 : 0;
    const pulse = low > 0 ? 0.55 + 0.45 * Math.sin(performance.now() * 0.008) : 0;
    const vig = Math.min(1, Math.max(0, p.flashT / 0.15) * 0.8 + low * pulse * 0.9);
    q.vign.style.opacity = vig.toFixed(3);
    // Kombo
    if (run.combo >= 2) {
      q.combo.classList.remove('is-hidden');
      const n = String(run.combo);
      if (q.comboN.textContent !== n) {
        q.comboN.textContent = n;
        q.combo.classList.remove('bump');
        void q.combo.offsetWidth;
        q.combo.classList.add('bump');
        q.combo.dataset.tier = run.combo >= 30 ? '3' : run.combo >= 10 ? '2' : run.combo >= 5 ? '1' : '0';
      }
      q.comboBar.style.transform = `scaleX(${Math.max(0, run.comboT / 3.2).toFixed(3)})`;
    } else q.combo.classList.add('is-hidden');
    // Zielrahmen
    const t = run.target;
    q.tframe.classList.toggle('is-hidden', !t);
    if (t) {
      setW(q.tBar, t.hp / t.maxHp);
      const name = (t.affix ? `${t.affix.name} ` : '') + t.def.name;
      if (q.tName.textContent !== name) q.tName.textContent = name;
      const role = t.def.role;
      if (q.tRole.textContent !== role) q.tRole.textContent = role;
      const txt = `${fmt(Math.max(0, t.hp))} / ${fmt(t.maxHp)}`;
      if (q.tTxt.textContent !== txt) q.tTxt.textContent = txt;
      q.tframe.classList.toggle('is-attacking', p.autoAttack);
    }
    const dodge = this.slots.dodge;
    const wantIcon = p.mounted ? 'charge' : 'wind';
    if (dodge.lastIcon !== wantIcon) {
      dodge.ico.innerHTML = icon(wantIcon, 26);
      dodge.lastIcon = wantIcon;
      dodge.root.dataset.tip = p.mounted ? `${p.mountDef.chargeName}: ${p.mountDef.chargeDesc}` : 'Ausweichrolle (unverwundbar)';
    }
    if (p.mounted) cdSet('dodge', p.chargeCd, p.chargeMax);
    else cdSet('dodge', p.dodgeCd, p.dodgeMax);
    cdSet('mount', p.mountCastT >= 0 ? p.mountCastT : 0, 0.6, { active: p.mounted });
    cdSet('build', 0, 0, { active: run.buildMode });

    this.slowAcc += dt;
    if (this.slowAcc >= 0.1) {
      this.slowAcc = 0;
      this.slowUpdate(run);
    }
    this.mmAcc += dt;
    if (this.mmAcc >= 0.1) {
      this.mmAcc = 0;
      this.drawMinimap(run);
    }
    if (this.panelPad >= 0) this.refreshTowerPanel(false);
  }

  private slowUpdate(run: Run): void {
    const p = run.player;
    const q = this.q;
    const d = this.ui.app.save.data;
    const set = (e: HTMLElement, t: string) => {
      if (e.textContent !== t) e.textContent = t;
    };
    set(q.hpTxt, `${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}`);
    set(q.resTxt, `${fmt(p.res)} / ${fmt(p.maxRes)} ${p.cls.resource.name}`);
    set(q.crysTxt, `${fmt(run.crystalHp)} / ${fmt(run.crystalMax)}`);
    set(q.gold, fmt(run.gold));
    set(q.time, formatTime(run.time));
    set(q.kills, `${run.kills} Besiegte`);
    set(q.mountState, p.mounted ? `${p.mountDef.name} · im Sattel` : p.mountCastT >= 0 ? 'Aufsitzen …' : '');

    // Welle
    const w = run.waves;
    const cur = w.current;
    if (w.phase === 'prep' && cur) {
      set(q.waveTitle, `Welle ${w.index + 1}/${w.total}`);
      set(q.waveSub, `${THEME_INFO[cur.theme].name} in ${Math.ceil(w.countdown)} s`);
      q.callBtn.classList.remove('is-hidden');
      set(q.callTxt, `Jetzt rufen (+${Math.floor(w.countdown) * 2} Gold)`);
      q.preview.classList.remove('is-hidden');
      const key = `${w.index}`;
      if (q.preview.dataset.k !== key) {
        q.preview.dataset.k = key;
        q.preview.innerHTML = `<h4>${icon('eye', 14)} Nächste Welle · ${esc(THEME_INFO[cur.theme].name)}</h4><small class="muted">${esc(THEME_INFO[cur.theme].desc)}</small>
          <ul>${waveSummary(cur).map((s) => `<li><span>${esc(s.name)}</span><b>×${s.count}</b></li>`).join('')}</ul>
          ${cur.groups.some((g) => g.path > 0) && run.level.paths.length > 1 ? `<small class="warn">${icon('flag', 12)} Routen: ${[...new Set(cur.groups.map((g) => g.path + 1))].join(', ')}</small>` : ''}`;
      }
    } else if (w.phase === 'active' && cur) {
      set(q.waveTitle, `Welle ${w.index + 1}/${w.total}`);
      set(q.waveSub, `${THEME_INFO[cur.theme].name} · ${run.enemies.aliveCount + w.remainingToSpawn} Gegner übrig`);
      q.callBtn.classList.add('is-hidden');
      q.preview.classList.add('is-hidden');
    } else {
      set(q.waveTitle, 'Alle Wellen überstanden');
      set(q.waveSub, '');
      q.callBtn.classList.add('is-hidden');
      q.preview.classList.add('is-hidden');
    }

    // Boss
    const boss = run.boss;
    if (boss && boss.alive) {
      q.boss.classList.remove('is-hidden');
      set(q.bossName, boss.def.name + (boss.enraged ? ' · Raserei' : ''));
      set(q.bossPct, `${Math.ceil((boss.hp / boss.maxHp) * 100)} %`);
      q.bossBar.style.transform = `scaleX(${(boss.hp / boss.maxHp).toFixed(4)})`;
    } else q.boss.classList.add('is-hidden');
    q.challenge.classList.toggle('is-hidden', !run.challengeActive);

    // Buffs
    const buffKey = [...p.buffs.keys()].filter((b) => BUFF_INFO[b]).join(',') + (p.status.slowT > 0 ? ',slow' : '');
    if (q.buffs.dataset.k !== buffKey) {
      q.buffs.dataset.k = buffKey;
      q.buffs.innerHTML = [...p.buffs.keys()]
        .filter((b) => BUFF_INFO[b])
        .map((b) => `<span class="buff" data-tip="${esc(BUFF_INFO[b].name)}">${icon(BUFF_INFO[b].icon, 14)}</span>`)
        .join('') + (p.status.slowT > 0 ? `<span class="buff debuff" data-tip="Verlangsamt">${icon('frost', 14)}</span>` : '');
    }

    // Tod
    q.death.classList.toggle('is-hidden', p.alive);
    if (!p.alive) set(q.deathTxt, `Wiederbelebung in ${Math.ceil(p.respawnT)} s`);

    // Hinweise
    let prompt = '';
    if (!run.ended && p.alive) {
      if (run.selectedPad < 0 && run.nearPad >= 0) {
        const t = run.towers.towers[run.nearPad];
        prompt = `<kbd>${esc(keyLabel(d.keys.interact))}</kbd> ${t ? `${esc(t.def.name)} verwalten` : 'Turm bauen'}`;
      } else if (!run.target && run.enemies.aliveCount > 0 && run.player.attacksDone === 0) {
        prompt = `<b>Rechtsklick</b> auf einen Gegner: angreifen · <kbd>${esc(keyLabel(d.keys.target))}</kbd> Ziel wählen`;
      } else if (run.buildMode) prompt = `${icon('hammer', 14)} Baumodus – Bauplatz anklicken · <kbd>${esc(keyLabel(d.keys.build))}</kbd> beendet`;
    }
    if (q.prompt.innerHTML !== prompt) q.prompt.innerHTML = prompt;
    q.mmWrap.classList.toggle('is-hidden', !d.settings.showMinimap);
    q.upgrades.classList.toggle('is-hidden', Object.keys(run.taken).length === 0);
    // Questlog
    const tut = run.tutorial;
    const qv = tut && !tut.finished ? tut.version : -2;
    if (qv !== this.questVersion) {
      this.questVersion = qv;
      const step = tut?.current;
      q.quest.classList.toggle('is-hidden', !step);
      if (tut && step) {
        q.quest.innerHTML = `<div class="quest-head">${icon('flag', 14)}<span>Aufgabe ${tut.index + 1}/${tut.steps.length}</span></div><b>${esc(step.title)}</b><p>${step.text}</p>`;
        q.quest.classList.remove('pop');
        void q.quest.offsetWidth;
        q.quest.classList.add('pop');
      }
    }
  }

  renderUpgrades(run: Run): void {
    const taken = Object.entries(run.taken);
    const counts = tagCounts(run.taken);
    const syns = activeSynergies(run.taken);
    const near = SYNERGIES.filter((s) => !syns.includes(s) && (counts[s.tag] ?? 0) > 0);
    this.q.upgrades.innerHTML = `
      <h4>${icon('sparkle', 14)} Upgrades</h4>
      ${taken.length === 0 ? '<small class="muted">Nach Welle 1 wählst du dein erstes Upgrade.</small>' : ''}
      <div class="up-icons">${taken.map(([id, n]) => {
        const u = UPGRADE_BY_ID[id];
        return `<span class="up-ico" style="--rar:${RARITY_INFO[u.rarity].color}" data-tip="<b>${esc(u.name)}</b>${n > 1 ? ` ×${n}` : ''}<br>${esc(u.desc)}">${icon(u.icon, 16)}${n > 1 ? `<em>${n}</em>` : ''}</span>`;
      }).join('')}</div>
      ${syns.map((s) => `<div class="syn on" data-tip="${esc(s.desc)}">${icon('check', 12)} ${esc(s.name)}</div>`).join('')}
      ${near.map((s) => `<div class="syn" data-tip="${esc(s.desc)}">${esc(s.name)} <b>${counts[s.tag]}/${s.need}</b> ${esc(TAG_LABEL[s.tag])}</div>`).join('')}`;
  }

  /* ── Minimap ─────────────────────────────────────────────── */
  private drawMinimap(run: Run): void {
    const cv = this.minimap;
    if (!cv || !this.ui.app.save.data.settings.showMinimap) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const W = cv.width;
    const c = W / 2;
    const scale = (W / 2 - 6) / 44;
    const yaw = run.camera.yaw;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const tx = (x: number, z: number): [number, number] => {
      const f = x * sy + z * cy;
      const r = -x * cy + z * sy;
      return [c + r * scale, c - f * scale];
    };
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath();
    g.arc(c, c, c - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(8, 14, 28, 0.85)';
    g.fillRect(0, 0, W, W);
    // Kartenfläche
    g.fillStyle = 'rgba(56, 78, 110, 0.35)';
    g.beginPath();
    [[-38, -39], [38, -39], [38, 39], [-38, 39]].forEach(([x, z], i) => {
      const [px, py] = tx(x, z);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fill();
    // Routen
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const path of run.level.paths) {
      g.strokeStyle = 'rgba(167, 139, 250, 0.55)';
      g.lineWidth = 5;
      g.beginPath();
      path.forEach((pt, i) => {
        const [px, py] = tx(pt.x, pt.z);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
      const [sx, syy] = tx(path[0].x, path[0].z);
      g.fillStyle = '#c084fc';
      g.beginPath();
      g.arc(sx, syy, 4, 0, Math.PI * 2);
      g.fill();
    }
    // Bauplätze & Türme
    run.level.pads.forEach((pad, i) => {
      const [px, py] = tx(pad.x, pad.z);
      const t = run.towers.towers[i];
      g.fillStyle = t ? TOWERS[t.def.id].color : 'rgba(45, 212, 191, 0.45)';
      g.fillRect(px - 3, py - 3, 6, 6);
    });
    // Kristall
    const [kx, ky] = tx(run.level.crystal.x, run.level.crystal.z);
    g.fillStyle = '#22e6ff';
    g.beginPath();
    g.moveTo(kx, ky - 7);
    g.lineTo(kx + 5, ky);
    g.lineTo(kx, ky + 7);
    g.lineTo(kx - 5, ky);
    g.closePath();
    g.fill();
    // Gegner
    for (const e of run.enemies.list) {
      if (!e.alive) continue;
      const [px, py] = tx(e.x, e.z);
      g.fillStyle = e.def.boss ? '#f43f5e' : e.def.elite || e.affix ? '#f59e0b' : '#ef4444';
      g.beginPath();
      g.arc(px, py, e.def.boss ? 5 : e.def.elite ? 3 : 2.2, 0, Math.PI * 2);
      g.fill();
    }
    // Held
    const p = run.player;
    if (p.pet) {
      const [px, py] = tx(p.pet.x, p.pet.z);
      g.fillStyle = '#86efac';
      g.beginPath();
      g.arc(px, py, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    if (p.alive) {
      const [px, py] = tx(p.x, p.z);
      const a = p.facing - yaw;
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#0ea5e9';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 5);
      g.lineTo(0, 2.5);
      g.lineTo(-5, 5);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    g.restore();
    g.strokeStyle = 'rgba(148, 197, 255, 0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c, c, c - 2, 0, Math.PI * 2);
    g.stroke();
  }

  /* ── Turmmenü ────────────────────────────────────────────── */
  openTowerPanel(pad: number): void {
    if (pad !== this.panelPad) this.sellConfirmUntil = 0;
    this.panelPad = pad;
    this.panelKey = '';
    this.root.classList.add('panel-open');
    this.towerPanel.classList.remove('is-hidden');
    this.refreshTowerPanel(true);
  }

  closeTowerPanel(): void {
    this.panelPad = -1;
    this.root.classList.remove('panel-open');
    this.towerPanel.classList.add('is-hidden');
  }

  private refreshTowerPanel(force: boolean): void {
    const run = this.run;
    if (!run || this.panelPad < 0) return;
    const t = run.towers.towers[this.panelPad];
    const key = `${this.panelPad}|${t?.def.id ?? '-'}|${t?.level ?? 0}|${Math.floor(run.gold / 5)}|${run.waves.index}|${performance.now() < this.sellConfirmUntil}`;
    if (!force && key === this.panelKey) return;
    this.panelKey = key;
    const statLine = (lv: (typeof TOWERS)['arrow']['levels'][number]) =>
      `${fmt(lv.damage)} Schaden · ${lv.rate.toFixed(1).replace('.', ',')}/s · ${lv.range} m${lv.splash ? ` · Fläche ${lv.splash} m` : ''}${lv.slow ? ` · −${Math.round(lv.slow * 100)} % Tempo` : ''}${lv.multishot ? ` · ${lv.multishot} Ziele` : ''}${lv.freezeChance ? ` · ${Math.round(lv.freezeChance * 100)} % Gefrieren` : ''}${lv.burn ? ' · Brand' : ''}`;
    let body = '';
    if (!t) {
      body = `<h3>${icon('hammer', 18)} Bauplatz ${this.panelPad + 1}</h3><p class="muted small">Wähle eine Verteidigung. Kämpfen kannst du dabei weiter.</p>
        ${TOWER_ORDER.map((id: TowerId) => {
          const def = TOWERS[id];
          const cost = run.towers.cost(id);
          const available = run.towerAvailable(id);
          const ok = run.gold >= cost && available;
          const lockTxt = available ? '' : `<em class="to-lock">${icon('lock', 12)} ab Welle ${run.towerUnlockWave(id) + 1}</em>`;
          return `<button class="tower-opt ${ok ? '' : 'is-disabled'} ${available ? '' : 'is-locked'}" data-action="buildTower" data-id="${id}" style="--accent:${def.color}">
            <span class="to-ico">${icon(available ? def.icon : 'lock', 22)}</span>
            <span class="to-txt"><b>${esc(def.name)}</b><small>${esc(def.desc)}</small>${available ? `<em>${statLine(def.levels[0])}</em>` : lockTxt}</span>
            <span class="to-cost">${icon('coin', 14)}${cost}</span>
          </button>`;
        }).join('')}`;
    } else {
      const up = run.towers.upgradeCost(t);
      const confirming = performance.now() < this.sellConfirmUntil;
      const next = t.level < 3 ? t.def.levels[t.level] : null;
      body = `<h3 style="color:${t.def.color}">${icon(t.def.icon, 18)} ${esc(t.def.name)} <span class="lvl">Stufe ${t.level}/3</span></h3>
        <p class="small">${statLine(t.stats)}</p>
        ${next ? `<div class="next-lvl"><small class="muted">Nächste Stufe</small><p class="small">${statLine(next)}</p></div>` : '<p class="muted small">Maximale Stufe erreicht.</p>'}
        <div class="tp-actions">
          ${up !== null ? `<button class="btn btn-sm btn-primary ${run.gold >= up ? '' : 'is-disabled'}" data-action="upgradeTower">${icon('arrowUp', 14)}<span>Aufwerten</span><b>${icon('coin', 12)}${up}</b></button>` : ''}
          <button class="btn btn-sm btn-danger ${confirming ? 'is-confirm' : ''}" data-action="sellTower">${icon('coin', 14)}<span>${confirming ? `Wirklich verkaufen? (+${run.towers.sellValue(t)})` : `Verkaufen +${run.towers.sellValue(t)}`}</span></button>
        </div>`;
    }
    this.towerPanel.innerHTML = `<button class="tp-close" data-action="closePanel" data-tip="Schließen (Esc)">${icon('x', 16)}</button>${body}`;
  }

  /* ── Upgrade-Auswahl ─────────────────────────────────────── */
  showUpgradeChoice(): void {
    const run = this.run;
    if (!run) return;
    this.choiceVisible = true;
    const counts = tagCounts(run.taken);
    const card = (u: UpgradeDef, i: number) => {
      const r = RARITY_INFO[u.rarity];
      const stacks = run.taken[u.id] ?? 0;
      const syn = u.tags
        .map((tag) => {
          const s = SYNERGIES.find((x) => x.tag === tag);
          return `<span class="tag">${esc(TAG_LABEL[tag])}${s ? ` <b>${Math.min(s.need, (counts[tag] ?? 0) + 1)}/${s.need}</b>` : ''}</span>`;
        })
        .join('');
      return `<button class="up-card rar-${u.rarity}" style="--rar:${r.color}" data-action="choose" data-id="${u.id}">
        <span class="up-rar">${esc(r.name)}${stacks ? ` · Stufe ${stacks + 1}` : ''}</span>
        <span class="up-big">${icon(u.icon, 40)}</span>
        <b>${esc(u.name)}</b>
        <p>${esc(u.desc)}</p>
        <span class="tags">${syn}</span>
        <kbd>${i + 1}</kbd>
      </button>`;
    };
    this.overlay.innerHTML = `<div class="choice">
      <h2>${icon('sparkle', 22)} Wähle eine Verstärkung</h2>
      <p class="muted">Gleiche Tags schalten Synergien frei. Relikte sind mächtig – mit Nebenwirkung.</p>
      <div class="up-cards">${run.pendingOffer.map(card).join('')}</div>
      <button class="btn btn-sm" data-action="reroll" ${run.rerolls > 0 ? '' : 'disabled'}>${icon('refresh', 16)}<span>Neu würfeln (${run.rerolls})</span></button>
    </div>`;
    this.overlay.classList.remove('is-hidden');
    this.ui.app.audio.play('levelup', 0.6);
  }

  /* ── Pause ───────────────────────────────────────────────── */
  showPause(): void {
    const run = this.run;
    if (!run) return;
    this.pauseVisible = true;
    const syns = activeSynergies(run.taken);
    const s = run.stats;
    this.overlay.innerHTML = `<div class="pause glass">
      <h2>${icon('pause', 22)} Pause</h2>
      <div class="pause-grid">
        <nav class="pause-nav">
          <button class="btn btn-primary" data-action="resume">${icon('play', 18)}<span>Fortsetzen</span></button>
          <button class="btn" data-action="restart">${icon('refresh', 18)}<span>Neustart</span></button>
          <button class="btn" data-action="pauseSettings">${icon('gear', 18)}<span>Einstellungen</span></button>
          <button class="btn btn-danger" data-action="quit">${icon('home', 18)}<span>Aufgeben</span></button>
        </nav>
        <div class="pause-info">
          <h4>${esc(run.level.name)} · Welle ${Math.min(run.waves.index + 1, run.waves.total)}/${run.waves.total}</h4>
          <p class="small muted">Ereignis: ${esc(run.event.name)} – ${esc(run.event.desc)}</p>
          <div class="mini-stats">
            <span>Leben <b>${fmt(s.maxHp)}</b></span><span>Kraft <b>${s.power.toFixed(1)}</b></span><span>Krit <b>${Math.round(s.crit * 100)} %</b></span>
            <span>Tempo <b>${Math.round(s.attackSpeed * 100)} %</b></span><span>Schutz <b>${Math.round(s.armor * 100)} %</b></span><span>CDR <b>${Math.round(s.cdr * 100)} %</b></span>
            <span>Turmschaden <b>${Math.round(s.towerDmg * 100)} %</b></span><span>Gold <b>${Math.round(s.gold * 100)} %</b></span><span>Türme <b>${run.towers.count}</b></span>
          </div>
          <h4>Upgrades</h4>
          <div class="pause-ups">${Object.entries(run.taken).map(([id, n]) => `<span class="tag">${esc(UPGRADE_BY_ID[id].name)}${n > 1 ? ` ×${n}` : ''}</span>`).join('') || '<small class="muted">Noch keine.</small>'}</div>
          ${syns.length ? `<h4>Synergien</h4><div class="pause-ups">${syns.map((x) => `<span class="tag on">${esc(x.name)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
    this.overlay.classList.remove('is-hidden');
  }

  hideOverlay(): void {
    this.choiceVisible = false;
    this.pauseVisible = false;
    this.overlay.classList.add('is-hidden');
    this.overlay.innerHTML = '';
  }

  private onKey(e: KeyboardEvent): void {
    const app = this.ui.app;
    if (app.input.captureNext) return;
    if (this.choiceVisible && this.run) {
      const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (idx >= 0 && this.run.pendingOffer[idx]) {
        e.preventDefault();
        this.choose(this.run.pendingOffer[idx].id);
      }
      return;
    }
    if (this.pauseVisible && e.code === app.save.data.keys.pause) {
      e.preventDefault();
      app.resume();
    }
  }

  private choose(id: string): void {
    const run = this.run;
    if (!run) return;
    run.chooseUpgrade(id);
    this.hideOverlay();
    this.renderUpgrades(run);
  }

  private handle(action: string, t: HTMLElement): void {
    const app = this.ui.app;
    const run = this.run;
    app.audio.unlock();
    switch (action) {
      case 'callWave':
        run?.waves.callEarly();
        break;
      case 'toggleBuild':
        run?.toggleBuildMode();
        break;
      case 'buildTower': {
        const id = t.dataset.id as TowerId;
        if (run && !run.towerAvailable(id)) {
          run.notify(`${TOWERS[id].name} wird ab Welle ${run.towerUnlockWave(id) + 1} verfügbar`, 'info');
          break;
        }
        if (run && run.towers.build(this.panelPad, id)) this.refreshTowerPanel(true);
        break;
      }
      case 'upgradeTower':
        if (run && run.towers.upgrade(this.panelPad)) this.refreshTowerPanel(true);
        break;
      case 'sellTower':
        if (!run) break;
        // Zweistufig: erst bestätigen, dann verkaufen – nie aus Versehen
        if (performance.now() < this.sellConfirmUntil) {
          this.sellConfirmUntil = 0;
          run.towers.sell(this.panelPad);
        } else {
          this.sellConfirmUntil = performance.now() + 3000;
          app.audio.play('click');
        }
        this.refreshTowerPanel(true);
        break;
      case 'toggleAttack':
        if (run) {
          if (!run.target) run.setTarget(run.player.softTarget(), true);
          else run.player.autoAttack = !run.player.autoAttack;
        }
        break;
      case 'closePanel':
        run?.closeBuild();
        break;
      case 'choose':
        this.choose(t.dataset.id!);
        break;
      case 'reroll':
        if (run?.reroll()) this.showUpgradeChoice();
        break;
      case 'resume':
        app.audio.play('click');
        app.resume();
        break;
      case 'restart':
        app.audio.play('click');
        app.restartRun();
        break;
      case 'pauseSettings':
        app.audio.play('click');
        this.hideOverlay();
        this.pauseVisible = true;
        this.ui.screens.show('settings', { from: 'pause' });
        break;
      case 'quit':
        app.audio.play('click');
        app.abandonRun();
        break;
    }
  }
}
