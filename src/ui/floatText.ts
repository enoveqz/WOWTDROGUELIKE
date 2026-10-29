import * as THREE from 'three';
import type { FloatKind } from '../game/run.ts';

interface Item {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  t: number;
  dur: number;
  active: boolean;
  dx: number;
}

/** Schwebende Schadens-/Gold-/Heilzahlen als DOM-Pool (max. 70 gleichzeitig). */
export class FloatText {
  private items: Item[] = [];
  private tmp = new THREE.Vector3();

  constructor(layer: HTMLElement) {
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div');
      el.className = 'ft';
      el.style.display = 'none';
      layer.appendChild(el);
      this.items.push({ el, pos: new THREE.Vector3(), t: 0, dur: 1, active: false, dx: 0 });
    }
  }

  spawn(pos: THREE.Vector3, text: string, kind: FloatKind): void {
    let it = this.items.find((i) => !i.active);
    if (!it) {
      it = this.items.reduce((a, b) => (a.t > b.t ? a : b));
    }
    it.active = true;
    it.t = 0;
    it.dur = kind === 'crit' ? 1.1 : kind === 'info' ? 1.3 : 0.85;
    it.pos.copy(pos);
    it.dx = (Math.random() - 0.5) * 30;
    it.el.className = `ft ft-${kind}`;
    it.el.textContent = text;
    it.el.style.display = 'block';
  }

  update(dt: number, camera: THREE.Camera, w: number, h: number): void {
    for (const it of this.items) {
      if (!it.active) continue;
      it.t += dt;
      if (it.t >= it.dur) {
        it.active = false;
        it.el.style.display = 'none';
        continue;
      }
      this.tmp.copy(it.pos).project(camera);
      if (this.tmp.z > 1) {
        it.el.style.display = 'none';
        continue;
      }
      const f = it.t / it.dur;
      const x = (this.tmp.x * 0.5 + 0.5) * w + it.dx * f;
      const y = (-this.tmp.y * 0.5 + 0.5) * h - f * 46;
      const scale = it.el.classList.contains('ft-crit') ? 1 + Math.max(0, 0.4 - f) * 1.2 : 1;
      it.el.style.display = 'block';
      it.el.style.opacity = String(f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3);
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
    }
  }

  clear(): void {
    for (const it of this.items) {
      it.active = false;
      it.el.style.display = 'none';
    }
  }
}
