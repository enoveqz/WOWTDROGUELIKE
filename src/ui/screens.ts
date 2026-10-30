import { BIOMES } from '../config/biomes.ts';
import { CLASSES, CLASS_ORDER, type ClassId } from '../config/classes.ts';
import { ENEMIES } from '../config/enemies.ts';
import { ACTION_LABELS, ACTION_ORDER, DEFAULT_KEYS, keyLabel, type Action } from '../config/keybinds.ts';
import { LEVELS } from '../config/levels.ts';
import { MOUNTS, MOUNT_ORDER, mountLevelBonus, mountLevelFromXp, MOUNT_MAX_LEVEL, type MountId } from '../config/mounts.ts';
import { RACES, RACE_ORDER, type RaceId } from '../config/races.ts';
import { computeStats } from '../config/stats.ts';
import { canRankUp, accountLevelFromXp, RACIAL_UNLOCK_LEVEL, SKILL_UNLOCK_LEVEL, META_BOONS, TALENTS, TREE_INFO, treePointsSpent, talentMods, type TalentTree } from '../config/talents.ts';
import { TOWERS, TOWER_ORDER } from '../config/towers.ts';
import { buyBoon, buyUnlock, isLevelUnlocked, isUnlocked, levelLocked, unlockCost, unlockLevel, rankUpTalent, resetTalents, talentPoints, type RewardSummary, type UnlockKind } from '../meta/progression.ts';
import type { Quality } from '../meta/save.ts';
import { esc, fmt, onAction, pctFmt } from './dom.ts';
import { icon } from './icons.ts';
import type { UI } from './ui.ts';

export type ScreenName = 'menu' | 'hero' | 'levels' | 'talents' | 'forge' | 'settings' | 'controls' | 'results' | 'none';

const difficultyLabel = ['', 'Leicht', 'Mittel', 'Schwer', 'Episch'];

/** Menübildschirme außerhalb des Kampfes. */
export class Screens {
  private ui: UI;
  private layer: HTMLElement;
  current: ScreenName = 'none';
  private settingsReturn: ScreenName | 'pause' = 'menu';
  private lastResult: { summary: RewardSummary; victory: boolean; stats: { label: string; value: string }[] } | null = null;

  constructor(ui: UI, layer: HTMLElement) {
    this.ui = ui;
    this.layer = layer;
    onAction(layer, (a, t) => this.handle(a, t));
    layer.addEventListener('mouseenter', (e) => {
      const t = e.target as HTMLElement;
      if (t.matches?.('.btn, .card, .node')) this.ui.app.audio.play('hover', 0.5);
    }, true);
  }

  private get save() {
    return this.ui.app.save;
  }

  show(name: ScreenName, opts: { from?: ScreenName | 'pause' } = {}): void {
    this.current = name;
    if (name === 'settings' && opts.from) this.settingsReturn = opts.from;
    const app = this.ui.app;
    const sel = this.save.data.selection;
    app.showcase.focus = name === 'hero' ? 'hero' : 'menu';
    app.showcase.offsetX = name === 'hero' ? 0 : name === 'menu' ? -3.2 : 0;
    app.showcase.setSelection(sel.race, sel.cls, sel.mount, true);
    this.layer.classList.toggle('is-hidden', name === 'none');
    switch (name) {
      case 'menu':
        this.layer.innerHTML = this.menuHtml();
        break;
      case 'hero':
        this.layer.innerHTML = this.heroHtml();
        break;
      case 'levels':
        this.layer.innerHTML = this.levelsHtml();
        break;
      case 'talents':
        this.layer.innerHTML = this.talentsHtml();
        requestAnimationFrame(() => this.drawTalentLinks());
        break;
      case 'forge':
        this.layer.innerHTML = this.forgeHtml();
        break;
      case 'settings':
        this.layer.innerHTML = this.settingsHtml();
        this.bindSettingsInputs();
        break;
      case 'controls':
        this.layer.innerHTML = this.controlsHtml();
        break;
      case 'results':
        this.layer.innerHTML = this.resultsHtml();
        break;
      default:
        this.layer.innerHTML = '';
    }
    const first = this.layer.querySelector<HTMLElement>('.screen');
    first?.classList.add('enter');
  }

  showResults(summary: RewardSummary, victory: boolean, stats: { label: string; value: string }[]): void {
    this.lastResult = { summary, victory, stats };
    this.show('results');
  }

  private refresh(): void {
    const scroll = this.layer.querySelector('.scroll')?.scrollTop ?? 0;
    this.show(this.current);
    const s = this.layer.querySelector('.scroll');
    if (s) s.scrollTop = scroll;
    this.layer.querySelector('.screen')?.classList.remove('enter');
  }

  private header(title: string, sub: string, back: ScreenName | 'pause' = 'menu'): string {
    const d = this.save.data;
    return `<header class="scr-head">
      <button class="btn btn-ghost btn-sm" data-action="nav" data-to="${back}">${icon('home', 16)}<span>Zurück</span></button>
      <div class="scr-title"><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
      <div class="currency" data-tip="Aethersplitter – dauerhafte Meta-Währung">${icon('gem', 18)}<b>${fmt(d.shards)}</b></div>
    </header>`;
  }

