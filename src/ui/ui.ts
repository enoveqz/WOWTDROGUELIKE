import type * as THREE from 'three';
import type { App } from '../app.ts';
import type { FloatKind, NoticeKind, RunHooks } from '../game/run.ts';
import type { RunResult } from '../meta/progression.ts';
import { el, esc } from './dom.ts';
import { FloatText } from './floatText.ts';
import { Hud } from './hud.ts';
import { icon } from './icons.ts';
import { Screens } from './screens.ts';

/**
 * UI-Wurzel: Bildschirme, HUD, Tooltips, Benachrichtigungen und schwebende
 * Zahlen. Implementiert die RunHooks, über die das Spiel mit der UI spricht.
 */
export class UI implements RunHooks {
  readonly app: App;
  readonly root: HTMLElement;
  readonly screens: Screens;
  readonly hud: Hud;
  private floats: FloatText;
  private toasts: HTMLElement;
  private banner: HTMLElement;
  private tooltip: HTMLElement;
  private bannerT = 0;

  constructor(app: App, root: HTMLElement) {
    this.app = app;
    this.root = root;
    const floatLayer = el('div', 'layer layer-float');
    const hudLayer = el('div', 'layer layer-hud');
    const screenLayer = el('div', 'layer layer-screen is-hidden');
    this.toasts = el('div', 'toasts');
    this.banner = el('div', 'banner');
    this.tooltip = el('div', 'tooltip');
    root.append(floatLayer, hudLayer, screenLayer, this.toasts, this.banner, this.tooltip);
    this.floats = new FloatText(floatLayer);
    this.hud = new Hud(this, hudLayer);
    this.screens = new Screens(this, screenLayer);
    this.bindTooltips();
  }

  private bindTooltips(): void {
    let current: HTMLElement | null = null;
    document.addEventListener('mouseover', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (t === current) return;
      current = t;
      if (!t) {
        this.tooltip.classList.remove('show');
        return;
      }
      this.tooltip.innerHTML = t.dataset.tip ?? '';
      this.tooltip.classList.add('show');
      this.positionTooltip(t);
    });
    document.addEventListener('mouseout', (e) => {
      if (!(e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]')) {
        current = null;
        this.tooltip.classList.remove('show');
      }
    });
  }

  private positionTooltip(t: HTMLElement): void {
    const r = t.getBoundingClientRect();
    const tt = this.tooltip;
    const tw = tt.offsetWidth;
    const th = tt.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - 10;
    if (y < 8) y = r.bottom + 10;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    tt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /* ── RunHooks ────────────────────────────────────────────── */
  floatText(pos: THREE.Vector3, text: string, kind: FloatKind): void {
    this.floats.spawn(pos, text, kind);
  }

  notify(text: string, kind: NoticeKind = 'info', big = false): void {
    if (big) {
      this.banner.innerHTML = `<div class="banner-inner banner-${kind}">${esc(text)}</div>`;
      this.banner.classList.remove('show');
      void this.banner.offsetWidth;
      this.banner.classList.add('show');
      this.bannerT = 2.6;
      return;
    }
    const ic = kind === 'good' ? 'check' : kind === 'danger' ? 'skull' : kind === 'warn' ? 'flag' : 'info';
    const t = el('div', `toast toast-${kind}`, `${icon(ic, 14)}<span>${esc(text)}</span>`);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  openTowerPanel(pad: number): void {
    this.hud.openTowerPanel(pad);
  }

  closeTowerPanel(): void {
    this.hud.closeTowerPanel();
  }

  showUpgradeChoice(): void {
    this.hud.showUpgradeChoice();
  }

  onRunEnd(result: RunResult, victory: boolean): void {
    this.app.finishRun(result, victory);
  }

  requestPause(): void {
    this.app.pause();
  }

  /* ── Frame-Update ────────────────────────────────────────── */
  update(dt: number, camera: THREE.Camera | null): void {
    const run = this.app.run;
    if (run && camera) {
      this.hud.update(run, dt);
      this.floats.update(dt, camera, window.innerWidth, window.innerHeight);
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.banner.classList.remove('show');
    }
  }

  clearFloats(): void {
    this.floats.clear();
  }
}
