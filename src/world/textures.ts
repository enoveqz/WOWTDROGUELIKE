import * as THREE from 'three';
import type { BiomeId } from '../config/biomes.ts';
import { Rng } from '../core/rng.ts';

/**
 * Handgemalt wirkende, kachelbare Texturen – prozedural auf einem Canvas
 * gemalt (Pinselstriche, Kiesel, Blumen). Liegen echte Texturdateien in
 * public/textures/ und sind in TEXTURE_FILES eingetragen, werden diese
 * stattdessen geladen; die prozedurale Version dient als Fallback.
 */
export type TexKey =
  | `${BiomeId}_ground`
  | `${BiomeId}_path`
  | `${BiomeId}_rock`
  | 'bark'
  | 'leaves'
  | 'pine'
  | 'stone'
  | 'wood';

/** Dateien, die tatsächlich in public/textures/ liegen (z. B. 'forest_ground': 'forest_ground.png'). */
export const TEXTURE_FILES: Partial<Record<TexKey, string>> = {};

interface Spec {
  size: number;
  base: string;
  strokes: { colors: string[]; count: number; len: [number, number]; width: [number, number]; alpha: [number, number]; angle?: number; jitter?: number }[];
  dots?: { colors: string[]; count: number; r: [number, number] }[];
  stones?: { colors: string[]; count: number; r: [number, number]; outline: string };
  cracks?: { color: string; glow: string; count: number };
}