  /* ── Hauptmenü ───────────────────────────────────────────── */
  private menuHtml(): string {
    const d = this.save.data;
    const acc = accountLevelFromXp(d.accountXp);
    const tp = talentPoints(d);
    const sel = d.selection;
    const cleared = LEVELS.filter((l) => d.levels[l.id]?.cleared).length;
    return `<div class="screen screen-menu">
      <div class="menu-col">
        <div class="logo">
          <div class="logo-gem"></div>
          <h1>KINGSHOT</h1>
          <p>Riders of Aether</p>
        </div>
        <nav class="menu-nav">
          <button class="btn btn-primary btn-lg" data-action="nav" data-to="hero">${icon('play', 20)}<span>Spielen</span></button>
          <button class="btn" data-action="nav" data-to="talents">${icon('star', 18)}<span>Talente</span>${tp.free > 0 ? `<em class="badge">${tp.free}</em>` : ''}</button>
          <button class="btn" data-action="nav" data-to="forge">${icon('hammer', 18)}<span>Aetherschmiede</span></button>
          <button class="btn" data-action="nav" data-to="settings">${icon('gear', 18)}<span>Einstellungen</span></button>
          <button class="btn" data-action="nav" data-to="controls">${icon('keyboard', 18)}<span>Steuerung & Hilfe</span></button>
        </nav>
        ${this.save.persistent ? '' : `<p class="warn-note">${icon('info', 14)} Speichern nicht möglich (Browser blockiert localStorage). Fortschritt geht beim Schließen verloren.</p>`}
      </div>
      <aside class="menu-side glass">
        <div class="side-row"><span class="muted">Kontostufe</span><b>${acc.level}</b></div>
        <div class="bar bar-xp"><i style="width:${(acc.into / acc.need) * 100}%"></i></div>
        <div class="side-grid">
          <div>${icon('gem', 16)}<b>${fmt(d.shards)}</b><small>Aethersplitter</small></div>
          <div>${icon('star', 16)}<b>${Math.max(0, tp.free)}</b><small>Talentpunkte</small></div>
          <div>${icon('trophy', 16)}<b>${d.stats.victories}</b><small>Siege</small></div>
          <div>${icon('map', 16)}<b>${cleared}/${LEVELS.length}</b><small>Gebiete</small></div>
        </div>
        <div class="side-hero">
          <span class="muted">Zuletzt gewählt</span>
          <b>${esc(RACES[sel.race].name.split(' ')[0])} · ${esc(CLASSES[sel.cls].name)}</b>
          <small>${icon(MOUNTS[sel.mount].icon, 14)} ${esc(MOUNTS[sel.mount].name)}</small>
        </div>
      </aside>
      <footer class="menu-foot">Ein eigenständiges Fan-Projekt · Low-Poly · Three.js · Version 0.1</footer>
    </div>`;
  }

