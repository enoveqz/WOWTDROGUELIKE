import * as THREE from 'three';

const bgMat = new THREE.SpriteMaterial({ color: 0x0b1020, transparent: true, opacity: 0.75, depthTest: false });
const fgMats = new Map<number, THREE.SpriteMaterial>();
function fgMat(color: number): THREE.SpriteMaterial {
  let m = fgMats.get(color);
  if (!m) {
    m = new THREE.SpriteMaterial({ color, depthTest: false });
    fgMats.set(color, m);
  }
  return m;
}

/** Kamerazugewandter Lebensbalken aus zwei Sprites (geteilte Materialien). */
export class HealthBar {
  readonly group = new THREE.Group();
  private fg: THREE.Sprite;
  private width: number;
  private last = -1;

  constructor(width: number, color: number, height = 0.14) {
    this.width = width;
    const bg = new THREE.Sprite(bgMat);
    bg.scale.set(width + 0.08, height + 0.08, 1);
    bg.renderOrder = 998;
    this.fg = new THREE.Sprite(fgMat(color));
    this.fg.center.set(0, 0.5);
    this.fg.position.x = -width / 2;
    this.fg.scale.set(width, height, 1);
    this.fg.renderOrder = 999;
    this.group.add(bg, this.fg);
  }

  set(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    if (Math.abs(r - this.last) < 0.002) return;
    this.last = r;
    this.fg.scale.x = Math.max(0.0001, this.width * r);
  }

  setColor(color: number): void {
    this.fg.material = fgMat(color);
  }
}