const SPECS: Record<TexKey, Spec> = {
  forest_ground: {
    size: 512, base: '#4f7a34',
    strokes: [
      { colors: ['#3e6a2b', '#5a8a3a', '#6f9e45', '#47732f'], count: 1600, len: [8, 22], width: [2, 5], alpha: [0.35, 0.7], angle: -1.2, jitter: 0.5 },
      { colors: ['#86b552', '#9cc35c'], count: 380, len: [5, 12], width: [1.5, 3], alpha: [0.4, 0.8], angle: -1.2, jitter: 0.6 },
    ],
    dots: [{ colors: ['#f1d36b', '#ffffff', '#e8a0c8', '#b7d7ff'], count: 70, r: [1.5, 3] }],
  },
  forest_path: {
    size: 512, base: '#8b5e3c',
    strokes: [{ colors: ['#7a4f31', '#9b6c45', '#a77b52', '#6e4529'], count: 1300, len: [6, 18], width: [3, 7], alpha: [0.3, 0.6], jitter: 3 }],
    stones: { colors: ['#9a8f84', '#b3a89a', '#8a7f75'], count: 55, r: [4, 10], outline: '#5b4635' },
  },
  forest_rock: {
    size: 512, base: '#7a7f86',
    strokes: [{ colors: ['#6a6f76', '#8d929a', '#9ea3aa', '#5e636a'], count: 1100, len: [14, 40], width: [4, 10], alpha: [0.3, 0.6], angle: 0.3, jitter: 0.3 }],
    dots: [{ colors: ['#6f8f4a', '#86a85a'], count: 60, r: [3, 7] }],
  },
  desert_ground: {
    size: 512, base: '#e3b56f',
    strokes: [{ colors: ['#d9a35c', '#ecc584', '#f1d39b', '#cf9a55'], count: 1400, len: [20, 50], width: [3, 7], alpha: [0.25, 0.5], angle: 0.08, jitter: 0.15 }],
    dots: [{ colors: ['#b98149', '#f6ddb0'], count: 160, r: [0.8, 1.8] }],
  },
  desert_path: {
    size: 512, base: '#b88049',
    strokes: [{ colors: ['#b98149', '#d6a466', '#a87342'], count: 1000, len: [10, 26], width: [3, 7], alpha: [0.3, 0.55], jitter: 3 }],
    stones: { colors: ['#c99a62', '#b8844e', '#d7aa72'], count: 40, r: [6, 12], outline: '#8f5f33' },
  },
  desert_rock: {
    size: 512, base: '#c6834c',
    strokes: [{ colors: ['#b56f3c', '#d6955c', '#a8653a', '#e0a46a'], count: 1100, len: [30, 70], width: [4, 9], alpha: [0.3, 0.55], angle: 0.05, jitter: 0.08 }],
  },
  snow_ground: {
    size: 512, base: '#e9f1fa',
    strokes: [{ colors: ['#ffffff', '#dbe7f5', '#c9daee', '#f4f8ff'], count: 1200, len: [16, 40], width: [5, 12], alpha: [0.3, 0.6], jitter: 3 }],
    dots: [{ colors: ['#ffffff', '#bcd4ef'], count: 120, r: [1, 2.5] }],
  },
  snow_path: {
    size: 512, base: '#7f9bb6',
    strokes: [{ colors: ['#6f8ca8', '#93adc6', '#5f7d9a', '#a7bfd6'], count: 1100, len: [10, 26], width: [3, 7], alpha: [0.35, 0.6], jitter: 3 }],
    stones: { colors: ['#8ea2b6', '#a2b4c6', '#7b90a6'], count: 60, r: [7, 13], outline: '#4d6178' },
  },
  snow_rock: {
    size: 512, base: '#8796a8',
    strokes: [{ colors: ['#76869a', '#99a8b9', '#6a7a8e', '#e6eef7'], count: 1100, len: [16, 40], width: [4, 10], alpha: [0.3, 0.6], angle: 0.4, jitter: 0.4 }],
  },
  volcano_ground: {
    size: 512, base: '#3a302f',
    strokes: [{ colors: ['#2e2626', '#4a3d3a', '#544541', '#262021'], count: 1400, len: [8, 24], width: [3, 7], alpha: [0.35, 0.65], jitter: 3 }],
    dots: [{ colors: ['#ff7a2a', '#ffb347'], count: 20, r: [0.6, 1.4] }],
  },
  volcano_path: {
    size: 512, base: '#2b2325',
    strokes: [{ colors: ['#211b1c', '#3a2f2e', '#463836'], count: 1100, len: [8, 20], width: [3, 7], alpha: [0.35, 0.6], jitter: 3 }],
    stones: { colors: ['#3d3332', '#4b3f3c'], count: 40, r: [8, 16], outline: '#160f10' },
    cracks: { color: '#ff6a1a', glow: '#ffb347', count: 4 },
  },
  volcano_rock: {
    size: 512, base: '#2a2325',
    strokes: [{ colors: ['#1f1a1c', '#3a3032', '#463a3a'], count: 1100, len: [16, 40], width: [4, 10], alpha: [0.35, 0.6], angle: 0.3, jitter: 0.5 }],
    cracks: { color: '#ff5a10', glow: '#ff9a3a', count: 3 },
  },
  bark: {
    size: 256, base: '#8b4a2b',
    strokes: [{ colors: ['#6e3820', '#a35a33', '#7c4027', '#b8693c'], count: 700, len: [30, 80], width: [3, 7], alpha: [0.35, 0.7], angle: Math.PI / 2, jitter: 0.06 }],
  },
  leaves: {
    size: 256, base: '#3f7d34',
    strokes: [{ colors: ['#2f6a2a', '#4f9640', '#6aad4c', '#2a5a25'], count: 900, len: [8, 18], width: [3, 7], alpha: [0.4, 0.8], jitter: 3 }],
  },
  pine: {
    size: 256, base: '#2c6436',
    strokes: [
      { colors: ['#1f4f2b', '#357a40', '#4a9150', '#24583a'], count: 900, len: [10, 24], width: [2, 4], alpha: [0.45, 0.85], angle: -2.2, jitter: 0.3 },
      { colors: ['#1f4f2b', '#357a40', '#4a9150'], count: 600, len: [10, 24], width: [2, 4], alpha: [0.45, 0.85], angle: -0.9, jitter: 0.3 },
    ],
  },
  stone: {
    size: 256, base: '#8a8d93',
    strokes: [{ colors: ['#7a7e85', '#9a9ea5', '#6c7077'], count: 600, len: [10, 26], width: [4, 8], alpha: [0.3, 0.55], jitter: 3 }],
    stones: { colors: ['#9da1a8', '#b0b4ba', '#8c9097'], count: 14, r: [18, 30], outline: '#4e5258' },
  },
  wood: {
    size: 256, base: '#8b5a34',
    strokes: [{ colors: ['#74482a', '#a06a3e', '#6a4126'], count: 500, len: [40, 90], width: [2, 5], alpha: [0.35, 0.6], angle: 0, jitter: 0.04 }],
  },
};