  /* ── Heldenwahl ──────────────────────────────────────────── */
  private heroHtml(): string {
    const d = this.save.data;
    const sel = d.selection;
    const race = RACES[sel.race];
    const cls = CLASSES[sel.cls];
    const mount = MOUNTS[sel.mount];
    const stats = computeStats(cls.base, [...race.mods, ...talentMods(d.talents)]);
    const mlv = mountLevelFromXp(d.mountXp[sel.mount] ?? 0);
    const accLv = accountLevelFromXp(d.accountXp).level;
    const card = (kind: UnlockKind, id: string, name: string, sub: string, ico: string, color: string, selected: boolean) => {
      const unlocked = isUnlocked(d, kind, id);
      const cost = unlockCost(kind, id);
      const lvLock = !unlocked && levelLocked(d, kind, id);
      const action = unlocked ? 'pick' : lvLock ? 'noop' : 'unlock';
      const subTxt = unlocked ? esc(sub) : lvLock ? `${icon('star', 12)} ab Kontostufe ${unlockLevel(kind, id)}` : `${icon('gem', 12)} ${cost} freischalten`;
      return `<button class="card pick ${selected ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}" style="--accent:${color}" data-action="${action}" data-kind="${kind}" data-id="${id}">
        <span class="pick-ico">${icon(unlocked ? ico : 'lock', 22)}</span>
        <span class="pick-txt"><b>${esc(name)}</b><small>${subTxt}</small></span>
      </button>`;
    };
    const statRow = (label: string, v: string) => `<div class="stat"><span>${label}</span><b>${v}</b></div>`;
    return `<div class="screen screen-hero">
      ${this.header('Heldenwahl', 'Rasse, Klasse und Reittier frei kombinieren', 'menu')}
      <div class="hero-grid">
        <section class="glass panel hero-picks scroll">
          <h3>${icon('users', 16)} Rasse</h3>
          <div class="pick-list">${RACE_ORDER.map((id) => card('race', id, RACES[id].name, RACES[id].passiveName, RACES[id].activeIcon, RACES[id].color, id === sel.race)).join('')}</div>
          <h3>${icon('sword', 16)} Klasse</h3>
          <div class="pick-list">${CLASS_ORDER.map((id) => card('class', id, CLASSES[id].name, CLASSES[id].role, CLASSES[id].icon, CLASSES[id].color, id === sel.cls)).join('')}</div>
          <h3>${icon('horse', 16)} Reittier</h3>
          <div class="pick-list">${MOUNT_ORDER.map((id) => card('mount', id, MOUNTS[id].name, `Tempo ×${MOUNTS[id].speed.toFixed(2)}`, MOUNTS[id].icon, '#2dd4bf', id === sel.mount)).join('')}</div>
        </section>
        <div class="hero-stage"></div>
        <section class="glass panel hero-detail scroll">
          <div class="detail-head" style="--accent:${cls.color}">
            <h3>${esc(race.name.split(' ')[0])} ${esc(cls.name)}</h3>
            <p>${esc(cls.desc)}</p>
          </div>
          <div class="stats">
            ${statRow('Leben', fmt(stats.maxHp))}
            ${statRow(cls.resource.name, fmt(stats.maxRes))}
            ${statRow('Angriffskraft', stats.power.toFixed(1).replace('.', ','))}
            ${statRow('Angriffstempo', pctFmt(stats.attackSpeed))}
            ${statRow('Kritisch', pctFmt(stats.crit))}
            ${statRow('Schutz', pctFmt(stats.armor))}
            ${statRow('Tempo', stats.moveSpeed.toFixed(1).replace('.', ','))}
            ${statRow('Turmschaden', pctFmt(stats.towerDmg))}
          </div>
          <h4>Fähigkeiten</h4>
          <ul class="ability-list">
            <li><span class="ab-ico" style="--accent:${cls.color}">${icon(cls.icon, 18)}</span><div><b>Automatischer Angriff <kbd>RMB</kbd></b><small>Rechtsklick auf einen Gegner · ${cls.attack.kind === 'melee' ? 'Nahkampfhieb' : 'Fernkampfgeschoss'} · ${pctFmt(cls.attack.damageMul)} Angriffskraft</small></div></li>
            ${cls.skills.map((s, i) => `<li><span class="ab-ico" style="--accent:${cls.color}">${icon(s.icon, 18)}</span><div><b>${esc(s.name)} <kbd>${keyLabel(d.keys[`skill${i + 1}` as Action])}</kbd></b><small>${esc(s.desc)}</small><em>${s.cooldown} s · ${s.cost} ${esc(cls.resource.name)}${accLv < SKILL_UNLOCK_LEVEL[i] ? ` · <span class="lock-note">${icon('lock', 11)} ab Kontostufe ${SKILL_UNLOCK_LEVEL[i]}</span>` : ''}</em></div></li>`).join('')}
          </ul>
          <h4>Rasse: ${esc(race.name)}</h4>
          <ul class="ability-list">
            <li><span class="ab-ico" style="--accent:${race.color}">${icon('shield', 18)}</span><div><b>${esc(race.passiveName)} <kbd>Passiv</kbd></b><small>${esc(race.passiveDesc)}</small></div></li>
            <li><span class="ab-ico" style="--accent:${race.color}">${icon(race.activeIcon, 18)}</span><div><b>${esc(race.activeName)} <kbd>${keyLabel(d.keys.racial)}</kbd></b><small>${esc(race.activeDesc)}</small><em>${race.cooldown} s Abklingzeit${accLv < RACIAL_UNLOCK_LEVEL ? ` · <span class="lock-note">${icon('lock', 11)} ab Kontostufe ${RACIAL_UNLOCK_LEVEL}</span>` : ''}</em></div></li>
          </ul>
          <h4>Reittier: ${esc(mount.name)} <span class="lvl">Stufe ${mlv.level}${mlv.level < MOUNT_MAX_LEVEL ? '' : ' (max)'}</span></h4>
          ${mlv.need ? `<div class="bar bar-mount" data-tip="Reittier-Erfahrung: ${Math.round(mlv.into)}/${mlv.need}"><i style="width:${(mlv.into / mlv.need) * 100}%"></i></div>` : ''}
          <ul class="ability-list">
            <li><span class="ab-ico" style="--accent:#2dd4bf">${icon('wind', 18)}</span><div><b>Aufsitzen <kbd>${keyLabel(d.keys.interact)}</kbd></b><small>${esc(mount.desc)} Tempo ×${(mount.speed * (1 + mountLevelBonus(mlv.level).speed)).toFixed(2)}${mount.mountedArmor ? `, +${Math.round(mount.mountedArmor * 100)} % Schutz im Sattel` : ''}.</small></div></li>
            <li><span class="ab-ico" style="--accent:#2dd4bf">${icon('charge', 18)}</span><div><b>${esc(mount.chargeName)} <kbd>${keyLabel(d.keys.dodge)}</kbd></b><small>${esc(mount.chargeDesc)} Stufenbonus: +${Math.round(mountLevelBonus(mlv.level).power * 100)} % Schaden.</small><em>${mount.chargeCooldown} s Abklingzeit</em></div></li>
          </ul>
        </section>
      </div>
      <footer class="scr-foot">
        <span class="muted">Freigeschaltete Kombinationen sind alle gleichwertig spielbar.</span>
        <button class="btn btn-primary btn-lg" data-action="nav" data-to="levels"><span>Weiter zur Levelwahl</span>${icon('play', 18)}</button>
      </footer>
    </div>`;
  }