const cache = new Map<TexKey, THREE.Texture>();
let maxAniso = 4;

export function setMaxAnisotropy(v: number): void {
  maxAniso = Math.max(1, v);
}

export function getTexture(key: TexKey): THREE.Texture {
  let t = cache.get(key);
  if (t) return t;
  t = paint(SPECS[key], hash(key));
  const file = TEXTURE_FILES[key];
  if (file) {
    const fallback = t;
    new THREE.TextureLoader().load(`./textures/${file}`, (loaded) => {
      configure(loaded);
      fallback.image = loaded.image;
      fallback.needsUpdate = true;
    });
  }
  cache.set(key, t);
  return t;
}

function configure(t: THREE.Texture): void {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
}

function paint(spec: Spec, seed: number): THREE.Texture {
  const S = spec.size;
  const rng = new Rng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.fillStyle = spec.base;
  g.fillRect(0, 0, S, S);
  g.lineCap = 'round';

  // Zeichnet ein Element 9× versetzt, damit die Kachel nahtlos bleibt.
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };

  // Weiche Farbflecken für großflächige Variation
  for (let i = 0; i < 18; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const r = rng.range(S * 0.12, S * 0.3);
    const c = spec.strokes[0].colors[i % spec.strokes[0].colors.length];
    wrap((ox, oy) => {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, hexA(c, 0.35));
      grd.addColorStop(1, hexA(c, 0));
      g.fillStyle = grd;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }

  if (spec.stones) {
    const st = spec.stones;
    for (let i = 0; i < st.count; i++) {
      const x = rng.range(0, S);
      const y = rng.range(0, S);
      const rx = rng.range(st.r[0], st.r[1]);
      const ry = rx * rng.range(0.6, 0.95);
      const rot = rng.range(0, Math.PI);
      const col = rng.pick(st.colors);
      wrap((ox, oy) => {
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(rot);
        g.fillStyle = st.outline;
        g.beginPath();
        g.ellipse(0, 0, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.ellipse(-rx * 0.25, -ry * 0.3, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
    }
  }

  for (const layer of spec.strokes) {
    for (let i = 0; i < layer.count; i++) {
      const x = rng.range(0, S);
      const y = rng.range(0, S);
      const len = rng.range(layer.len[0], layer.len[1]);
      const a = layer.angle !== undefined ? layer.angle + rng.range(-(layer.jitter ?? 0.3), layer.jitter ?? 0.3) : rng.range(0, Math.PI * 2);
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len;
      g.strokeStyle = hexA(rng.pick(layer.colors), rng.range(layer.alpha[0], layer.alpha[1]));
      g.lineWidth = rng.range(layer.width[0], layer.width[1]);
      wrap((ox, oy) => {
        if (x + ox + Math.abs(dx) < -20 || x + ox - Math.abs(dx) > S + 20 || y + oy + Math.abs(dy) < -20 || y + oy - Math.abs(dy) > S + 20) return;
        g.beginPath();
        g.moveTo(x + ox - dx / 2, y + oy - dy / 2);
        g.quadraticCurveTo(x + ox + dy * 0.15, y + oy - dx * 0.15, x + ox + dx / 2, y + oy + dy / 2);
        g.stroke();
      });
    }
  }

  if (spec.cracks) {
    const c = spec.cracks;
    for (let i = 0; i < c.count; i++) {
      let x = rng.range(0, S);
      let y = rng.range(0, S);
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < 7; k++) {
        x += rng.range(-18, 18);
        y += rng.range(-18, 18);
        pts.push([x, y]);
      }
      for (const [w, col, al] of [[5, c.glow, 0.25], [1.6, c.color, 0.85]] as const) {
        g.strokeStyle = hexA(col, al);
        g.lineWidth = w;
        wrap((ox, oy) => {
          g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)));
          g.stroke();
        });
      }
    }
  }

  for (const d of spec.dots ?? []) {
    for (let i = 0; i < d.count; i++) {
      const x = rng.range(0, S);
      const y = rng.range(0, S);
      const r = rng.range(d.r[0], d.r[1]);
      g.fillStyle = rng.pick(d.colors);
      wrap((ox, oy) => {
        g.beginPath();
        g.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        g.fill();
      });
    }
  }

  const t = new THREE.CanvasTexture(canvas);
  configure(t);
  return t;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