  /* ── Levelwahl ───────────────────────────────────────────── */
  private levelsHtml(): string {
    const d = this.save.data;
    const cards = LEVELS.map((l) => {
      const unlocked = isLevelUnlocked(d, l);
      const prog = d.levels[l.id];
      const biome = BIOMES[l.biome];
      const selected = d.selection.level === l.id;
      const boss = ENEMIES[l.boss];
      const req = l.unlockAfter ? LEVELS.find((x) => x.id === l.unlockAfter)?.name : '';
      return `<button class="card level-card ${selected ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}" style="--accent:${biome.accent}" data-action="${unlocked ? 'pickLevel' : 'noop'}" data-id="${l.id}">
        <div class="lv-art lv-${l.biome}"><span class="lv-biome">${esc(biome.name)}</span>${prog?.cleared ? `<span class="lv-done">${icon('check', 14)} Abgeschlossen</span>` : ''}</div>
        <div class="lv-body">
          <h3>${esc(l.name)}</h3>
          <p class="lv-sub">${esc(l.subtitle)}</p>
          <div class="pips" data-tip="Schwierigkeit: ${difficultyLabel[l.difficulty]}">${[1, 2, 3, 4].map((i) => `<i class="${i <= l.difficulty ? 'on' : ''}"></i>`).join('')}<span>${difficultyLabel[l.difficulty]}</span></div>
          ${unlocked ? `<p class="lv-desc">${esc(l.desc)}</p>
          <ul class="lv-facts">
            <li>${icon('flag', 14)} ${l.waves.length} Wellen · ${l.paths.length} ${l.paths.length > 1 ? 'Routen' : 'Route'} · ${l.pads.length} Bauplätze</li>
            <li>${icon('sparkle', 14)} <b>${esc(l.challenge.name)}:</b> ${esc(l.challenge.desc)}</li>
            <li>${icon('skull', 14)} Boss: ${esc(boss.name)}</li>
            <li>${icon('gem', 14)} Belohnung: ${l.rewardShards}+ Splitter${prog?.cleared ? '' : ' · Erstabschluss +50 %'}</li>
            ${prog ? `<li>${icon('trophy', 14)} Beste Welle: ${prog.bestWave}/${l.waves.length} · Siege: ${prog.clears}</li>` : ''}
          </ul>` : `<p class="lv-locked">${icon('lock', 16)} Schließe „${esc(req ?? '')}“ ab, um dieses Gebiet freizuschalten.</p>`}
        </div>
      </button>`;
    }).join('');
    return `<div class="screen screen-levels">
      ${this.header('Levelwahl', 'Wähle das Schlachtfeld für deinen nächsten Run', 'hero')}
      <div class="level-grid scroll">${cards}</div>
      <footer class="scr-foot">
        <span class="muted">${icon('info', 14)} Jeder Run würfelt ein Ereignis, Gegnervarianten und Upgrade-Angebote neu aus.</span>
        <button class="btn btn-primary btn-lg" data-action="start">${icon('play', 18)}<span>Run starten</span></button>
      </footer>
    </div>`;
  }

  /* ── Talente ─────────────────────────────────────────────── */
  private talentsHtml(): string {
    const d = this.save.data;
    const tp = talentPoints(d);
    const acc = accountLevelFromXp(d.accountXp);
    const trees = (['class', 'race', 'mount'] as TalentTree[]).map((tree) => {
      const info = TREE_INFO[tree];
      const nodes = TALENTS.filter((t) => t.tree === tree);
      const spent = treePointsSpent(d.talents, tree);
      return `<section class="glass panel tree" style="--accent:${info.color}" data-tree="${tree}">
        <header><span class="tree-ico">${icon(info.icon, 18)}</span><div><h3>${esc(info.name)}</h3><small>${esc(info.desc)}</small></div><b class="tree-pts">${spent}</b></header>
        <div class="tree-grid">
          <svg class="tree-links"></svg>
          ${nodes.map((t) => {
            const rank = d.talents[t.id] ?? 0;
            const check = canRankUp(d.talents, t.id, tp.free);
            const state = rank >= t.maxRank ? 'is-max' : rank > 0 ? 'is-partial' : check.ok ? 'is-available' : 'is-locked';
            const tip = `<b>${esc(t.name)}</b><br>${esc(t.desc)}<br><span class='tip-dim'>Rang ${rank}/${t.maxRank}${!check.ok && rank < t.maxRank ? ` · ${esc(check.reason ?? '')}` : ''}</span>`;
            return `<button class="node ${state}" style="grid-row:${t.row + 1};grid-column:${t.col + 1}" data-action="talent" data-id="${t.id}" data-req="${t.requires.map((r) => r.id).join(',')}" data-tip="${tip}">
              ${icon(t.icon, 22)}<span class="node-rank">${rank}/${t.maxRank}</span>
            </button>`;
          }).join('')}
        </div>
      </section>`;
    }).join('');
    return `<div class="screen screen-talents">
      ${this.header('Talentbäume', 'Dauerhafte Verbesserungen für alle zukünftigen Runs', 'menu')}
      <div class="talent-top glass">
        <div><span class="muted">Kontostufe ${acc.level}</span><div class="bar bar-xp"><i style="width:${(acc.into / acc.need) * 100}%"></i></div><small class="muted">${fmt(acc.into)}/${fmt(acc.need)} EP bis zum nächsten Talentpunkt</small></div>
        <div class="tp-count"><b>${Math.max(0, tp.free)}</b><span>freie Punkte</span><small>${tp.spent}/${tp.total} vergeben</small></div>
        <button class="btn btn-sm" data-action="resetTalents" ${tp.spent === 0 ? 'disabled' : ''}>${icon('refresh', 16)}<span>Zurücksetzen</span></button>
      </div>
      <div class="tree-row scroll">${trees}</div>
      <footer class="scr-foot"><span class="muted">${icon('info', 14)} Talentpunkte erhältst du durch Kontostufen (Erfahrung aus Runs) und Talentfolianten in der Aetherschmiede. Zurücksetzen ist kostenlos.</span></footer>
    </div>`;
  }

  private drawTalentLinks(): void {
    for (const tree of this.layer.querySelectorAll<HTMLElement>('.tree')) {
      const svg = tree.querySelector('svg.tree-links') as SVGSVGElement | null;
      const grid = tree.querySelector('.tree-grid') as HTMLElement | null;
      if (!svg || !grid) continue;
      const gr = grid.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`);
      let lines = '';
      for (const node of tree.querySelectorAll<HTMLElement>('.node')) {
        const req = node.dataset.req;
        if (!req) continue;
        for (const rid of req.split(',')) {
          const from = tree.querySelector<HTMLElement>(`.node[data-id="${rid}"]`);
          if (!from) continue;
          const a = from.getBoundingClientRect();
          const b = node.getBoundingClientRect();
          const on = !node.classList.contains('is-locked');
          lines += `<line x1="${a.left + a.width / 2 - gr.left}" y1="${a.top + a.height / 2 - gr.top}" x2="${b.left + b.width / 2 - gr.left}" y2="${b.top + b.height / 2 - gr.top}" class="${on ? 'on' : ''}"/>`;
        }
      }
      svg.innerHTML = lines;
    }
  }

  /* ── Aetherschmiede ──────────────────────────────────────── */
  private forgeHtml(): string {
    const d = this.save.data;
    const boons = META_BOONS.map((b) => {
      const rank = d.boons[b.id] ?? 0;
      const max = rank >= b.maxRank;
      const cost = max ? 0 : b.cost(rank);
      return `<div class="forge-item glass">
        <span class="ab-ico" style="--accent:#a78bfa">${icon(b.icon, 20)}</span>
        <div class="fi-txt"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>
          <div class="rank-pips">${Array.from({ length: b.maxRank }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn btn-sm ${max ? '' : 'btn-primary'}" data-action="boon" data-id="${b.id}" ${max || d.shards < cost ? 'disabled' : ''}>${max ? 'Maximal' : `${icon('gem', 14)} ${cost}`}</button>
      </div>`;
    }).join('');
    const unlockRow = (kind: UnlockKind, id: string, name: string, ico: string, cost: number) => {
      const has = isUnlocked(d, kind, id);
      if (!has && levelLocked(d, kind, id)) return `<div class="unlock-row">${icon(ico, 18)}<span>${esc(name)}</span><em class="muted">${icon('star', 14)} ab Kontostufe ${unlockLevel(kind, id)}</em></div>`;
      if (!has && cost === 0) return `<div class="unlock-row">${icon(ico, 18)}<span>${esc(name)}</span><em class="muted">wird automatisch freigeschaltet</em></div>`;
      return `<div class="unlock-row ${has ? 'is-owned' : ''}">${icon(ico, 18)}<span>${esc(name)}</span>${has ? `<em>${icon('check', 14)} freigeschaltet</em>` : `<button class="btn btn-sm btn-primary" data-action="unlock" data-kind="${kind}" data-id="${id}" ${d.shards < cost ? 'disabled' : ''}>${icon('gem', 14)} ${cost}</button>`}</div>`;
    };
    return `<div class="screen screen-forge">
      ${this.header('Aetherschmiede', 'Investiere Aethersplitter in dauerhafte Boni und Freischaltungen', 'menu')}
      <div class="forge-grid scroll">
        <section class="forge-col"><h3>${icon('sparkle', 16)} Dauerhafte Boni</h3>${boons}</section>
        <section class="forge-col glass panel">
          <h3>${icon('lock', 16)} Freischaltungen</h3>
          <h4>Klassen</h4>${CLASS_ORDER.map((id) => unlockRow('class', id, CLASSES[id].name, CLASSES[id].icon, CLASSES[id].unlockCost)).join('')}
          <h4>Rassen</h4>${RACE_ORDER.map((id) => unlockRow('race', id, RACES[id].name, RACES[id].activeIcon, RACES[id].unlockCost)).join('')}
          <h4>Reittiere</h4>${MOUNT_ORDER.map((id) => unlockRow('mount', id, MOUNTS[id].name, MOUNTS[id].icon, MOUNTS[id].unlockCost)).join('')}
          <h4>Verteidigungen</h4>
          ${TOWER_ORDER.map((id) => `<div class="unlock-row is-owned">${icon(TOWERS[id].icon, 18)}<span>${esc(TOWERS[id].name)}</span><em>${icon('check', 14)} verfügbar</em></div>`).join('')}
        </section>
      </div>
    </div>`;
  }

  /* ── Einstellungen ───────────────────────────────────────── */
  private settingsHtml(): string {
    const s = this.save.data.settings;
    const keys = this.save.data.keys;
    const slider = (id: string, label: string, v: number) =>
      `<label class="set-row"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${v}" data-set="${id}"><output>${Math.round(v * 100)} %</output></label>`;
    const toggle = (id: string, label: string, v: boolean) =>
      `<label class="set-row"><span>${label}</span><button class="toggle ${v ? 'on' : ''}" data-action="toggle" data-id="${id}" role="switch" aria-checked="${v}"><i></i></button></label>`;
    const q = (v: Quality, label: string) => `<button class="seg ${s.quality === v ? 'on' : ''}" data-action="quality" data-id="${v}">${label}</button>`;
    return `<div class="screen screen-settings">
      ${this.header('Einstellungen', 'Audio, Grafik, Steuerung und Daten', this.settingsReturn === 'pause' ? 'pause' : 'menu')}
      <div class="settings-grid scroll">
        <section class="glass panel">
          <h3>${icon('volume', 16)} Audio</h3>
          ${slider('master', 'Gesamtlautstärke', s.master)}
          ${slider('sfx', 'Effekte', s.sfx)}
          ${slider('music', 'Musik', s.music)}
          ${toggle('muted', 'Stummschalten', s.muted)}
          <h3>${icon('eye', 16)} Grafik</h3>
          <div class="set-row"><span>Qualität</span><div class="segs">${q('low', 'Niedrig')}${q('medium', 'Mittel')}${q('high', 'Hoch')}</div></div>
          ${toggle('shadows', 'Schatten', s.shadows)}
          ${toggle('particles', 'Partikeleffekte', s.particles)}
          ${toggle('damageNumbers', 'Schadenszahlen', s.damageNumbers)}
          ${toggle('screenShake', 'Kamerawackeln', s.screenShake)}
          ${toggle('showMinimap', 'Minimap anzeigen', s.showMinimap)}
          ${toggle('bloom', 'Leuchteffekte (Bloom)', s.bloom)}
          ${toggle('mouseLock', 'Maus beim Drehen fangen (wie im MMORPG, Cursor stößt nie an den Rand)', s.mouseLock)}
          <label class="set-row"><span>Kamera-Drehempfindlichkeit</span><input type="range" min="0.3" max="2" step="0.1" value="${s.cameraSensitivity}" data-set="cameraSensitivity"><output>${s.cameraSensitivity.toFixed(1)}</output></label>
          <p class="muted small">Qualitätsänderungen (Dichte der Dekoration, Schattenauflösung) wirken ab dem nächsten Run vollständig.</p>
        </section>
        <section class="glass panel">
          <h3>${icon('keyboard', 16)} Tastenbelegung</h3>
          <div class="keymap">
            ${ACTION_ORDER.map((a) => `<div class="key-row"><span>${esc(ACTION_LABELS[a])}</span><button class="kbd-btn" data-action="rebind" data-id="${a}">${esc(keyLabel(keys[a]))}</button></div>`).join('')}
            <div class="key-row"><span>Standardangriff / Bauplatz wählen</span><span class="kbd-fixed">Linke Maustaste</span></div>
            <div class="key-row"><span>Kamera drehen</span><span class="kbd-fixed">Rechte Maustaste ziehen</span></div>
            <div class="key-row"><span>Zoom</span><span class="kbd-fixed">Mausrad</span></div>
          </div>
          <button class="btn btn-sm" data-action="resetKeys">${icon('refresh', 16)}<span>Standardbelegung</span></button>
          <h3>${icon('info', 16)} Daten</h3>
          <p class="muted small">Fortschritt wird lokal im Browser gespeichert (localStorage).</p>
          <button class="btn btn-sm btn-danger" data-action="resetSave">${icon('x', 16)}<span>Fortschritt zurücksetzen</span></button>
        </section>
      </div>
    </div>`;
  }

  private bindSettingsInputs(): void {
    for (const input of this.layer.querySelectorAll<HTMLInputElement>('input[data-set]')) {
      input.addEventListener('input', () => {
        const key = input.dataset.set as 'master' | 'sfx' | 'music' | 'cameraSensitivity';
        const v = parseFloat(input.value);
        this.save.data.settings[key] = v;
        const out = input.nextElementSibling as HTMLOutputElement | null;
        if (out) out.textContent = key === 'cameraSensitivity' ? v.toFixed(1) : `${Math.round(v * 100)} %`;
        this.ui.app.applySettings();
      });
      input.addEventListener('change', () => this.save.save());
    }
  }

  /* ── Steuerung & Hilfe ───────────────────────────────────── */
  private controlsHtml(): string {
    const k = this.save.data.keys;
    const row = (keys: string, what: string) => `<li><span class="kbds">${keys}</span><span>${what}</span></li>`;
    const kb = (a: Action) => `<kbd>${esc(keyLabel(k[a]))}</kbd>`;
    return `<div class="screen screen-controls">
      ${this.header('Steuerung & Hilfe', 'So verteidigst du den Aetherkristall', 'menu')}
      <div class="help-grid scroll">
        <section class="glass panel">
          <h3>${icon('keyboard', 16)} Steuerung</h3>
          <ul class="help-list">
            ${row(`${kb('up')}${kb('down')}`, 'Vorwärts / rückwärts laufen')}
            ${row(`${kb('left')}${kb('right')}`, 'Drehen – mit gehaltener rechter Maustaste: seitwärts laufen')}
            ${row('<kbd>LMB</kbd> ziehen', 'Kamera drehen und neigen (Figur bleibt stehen)')}
            ${row('<kbd>RMB</kbd> ziehen', 'Kamera drehen – die Figur dreht sich mit')}
            ${row('<kbd>LMB</kbd>+<kbd>RMB</kbd>', 'Beide Maustasten: vorwärts laufen')}
            ${row('<kbd>LMB</kbd> Klick', 'Ziel wählen · Bauplatz öffnen')}
            ${row('<kbd>RMB</kbd> Klick', 'Gegner automatisch angreifen · Bauplatz öffnen')}
            ${row(kb('target'), 'Nächstes Ziel wählen')}
            ${row(`${kb('skill1')}${kb('skill2')}${kb('skill3')}${kb('skill4')}`, 'Klassenfähigkeiten (auf dein Ziel)')}
            ${row(kb('racial'), 'Rassenfähigkeit')}
            ${row(kb('dodge'), 'Ausweichrolle – im Sattel: Reittier-Ansturm')}
            ${row(kb('interact'), 'Am Bauplatz: Turmmenü · sonst Auf-/Absitzen')}
            ${row(kb('build'), 'Baumodus: alle Bauplätze und Reichweiten anzeigen')}
            ${row(kb('nextWave'), 'Nächste Welle früher rufen (Bonusgold)')}
            ${row('Mausrad', 'Zoom')}
            ${row(kb('pause'), 'Menü schließen · Ziel abwählen · Pause')}
          </ul>
        </section>
        <section class="glass panel">
          <h3>${icon('crystal', 16)} Spielprinzip</h3>
          <ol class="help-steps">
            <li><b>Verteidige den Aetherkristall.</b> Gegner folgen den markierten Routen. Wird der Kristall zerstört, endet der Run.</li>
            <li><b>Baue Türme</b> auf den leuchtenden Sechseck-Plätzen: Pfeilturm (Einzelziel), Arkanturm (Fläche) und Frostobelisk (Verlangsamung).</li>
            <li><b>Kämpfe selbst:</b> Rechtsklick auf einen Gegner startet den automatischen Angriff, Fähigkeiten treffen dein Ziel. Neue Fähigkeiten erlernst du mit steigender Kontostufe. Fällst du, kehrst du nach 7 s zurück.</li>
            <li><b>Reite</b> zwischen den Fronten: Im Sattel bist du deutlich schneller, der Ansturm trifft ganze Gruppen. Angreifen lässt dich automatisch absitzen.</li>
            <li><b>Wähle Upgrades</b> nach bestimmten Wellen. Gleiche Symbole (Tags) schalten Synergien frei; Relikte sind stark, haben aber einen Haken.</li>
            <li><b>Besiege den Boss</b> der letzten Welle. Achte auf rote Markierungen am Boden – dort schlägt es gleich ein.</li>
            <li><b>Dauerhafter Fortschritt:</b> Auch verlorene Runs bringen Aethersplitter und Erfahrung für Talente, Freischaltungen und Reittierstufen.</li>
          </ol>
        </section>
      </div>
    </div>`;
  }

  /* ── Ergebnis ────────────────────────────────────────────── */
  private resultsHtml(): string {
    const r = this.lastResult;
    if (!r) return '';
    const s = r.summary;
    const d = this.save.data;
    const acc = accountLevelFromXp(d.accountXp);
    const unlocked = s.unlockedLevel ? LEVELS.find((l) => l.id === s.unlockedLevel) : null;
    return `<div class="screen screen-results ${r.victory ? 'is-victory' : 'is-defeat'}">
      <div class="result-card glass">
        <div class="result-icon">${icon(r.victory ? 'trophy' : 'crystal', 40)}</div>
        <h2>${r.victory ? 'Sieg!' : 'Niederlage'}</h2>
        <p class="muted">${r.victory ? 'Der Aetherkristall leuchtet weiter – die Lande sind sicher.' : 'Der Kristall ist zerbrochen. Doch deine Erfahrung bleibt.'}</p>
        <div class="result-stats">${r.stats.map((x) => `<div><small>${esc(x.label)}</small><b>${esc(x.value)}</b></div>`).join('')}</div>
        <div class="reward-box">
          <h4>${icon('gem', 16)} Belohnungen</h4>
          ${s.lines.map((l) => `<div class="reward-line"><span>${esc(l.label)}</span><b>+${fmt(l.value)}</b></div>`).join('')}
          <div class="reward-line total"><span>Aethersplitter gesamt</span><b>+${fmt(s.shards)}</b></div>
          <div class="reward-line"><span>Kontoerfahrung</span><b>+${fmt(s.xp)} EP</b></div>
          <div class="bar bar-xp"><i style="width:${(acc.into / acc.need) * 100}%"></i></div>
          ${s.accountLevelAfter > s.accountLevelBefore ? `<p class="levelup">${icon('star', 16)} Kontostufe ${s.accountLevelAfter}! +${s.accountLevelAfter - s.accountLevelBefore} Talentpunkt${s.accountLevelAfter - s.accountLevelBefore > 1 ? 'e' : ''}</p>` : ''}
          ${s.mountLevelAfter > s.mountLevelBefore ? `<p class="levelup">${icon('horse', 16)} Reittier erreicht Stufe ${s.mountLevelAfter}!</p>` : ''}
          ${unlocked ? `<p class="levelup">${icon('map', 16)} Neues Gebiet freigeschaltet: ${esc(unlocked.name)}</p>` : ''}
          ${s.newSkills.map((x) => `<p class="levelup">${icon('sparkle', 16)} Neu erlernt: ${esc(x)}</p>`).join('')}
          ${s.newUnlocks.map((x) => `<p class="levelup">${icon('lock', 16)} Neu verfügbar – ${esc(x)}</p>`).join('')}
        </div>
        <div class="result-actions">
          <button class="btn btn-primary" data-action="again">${icon('refresh', 18)}<span>Nochmal</span></button>
          <button class="btn" data-action="nav" data-to="talents">${icon('star', 18)}<span>Talente</span></button>
          <button class="btn" data-action="nav" data-to="menu">${icon('home', 18)}<span>Hauptmenü</span></button>
        </div>
      </div>
    </div>`;
  }

  /* ── Aktionen ────────────────────────────────────────────── */
  private handle(action: string, t: HTMLElement): void {
    const app = this.ui.app;
    const d = this.save.data;
    const id = t.dataset.id ?? '';
    app.audio.unlock();
    switch (action) {
      case 'nav': {
        app.audio.play('click');
        const to = t.dataset.to as ScreenName | 'pause';
        if (to === 'pause') {
          this.show('none');
          this.ui.hud.showPause();
        } else this.show(to, { from: this.current });
        break;
      }
      case 'pick': {
        const kind = t.dataset.kind as UnlockKind;
        if (kind === 'race') d.selection.race = id as RaceId;
        if (kind === 'class') d.selection.cls = id as ClassId;
        if (kind === 'mount') d.selection.mount = id as MountId;
        this.save.save();
        app.audio.play('click');
        this.refresh();
        break;
      }
      case 'unlock': {
        const kind = t.dataset.kind as UnlockKind;
        if (buyUnlock(d, kind, id)) {
          app.audio.play('levelup');
          this.ui.notify('Freigeschaltet!', 'good');
          if (this.current === 'hero') {
            if (kind === 'race') d.selection.race = id as RaceId;
            if (kind === 'class') d.selection.cls = id as ClassId;
            if (kind === 'mount') d.selection.mount = id as MountId;
          }
          this.save.save();
        } else {
          app.audio.play('error');
          this.ui.notify('Nicht genug Aethersplitter', 'info');
        }
        this.refresh();
        break;
      }
      case 'pickLevel':
        d.selection.level = id;
        this.save.save();
        app.audio.play('click');
        this.refresh();
        break;
      case 'start':
        app.audio.play('click');
        app.startRun();
        break;
      case 'again':
        app.audio.play('click');
        app.startRun();
        break;
      case 'talent': {
        const res = rankUpTalent(d, id);
        if (res.ok) {
          app.audio.play('upgrade');
          this.save.save();
        } else {
          app.audio.play('error');
          this.ui.notify(res.reason ?? 'Nicht möglich', 'info');
        }
        this.refresh();
        requestAnimationFrame(() => this.drawTalentLinks());
        break;
      }
      case 'resetTalents':
        resetTalents(d);
        this.save.save();
        app.audio.play('sell');
        this.refresh();
        requestAnimationFrame(() => this.drawTalentLinks());
        break;
      case 'boon':
        if (buyBoon(d, id)) {
          app.audio.play('upgrade');
          this.save.save();
        } else app.audio.play('error');
        this.refresh();
        break;
      case 'toggle': {
        const key = id as 'muted' | 'shadows' | 'particles' | 'damageNumbers' | 'screenShake' | 'showMinimap' | 'mouseLock' | 'bloom';
        d.settings[key] = !d.settings[key];
        this.save.save();
        app.applySettings();
        app.audio.play('click');
        this.refresh();
        break;
      }
      case 'quality':
        d.settings.quality = id as Quality;
        this.save.save();
        app.applySettings();
        this.refresh();
        break;
      case 'rebind': {
        t.textContent = 'Taste drücken …';
        t.classList.add('is-listening');
        app.input.captureNext = (code) => {
          if (code !== 'Escape' || id === 'pause') {
            const action = id as Action;
            // Doppelbelegungen tauschen statt verbieten
            const other = (Object.keys(d.keys) as Action[]).find((a) => a !== action && d.keys[a] === code);
            if (other) d.keys[other] = d.keys[action];
            d.keys[action] = code;
            app.input.setKeys(d.keys);
            this.save.save();
          }
          this.refresh();
        };
        break;
      }
      case 'resetKeys':
        d.keys = { ...DEFAULT_KEYS };
        app.input.setKeys(d.keys);
        this.save.save();
        this.refresh();
        break;
      case 'resetSave':
        if (window.confirm('Gesamten Fortschritt (Splitter, Talente, Freischaltungen) wirklich löschen?')) {
          this.save.reset();
          this.ui.notify('Fortschritt zurückgesetzt', 'info');
          this.refresh();
        }
        break;
      default:
        break;
    }
  }
}
