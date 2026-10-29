import * as THREE from 'three';
import type { ClassDef } from '../config/classes.ts';
import type { EnemyDef } from '../config/enemies.ts';
import type { MountDef } from '../config/mounts.ts';
import type { RaceDef } from '../config/races.ts';
import type { TowerId } from '../config/towers.ts';
import { basicMat, geo, mat, mix, part, pivot, tint } from './assets.ts';

/* ════════════════════════════════════════════════════════════════
 *  Prozedurale Low-Poly-Modelle. Alle Modelle blicken entlang +Z.
 *  Jedes Modell liefert benannte Gelenke für prozedurale Animation.
 * ════════════════════════════════════════════════════════════════ */

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  cape: THREE.Group | null;
  weaponTip: THREE.Object3D;
  hipHeight: number;
}

export function createHero(race: RaceDef, cls: ClassDef): HeroRig {
  const L = race.look;
  const h = L.height;
  const b = L.bulk;
  const root = new THREE.Group();
  const body = pivot(root);
  body.scale.setScalar(h);
  const skin = mat(L.skin);
  const armor = mat(cls.armorColor, { roughness: 0.6, metalness: cls.gear === 'sword' ? 0.45 : 0.1 });
  const trim = mat(cls.trimColor, { roughness: 0.4, metalness: 0.5 });
  const dark = mat(0x2a2320);
  const cloth = mat(tint(cls.armorColor, 0.75));
  const hip = 0.9;

  // Beine
  const legL = pivot(body, -0.15 * b, hip, 0);
  const legR = pivot(body, 0.15 * b, hip, 0);
  for (const leg of [legL, legR]) {
    part(geo.box(0.2 * b, 0.55, 0.22), cloth, leg, 0, -0.27, 0);
    part(geo.box(0.22 * b, 0.36, 0.27), dark, leg, 0, -0.72, 0.03);
  }

  // Rumpf
  const torso = pivot(body, 0, hip, 0);
  part(geo.box(0.58 * b, 0.64, 0.34 * b), armor, torso, 0, 0.33, 0);
  part(geo.box(0.6 * b, 0.1, 0.36 * b), dark, torso, 0, 0.04, 0);
  part(geo.box(0.14, 0.12, 0.05), trim, torso, 0, 0.05, 0.19 * b);
  part(geo.box(0.3 * b, 0.22, 0.05), trim, torso, 0, 0.42, 0.18 * b);
  if (cls.gear === 'staff') {
    // Robe
    part(geo.cyl(0.3 * b, 0.42 * b, 0.6, 7), armor, torso, 0, -0.3, 0);
  }
  if (cls.gear === 'sword' || cls.gear === 'daggers') {
    part(geo.box(0.26, 0.14, 0.34), trim, torso, -0.36 * b, 0.62, 0, 0, 0, 0.25);
    part(geo.box(0.26, 0.14, 0.34), trim, torso, 0.36 * b, 0.62, 0, 0, 0, -0.25);
  }

  // Kopf
  const head = pivot(torso, 0, 0.72, 0);
  part(geo.box(0.34, 0.36, 0.34), skin, head, 0, 0.18, 0);
  part(geo.box(0.36, 0.12, 0.36), mat(L.hair), head, 0, 0.38, -0.01);
  part(geo.box(0.36, 0.22, 0.08), mat(L.hair), head, 0, 0.24, -0.16);
  const eye = mat(L.tusks ? 0xffc23a : 0x1b1b1b, L.tusks ? { emissive: 0xff7a00, emissiveIntensity: 0.6 } : {});
  part(geo.box(0.06, 0.05, 0.02), eye, head, -0.08, 0.2, 0.17);
  part(geo.box(0.06, 0.05, 0.02), eye, head, 0.08, 0.2, 0.17);
  if (L.ears === 'pointy') {
    part(geo.cone(0.05, 0.26, 4), skin, head, -0.2, 0.22, -0.02, 0, 0, Math.PI / 2 + 0.35);
    part(geo.cone(0.05, 0.26, 4), skin, head, 0.2, 0.22, -0.02, 0, 0, -Math.PI / 2 - 0.35);
  }
  if (L.tusks) {
    part(geo.cone(0.03, 0.12, 4), mat(0xf5ecd7), head, -0.08, 0.05, 0.17);
    part(geo.cone(0.03, 0.12, 4), mat(0xf5ecd7), head, 0.08, 0.05, 0.17);
  }
  if (L.beard) {
    part(geo.box(0.3, 0.3, 0.1), mat(L.hair), head, 0, -0.02, 0.17);
    part(geo.cone(0.12, 0.2, 5), mat(L.hair), head, 0, -0.22, 0.17, Math.PI, 0, 0);
  }
  if (cls.gear === 'sword') {
    // Helm
    part(geo.box(0.4, 0.14, 0.4), armor, head, 0, 0.4, 0);
    part(geo.box(0.06, 0.16, 0.3), trim, head, 0, 0.5, 0);
  } else if (cls.gear === 'staff') {
    part(geo.cone(0.26, 0.5, 6), armor, head, 0, 0.6, -0.03);
    part(geo.cyl(0.32, 0.32, 0.04, 8), armor, head, 0, 0.36, 0);
  } else if (cls.gear === 'bow' || cls.gear === 'daggers') {
    part(geo.box(0.42, 0.3, 0.42), cloth, head, 0, 0.32, -0.04);
  }

  // Arme
  const armL = pivot(torso, -0.38 * b, 0.6, 0);
  const armR = pivot(torso, 0.38 * b, 0.6, 0);
  for (const arm of [armL, armR]) {
    part(geo.box(0.16 * b, 0.42, 0.18), armor, arm, 0, -0.2, 0);
    part(geo.box(0.15 * b, 0.22, 0.16), skin, arm, 0, -0.5, 0);
  }

  // Ausrüstung
  const weaponTip = new THREE.Object3D();
  if (cls.gear === 'sword') {
    const w = pivot(armR, 0, -0.6, 0.05);
    w.rotation.x = Math.PI / 2;
    part(geo.box(0.06, 0.06, 0.25), dark, w, 0, 0, 0.02);
    part(geo.box(0.28, 0.05, 0.06), trim, w, 0, 0, 0.14);
    part(geo.box(0.08, 0.02, 0.85), mat(0xd9e2ec, { metalness: 0.8, roughness: 0.25 }), w, 0, 0, 0.6);
    w.add(weaponTip);
    weaponTip.position.set(0, 0, 1.0);
    const s = pivot(armL, -0.08, -0.4, 0.06);
    part(geo.box(0.08, 0.6, 0.5), armor, s, 0, 0, 0.05);
    part(geo.box(0.1, 0.18, 0.18), trim, s, -0.02, 0, 0.05);
  } else if (cls.gear === 'staff') {
    const w = pivot(armR, 0, -0.55, 0.05);
    part(geo.cyl(0.035, 0.035, 1.7, 5), mat(0x5b3a22), w, 0, 0.35, 0);
    const orb = part(geo.ico(0.13, 0), mat(0x7dd3fc, { emissive: 0x22d3ee, emissiveIntensity: 1.6 }), w, 0, 1.25, 0);
    orb.castShadow = false;
    part(geo.torus(0.14, 0.025, 4, 8), trim, w, 0, 1.25, 0, Math.PI / 2);
    w.add(weaponTip);
    weaponTip.position.set(0, 1.25, 0);
  } else if (cls.gear === 'daggers') {
    for (const arm of [armL, armR]) {
      const w = pivot(arm, 0, -0.6, 0.05);
      w.rotation.x = Math.PI / 2;
      part(geo.box(0.05, 0.05, 0.14), dark, w, 0, 0, 0);
      part(geo.box(0.05, 0.015, 0.42), mat(0xb8c4d6, { metalness: 0.8, roughness: 0.3, emissive: 0x6d28d9, emissiveIntensity: 0.25 }), w, 0, 0, 0.27);
    }
    armR.add(weaponTip);
    weaponTip.position.set(0, -0.9, 0.2);
  } else {
    const w = pivot(armL, -0.02, -0.55, 0.12);
    const bow = part(geo.torus(0.55, 0.03, 4, 12, Math.PI), mat(0x6b4423), w, 0, 0, 0, 0, Math.PI / 2, Math.PI / 2);
    bow.rotation.set(0, -Math.PI / 2, Math.PI / 2);
    part(geo.box(0.01, 1.1, 0.01), mat(0xe5e7eb), w, 0, 0, -0.02);
    part(geo.box(0.16, 0.5, 0.14), mat(0x5b3a22), torso, 0.12, 0.45, -0.22, 0.3, 0, 0);
    w.add(weaponTip);
    weaponTip.position.set(0, 0, 0.3);
  }

  // Umhang
  let cape: THREE.Group | null = null;
  if (cls.gear !== 'daggers') {
    cape = pivot(torso, 0, 0.62, -0.18 * b);
    part(geo.box(0.52 * b, 0.95, 0.04), mat(mix(cls.trimColor, 0x111111, 0.45)), cape, 0, -0.47, 0);
  }

  return { root, body, torso, head, armL, armR, legL, legR, cape, weaponTip, hipHeight: hip * h };
}

/* ── Reittiere ──────────────────────────────────────────────── */
export interface MountRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  tail: THREE.Group;
  saddle: THREE.Object3D;
}

export function createMount(def: MountDef): MountRig {
  const root = new THREE.Group();
  const body = pivot(root);
  const c = def.colors;
  const bodyMat = mat(c.body);
  const maneMat = mat(c.mane);
  const accent = mat(c.accent, { roughness: 0.5 });
  const legs: THREE.Group[] = [];
  const saddle = new THREE.Object3D();
  let head: THREE.Group;
  let tail: THREE.Group;

  if (def.id === 'horse') {
    body.position.y = 1.15;
    part(geo.box(0.62, 0.62, 1.55), bodyMat, body, 0, 0, 0);
    part(geo.box(0.66, 0.2, 0.7), accent, body, 0, 0.33, -0.05);
    part(geo.box(0.7, 0.42, 0.06), accent, body, 0, 0.05, 0.35);
    head = pivot(body, 0, 0.3, 0.72);
    part(geo.box(0.3, 0.7, 0.36), bodyMat, head, 0, 0.3, 0.05, 0.45);
    part(geo.box(0.26, 0.26, 0.55), bodyMat, head, 0, 0.62, 0.32);
    part(geo.box(0.08, 0.6, 0.3), maneMat, head, 0, 0.4, -0.12, 0.45);
    part(geo.cone(0.05, 0.14, 4), bodyMat, head, -0.08, 0.82, 0.18);
    part(geo.cone(0.05, 0.14, 4), bodyMat, head, 0.08, 0.82, 0.18);
    part(geo.box(0.32, 0.05, 0.05), mat(0x111111), head, 0, 0.68, 0.45);
    for (const [x, z] of [[-0.2, 0.58], [0.2, 0.58], [-0.2, -0.58], [0.2, -0.58]] as const) {
      const leg = pivot(body, x, -0.25, z);
      part(geo.box(0.16, 0.6, 0.18), bodyMat, leg, 0, -0.3, 0);
      part(geo.box(0.14, 0.42, 0.15), bodyMat, leg, 0, -0.75, 0);
      part(geo.box(0.17, 0.08, 0.2), maneMat, leg, 0, -0.98, 0.02);
      legs.push(leg);
    }
    tail = pivot(body, 0, 0.18, -0.78);
    part(geo.box(0.12, 0.6, 0.12), maneMat, tail, 0, -0.3, -0.05, -0.25);
    body.add(saddle);
    saddle.position.set(0, 0.38, -0.05);
  } else if (def.id === 'wolf') {
    body.position.y = 0.95;
    part(geo.box(0.64, 0.6, 1.4), bodyMat, body, 0, 0, 0);
    part(geo.box(0.74, 0.7, 0.55), maneMat, body, 0, 0.06, 0.45);
    part(geo.box(0.66, 0.14, 0.6), accent, body, 0, 0.33, -0.05);
    head = pivot(body, 0, 0.22, 0.75);
    part(geo.box(0.42, 0.38, 0.4), bodyMat, head, 0, 0.08, 0.12);
    part(geo.box(0.24, 0.2, 0.34), bodyMat, head, 0, -0.02, 0.45);
    part(geo.box(0.12, 0.06, 0.06), mat(0x111111), head, 0, 0.05, 0.62);
    part(geo.cone(0.08, 0.22, 4), maneMat, head, -0.13, 0.35, 0.05);
    part(geo.cone(0.08, 0.22, 4), maneMat, head, 0.13, 0.35, 0.05);
    const eyeM = mat(0xc4b5fd, { emissive: 0x8b5cf6, emissiveIntensity: 1.8 });
    part(geo.box(0.06, 0.04, 0.02), eyeM, head, -0.1, 0.14, 0.33);
    part(geo.box(0.06, 0.04, 0.02), eyeM, head, 0.1, 0.14, 0.33);
    for (const [x, z] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]] as const) {
      const leg = pivot(body, x, -0.22, z);
      part(geo.box(0.17, 0.5, 0.2), bodyMat, leg, 0, -0.25, 0);
      part(geo.box(0.15, 0.3, 0.17), maneMat, leg, 0, -0.6, 0.02);
      legs.push(leg);
    }
    tail = pivot(body, 0, 0.15, -0.7);
    part(geo.box(0.18, 0.18, 0.7), maneMat, tail, 0, 0.1, -0.3, 0.5);
    body.add(saddle);
    saddle.position.set(0, 0.36, -0.08);
  } else {
    body.position.y = 0.8;
    part(geo.box(0.8, 0.52, 1.6), bodyMat, body, 0, 0, 0);
    part(geo.box(0.6, 0.12, 1.2), accent, body, 0, 0.3, -0.05);
    for (let i = 0; i < 5; i++) part(geo.cone(0.09, 0.3, 4), maneMat, body, 0, 0.42, 0.55 - i * 0.3);
    head = pivot(body, 0, 0.12, 0.8);
    part(geo.box(0.44, 0.3, 0.5), bodyMat, head, 0, 0.05, 0.25);
    part(geo.box(0.34, 0.14, 0.4), bodyMat, head, 0, -0.08, 0.55);
    part(geo.cone(0.06, 0.3, 4), accent, head, -0.18, 0.25, 0.05, -0.8, 0, 0.3);
    part(geo.cone(0.06, 0.3, 4), accent, head, 0.18, 0.25, 0.05, -0.8, 0, -0.3);
    const eyeM = mat(0xfde68a, { emissive: 0xf59e0b, emissiveIntensity: 2 });
    part(geo.box(0.06, 0.05, 0.02), eyeM, head, -0.15, 0.12, 0.47);
    part(geo.box(0.06, 0.05, 0.02), eyeM, head, 0.15, 0.12, 0.47);
    for (const [x, z] of [[-0.42, 0.5], [0.42, 0.5], [-0.42, -0.5], [0.42, -0.5]] as const) {
      const leg = pivot(body, x, -0.1, z);
      part(geo.box(0.36, 0.16, 0.18), bodyMat, leg, Math.sign(x) * 0.12, 0, 0);
      part(geo.box(0.16, 0.5, 0.18), bodyMat, leg, Math.sign(x) * 0.28, -0.3, 0);
      legs.push(leg);
    }
    tail = pivot(body, 0, 0, -0.8);
    part(geo.box(0.36, 0.26, 0.7), bodyMat, tail, 0, 0, -0.3);
    part(geo.box(0.2, 0.16, 0.7), bodyMat, tail, 0, -0.04, -0.95);
    part(geo.box(0.22, 0.16, 0.3), mat(0xff7a1a, { emissive: 0xff4d00, emissiveIntensity: 1.5 }), tail, 0, 0.06, -1.32);
    body.add(saddle);
    saddle.position.set(0, 0.32, -0.05);
  }
  return { root, body, head, legs, tail, saddle };
}

/* ── Begleiter (Waldläufer) ─────────────────────────────────── */
export interface PetRig {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Group[];
}

export function createPet(): PetRig {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0.55, 0);
  const m = mat(0x86efac, { emissive: 0x22c55e, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  part(geo.box(0.38, 0.36, 0.85), m, body);
  part(geo.box(0.3, 0.28, 0.32), m, body, 0, 0.16, 0.5);
  part(geo.box(0.16, 0.14, 0.22), m, body, 0, 0.1, 0.72);
  part(geo.cone(0.06, 0.16, 4), m, body, -0.08, 0.36, 0.45);
  part(geo.cone(0.06, 0.16, 4), m, body, 0.08, 0.36, 0.45);
  part(geo.box(0.1, 0.1, 0.45), m, body, 0, 0.15, -0.6, 0.6);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.3], [0.12, -0.3]] as const) {
    const leg = pivot(body, x, -0.15, z);
    part(geo.box(0.1, 0.4, 0.1), m, leg, 0, -0.2, 0);
    legs.push(leg);
  }
  root.traverse((o) => ((o as THREE.Mesh).castShadow = false));
  return { root, body, legs };
}

/* ── Gegner ─────────────────────────────────────────────────── */
export type EnemyAnim = 'biped' | 'quad' | 'hex' | 'wyrm';

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  legs: THREE.Group[];
  wings: THREE.Group[];
  anim: EnemyAnim;
  /** Höhe über Grund für Lebensbalken. */
  barHeight: number;
}

export function createEnemy(def: EnemyDef, biomeTint: number): EnemyRig {
  const root = new THREE.Group();
  const body = pivot(root);
  const base = def.boss ? def.color : mix(def.color, biomeTint, 0.35);
  const skin = mat(base);
  const darkM = mat(tint(base, 0.55));
  const bone = mat(0xe7dcc8);
  const glow = (c: number, e: number, i = 2) => mat(c, { emissive: e, emissiveIntensity: i });
  const legs: THREE.Group[] = [];
  const wings: THREE.Group[] = [];
  let head: THREE.Group;
  let armL: THREE.Group | null = null;
  let armR: THREE.Group | null = null;
  let anim: EnemyAnim = 'biped';
  let barHeight = 1.7;

  const biped = (w: number, hgt: number, legLen: number, bodyMat: THREE.Material) => {
    for (const x of [-w * 0.28, w * 0.28]) {
      const leg = pivot(body, x, legLen, 0);
      part(geo.box(w * 0.3, legLen, w * 0.32), darkM, leg, 0, -legLen / 2, 0);
      legs.push(leg);
    }
    part(geo.box(w, hgt, w * 0.7), bodyMat, body, 0, legLen + hgt / 2, 0, 0.15);
    armL = pivot(body, -w * 0.62, legLen + hgt * 0.85, 0.05);
    armR = pivot(body, w * 0.62, legLen + hgt * 0.85, 0.05);
    for (const a of [armL, armR]) part(geo.box(w * 0.26, hgt * 0.9, w * 0.26), bodyMat, a, 0, -hgt * 0.42, 0);
  };

  switch (def.model) {
    case 'grunt': {
      biped(0.62, 0.62, 0.45, skin);
      head = pivot(body, 0, 1.14, 0.1);
      part(geo.box(0.46, 0.4, 0.42), skin, head, 0, 0.18, 0);
      part(geo.cone(0.08, 0.36, 4), skin, head, -0.32, 0.25, 0, 0, 0, Math.PI / 2 + 0.3);
      part(geo.cone(0.08, 0.36, 4), skin, head, 0.32, 0.25, 0, 0, 0, -Math.PI / 2 - 0.3);
      part(geo.box(0.08, 0.06, 0.02), glow(0xfde047, 0xf59e0b), head, -0.1, 0.22, 0.22);
      part(geo.box(0.08, 0.06, 0.02), glow(0xfde047, 0xf59e0b), head, 0.1, 0.22, 0.22);
      part(geo.box(0.12, 0.5, 0.12), mat(0x5b3a22), armR!, 0, -0.62, 0.15, 1.2);
      part(geo.box(0.62, 0.12, 0.46), mat(0x6b4f2a), body, 0, 0.6, 0);
      barHeight = 1.75;
      break;
    }
    case 'archer': {
      biped(0.52, 0.6, 0.48, skin);
      head = pivot(body, 0, 1.12, 0.05);
      part(geo.box(0.4, 0.38, 0.38), skin, head, 0, 0.18, 0);
      part(geo.cone(0.28, 0.35, 5), mat(0x3f4b5e), head, 0, 0.5, -0.02);
      part(geo.box(0.08, 0.05, 0.02), glow(0x93c5fd, 0x3b82f6), head, -0.09, 0.2, 0.2);
      part(geo.box(0.08, 0.05, 0.02), glow(0x93c5fd, 0x3b82f6), head, 0.09, 0.2, 0.2);
      part(geo.cyl(0.025, 0.025, 1.5, 4), mat(0x6b4423), armR!, 0, -0.5, 0.1, 1.3);
      part(geo.cone(0.06, 0.2, 4), mat(0xcbd5e1, { metalness: 0.7 }), armR!, 0, -0.2, 0.8, 1.3 + Math.PI / 2);
      part(geo.box(0.18, 0.5, 0.18), mat(0x5b3a22), body, 0.12, 1.0, -0.26, 0.3);
      barHeight = 1.8;
      break;
    }
    case 'runner': {
      anim = 'quad';
      body.position.y = 0.75;
      part(geo.box(0.45, 0.42, 1.1), skin, body);
      part(geo.box(0.5, 0.2, 0.5), darkM, body, 0, 0.25, 0.25);
      head = pivot(body, 0, 0.1, 0.6);
      part(geo.box(0.34, 0.3, 0.42), skin, head, 0, 0.05, 0.15);
      part(geo.box(0.07, 0.05, 0.02), glow(0xf0abfc, 0xd946ef), head, -0.09, 0.1, 0.37);
      part(geo.box(0.07, 0.05, 0.02), glow(0xf0abfc, 0xd946ef), head, 0.09, 0.1, 0.37);
      part(geo.cone(0.06, 0.25, 4), darkM, head, -0.1, 0.3, 0);
      part(geo.cone(0.06, 0.25, 4), darkM, head, 0.1, 0.3, 0);
      for (const [x, z] of [[-0.15, 0.38], [0.15, 0.38], [-0.15, -0.38], [0.15, -0.38]] as const) {
        const leg = pivot(body, x, -0.15, z);
        part(geo.box(0.12, 0.6, 0.12), darkM, leg, 0, -0.3, 0);
        legs.push(leg);
      }
      const t = pivot(body, 0, 0.1, -0.55);
      part(geo.box(0.08, 0.08, 0.6), darkM, t, 0, 0.1, -0.25, 0.5);
      barHeight = 1.5;
      break;
    }
    case 'brute': {
      biped(1.1, 1.0, 0.75, skin);
      head = pivot(body, 0, 1.8, 0.25);
      part(geo.box(0.5, 0.42, 0.46), skin, head, 0, 0.12, 0);
      part(geo.cone(0.06, 0.18, 4), bone, head, -0.12, 0.0, 0.25, -0.5);
      part(geo.cone(0.06, 0.18, 4), bone, head, 0.12, 0.0, 0.25, -0.5);
      part(geo.box(0.08, 0.06, 0.02), glow(0xfca5a5, 0xef4444), head, -0.12, 0.2, 0.24);
      part(geo.box(0.08, 0.06, 0.02), glow(0xfca5a5, 0xef4444), head, 0.12, 0.2, 0.24);
      part(geo.dodec(0.38), mat(0x78716c), armR!, 0, -1.05, 0.1);
      part(geo.box(1.2, 0.3, 0.85), mat(0x57534e), body, 0, 1.55, 0);
      barHeight = 2.6;
      break;
    }
    case 'shaman': {
      biped(0.56, 0.66, 0.45, mat(0x4c1d95));
      part(geo.cyl(0.28, 0.42, 0.55, 6), mat(0x4c1d95), body, 0, 0.42, 0);
      head = pivot(body, 0, 1.18, 0.05);
      part(geo.box(0.38, 0.38, 0.36), skin, head, 0, 0.18, 0);
      part(geo.box(0.42, 0.3, 0.1), bone, head, 0, 0.2, 0.2);
      part(geo.box(0.08, 0.06, 0.02), glow(0xe9d5ff, 0xa855f7, 3), head, -0.09, 0.22, 0.26);
      part(geo.box(0.08, 0.06, 0.02), glow(0xe9d5ff, 0xa855f7, 3), head, 0.09, 0.22, 0.26);
      part(geo.cone(0.05, 0.3, 4), bone, head, -0.16, 0.45, 0, 0, 0, 0.4);
      part(geo.cone(0.05, 0.3, 4), bone, head, 0.16, 0.45, 0, 0, 0, -0.4);
      part(geo.cyl(0.03, 0.03, 1.5, 4), mat(0x3f2a1d), armR!, 0, -0.3, 0.12);
      const orb = part(geo.ico(0.14), glow(0xd8b4fe, 0xa855f7, 2.5), armR!, 0, 0.45, 0.12);
      orb.castShadow = false;
      barHeight = 1.95;
      break;
    }
    case 'elite': {
      biped(0.9, 0.95, 0.7, mat(0x3f0d1a, { metalness: 0.5, roughness: 0.4 }));
      head = pivot(body, 0, 1.7, 0.08);
      part(geo.box(0.46, 0.46, 0.46), mat(0x2b0a12, { metalness: 0.6, roughness: 0.35 }), head, 0, 0.2, 0);
      part(geo.cone(0.07, 0.45, 4), bone, head, -0.26, 0.5, 0, 0, 0, 0.6);
      part(geo.cone(0.07, 0.45, 4), bone, head, 0.26, 0.5, 0, 0, 0, -0.6);
      part(geo.box(0.32, 0.05, 0.02), glow(0xfecaca, 0xef4444, 3), head, 0, 0.24, 0.24);
      for (const s of [-1, 1]) {
        part(geo.box(0.4, 0.2, 0.5), mat(0x7f1d1d, { metalness: 0.5 }), body, s * 0.6, 1.55, 0);
        part(geo.cone(0.07, 0.3, 4), bone, body, s * 0.68, 1.78, 0);
      }
      part(geo.box(0.12, 0.12, 0.35), mat(0x1c1917), armR!, 0, -0.85, 0.05, Math.PI / 2);
      part(geo.box(0.16, 0.03, 1.3), glow(0xfca5a5, 0xdc2626, 0.6), armR!, 0, -0.85, 0.75, 0);
      barHeight = 2.5;
      break;
    }
    case 'treant': {
      // Morgrath – verdorrter Baumriese
      const bark = mat(0x4a3728);
      const moss = mat(0x3f6212);
      for (const x of [-0.5, 0.5]) {
        const leg = pivot(body, x, 1.4, 0);
        part(geo.cyl(0.32, 0.45, 1.4, 6), bark, leg, 0, -0.7, 0);
        part(geo.box(0.9, 0.25, 0.7), bark, leg, 0, -1.3, 0.15);
        legs.push(leg);
      }
      part(geo.cyl(0.9, 1.0, 2.2, 7), bark, body, 0, 2.5, 0);
      part(geo.cyl(0.95, 0.9, 0.5, 7), moss, body, 0, 3.3, 0);
      head = pivot(body, 0, 3.6, 0.3);
      part(geo.box(0.9, 0.8, 0.8), bark, head, 0, 0.3, 0);
      part(geo.box(0.2, 0.12, 0.05), glow(0xbef264, 0x84cc16, 3), head, -0.22, 0.38, 0.41);
      part(geo.box(0.2, 0.12, 0.05), glow(0xbef264, 0x84cc16, 3), head, 0.22, 0.38, 0.41);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        part(geo.ico(0.75), mat(i % 2 ? 0x4d7c0f : 0x365314), head, Math.cos(a) * 0.8, 1.1 + (i % 2) * 0.3, Math.sin(a) * 0.6 - 0.2);
      }
      armL = pivot(body, -1.1, 3.1, 0);
      armR = pivot(body, 1.1, 3.1, 0);
      for (const a of [armL, armR]) {
        part(geo.cyl(0.18, 0.28, 1.9, 5), bark, a, 0, -0.95, 0);
        part(geo.cone(0.1, 0.6, 4), bark, a, 0.15, -1.9, 0.2, 0.6);
        part(geo.cone(0.1, 0.6, 4), bark, a, -0.15, -1.9, 0.2, 0.6);
      }
      barHeight = 6;
      break;
    }
    case 'scarab': {
      anim = 'hex';
      const shell = mat(0x0f766e, { metalness: 0.6, roughness: 0.3 });
      const gold = mat(0xd4a017, { metalness: 0.8, roughness: 0.3 });
      body.position.y = 1.3;
      const s = part(geo.sphere(1.5, 10, 7), shell, body, 0, 0.2, -0.2);
      s.scale.set(1.1, 0.7, 1.4);
      part(geo.box(0.06, 0.9, 3.4), gold, body, 0, 0.75, -0.2);
      head = pivot(body, 0, 0, 1.7);
      part(geo.box(1.1, 0.7, 0.8), mat(0x134e4a), head, 0, 0, 0);
      part(geo.cone(0.18, 1.3, 5), gold, head, 0, 0.6, 0.4, 0.6);
      part(geo.box(0.16, 0.12, 0.04), glow(0x67e8f9, 0x06b6d4, 3), head, -0.3, 0.12, 0.41);
      part(geo.box(0.16, 0.12, 0.04), glow(0x67e8f9, 0x06b6d4, 3), head, 0.3, 0.12, 0.41);
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1;
        const z = 0.9 - (i % 3) * 0.9;
        const leg = pivot(body, side * 1.2, -0.3, z);
        part(geo.box(1.1, 0.16, 0.16), mat(0x115e59), leg, side * 0.5, 0.15, 0, 0, 0, side * -0.4);
        part(geo.box(0.16, 1.1, 0.16), mat(0x115e59), leg, side * 1.0, -0.4, 0);
        legs.push(leg);
      }
      barHeight = 4;
      break;
    }
    case 'wyrm': {
      anim = 'wyrm';
      const scale = mat(0x7dd3fc, { roughness: 0.5 });
      const belly = mat(0xe0f2fe);
      const ice = mat(0xbae6fd, { emissive: 0x38bdf8, emissiveIntensity: 0.8 });
      body.position.y = 1.6;
      part(geo.box(1.4, 1.2, 3), scale, body);
      part(geo.box(1.2, 0.4, 2.6), belly, body, 0, -0.5, 0);
      for (let i = 0; i < 5; i++) part(geo.cone(0.15, 0.5, 4), ice, body, 0, 0.75, 1.1 - i * 0.55);
      head = pivot(body, 0, 0.5, 1.5);
      part(geo.box(0.6, 0.6, 1.4), scale, head, 0, 0.5, 0.4, -0.7);
      part(geo.box(0.8, 0.6, 1.0), scale, head, 0, 1.2, 1.1);
      part(geo.box(0.6, 0.2, 0.7), belly, head, 0, 0.9, 1.35);
      part(geo.cone(0.12, 0.8, 4), ice, head, -0.3, 1.7, 0.7, -1.0);
      part(geo.cone(0.12, 0.8, 4), ice, head, 0.3, 1.7, 0.7, -1.0);
      part(geo.box(0.16, 0.1, 0.04), glow(0xe0f2fe, 0x38bdf8, 4), head, -0.25, 1.35, 1.61);
      part(geo.box(0.16, 0.1, 0.04), glow(0xe0f2fe, 0x38bdf8, 4), head, 0.25, 1.35, 1.61);
      for (const s of [-1, 1]) {
        const wing = pivot(body, s * 0.6, 0.5, 0.4);
        const wm = part(geo.wing(), mat(0x93c5fd, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), wing, 0, 0, 0);
        wm.scale.set(s * 1.4, 1, 1.4);
        wings.push(wing);
      }
      for (const [x, z] of [[-0.6, 0.9], [0.6, 0.9], [-0.6, -0.9], [0.6, -0.9]] as const) {
        const leg = pivot(body, x, -0.5, z);
        part(geo.box(0.36, 1.1, 0.4), scale, leg, 0, -0.55, 0);
        legs.push(leg);
      }
      const tail = pivot(body, 0, 0, -1.5);
      part(geo.box(0.7, 0.6, 1.6), scale, tail, 0, 0, -0.7);
      part(geo.box(0.4, 0.36, 1.4), scale, tail, 0, 0, -2.0);
      part(geo.cone(0.3, 0.6, 4), ice, tail, 0, 0, -2.9, -Math.PI / 2);
      barHeight = 5;
      break;
    }
    case 'colossus':
    default: {
      // Pyrax – Glutkoloss aus Gestein und Magma
      const rock = mat(0x3f3a36);
      const lava = mat(0xff7a1a, { emissive: 0xff4d00, emissiveIntensity: 2.2 });
      for (const x of [-0.75, 0.75]) {
        const leg = pivot(body, x, 1.7, 0);
        part(geo.dodec(0.6), rock, leg, 0, -0.5, 0);
        part(geo.dodec(0.55), rock, leg, 0, -1.3, 0.1);
        legs.push(leg);
      }
      part(geo.dodec(1.4), rock, body, 0, 3.0, 0);
      part(geo.box(1.4, 0.2, 0.2), lava, body, 0, 3.0, 1.15);
      part(geo.box(0.2, 1.2, 0.2), lava, body, 0.3, 3.2, 1.1);
      part(geo.box(0.2, 0.8, 0.2), lava, body, -0.5, 2.6, 1.05, 0, 0, 0.6);
      head = pivot(body, 0, 4.3, 0.2);
      part(geo.dodec(0.6), rock, head, 0, 0.2, 0);
      part(geo.box(0.5, 0.12, 0.05), lava, head, 0, 0.25, 0.5);
      armL = pivot(body, -1.6, 3.8, 0);
      armR = pivot(body, 1.6, 3.8, 0);
      for (const a of [armL, armR]) {
        part(geo.dodec(0.55), rock, a, 0, -0.5, 0);
        part(geo.dodec(0.5), rock, a, 0, -1.3, 0.1);
        part(geo.dodec(0.62), lava, a, 0, -2.0, 0.15);
      }
      barHeight = 6.2;
      break;
    }
  }
  root.scale.setScalar(def.scale);
  return { root, body, head: head!, armL, armR, legs, wings, anim, barHeight: barHeight * def.scale };
}

/* ── Türme ─────────────────────────────────────────────────── */
export interface TowerRig {
  root: THREE.Group;
  turret: THREE.Group;
  muzzle: THREE.Object3D;
  spin: THREE.Object3D | null;
  rangeRing: THREE.Mesh;
}

export function createTower(type: TowerId, level: number): TowerRig {
  const root = new THREE.Group();
  const stone = mat(0x9ca3af);
  const stoneDark = mat(0x6b7280);
  const wood = mat(0x7c4a24);
  const gold = mat(0xfbbf24, { metalness: 0.7, roughness: 0.35 });
  const turret = pivot(root);
  const muzzle = new THREE.Object3D();
  let spin: THREE.Object3D | null = null;
  const lv = Math.max(1, Math.min(3, level));

  if (type === 'arrow') {
    part(geo.cyl(1.05, 1.25, 1.6 + lv * 0.25, 6), stone, root, 0, 0.8 + lv * 0.12, 0);
    part(geo.cyl(1.3, 1.3, 0.25, 6), stoneDark, root, 0, 0.12, 0);
    const topY = 1.6 + lv * 0.25;
    part(geo.box(2.1, 0.18, 2.1), wood, root, 0, topY + 0.1, 0);
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]] as const) {
      part(geo.box(0.16, 1.2, 0.16), wood, root, x, topY + 0.7, z);
    }
    part(geo.cone(1.6, 1.0, 4), lv >= 3 ? gold : mat(0x9b2c2c), root, 0, topY + 1.75, 0, 0, Math.PI / 4);
    turret.position.y = topY + 0.55;
    part(geo.box(0.24, 0.24, 1.1), wood, turret, 0, 0, 0.1);
    part(geo.torus(0.55, 0.04, 4, 10, Math.PI), mat(0x5b3a22), turret, 0, 0, 0.45, Math.PI / 2, 0, 0);
    if (lv >= 2) {
      part(geo.box(0.05, 0.7, 0.4), mat(0x2563eb), root, 1.08, topY - 0.5, 0, 0, 0, 0);
      part(geo.box(0.05, 0.7, 0.4), mat(0x2563eb), root, -1.08, topY - 0.5, 0, 0, 0, 0);
    }
    if (lv >= 3) part(geo.torus(1.2, 0.08, 4, 12), gold, root, 0, topY - 0.05, 0, Math.PI / 2);
    turret.add(muzzle);
    muzzle.position.set(0, 0.1, 0.7);
  } else if (type === 'arcane') {
    const violet = mat(0x4c1d95, { roughness: 0.6 });
    part(geo.cyl(1.2, 1.4, 0.5, 6), stoneDark, root, 0, 0.25, 0);
    part(geo.cyl(0.8, 1.05, 1.4 + lv * 0.2, 6), violet, root, 0, 1.1 + lv * 0.1, 0);
    const topY = 1.8 + lv * 0.2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      part(geo.box(0.16, 1.3, 0.16), mat(0x6d28d9), root, Math.cos(a) * 0.75, topY + 0.6, Math.sin(a) * 0.75);
      part(geo.oct(0.14), mat(0xc4b5fd, { emissive: 0x8b5cf6, emissiveIntensity: 2 }), root, Math.cos(a) * 0.75, topY + 1.35, Math.sin(a) * 0.75);
    }
    turret.position.y = topY + 1.3;
    const crystal = part(geo.oct(0.42 + lv * 0.08), mat(0xddd6fe, { emissive: 0x8b5cf6, emissiveIntensity: 1.8 + lv * 0.3 }), turret, 0, 0, 0);
    crystal.scale.y = 1.6;
    crystal.castShadow = false;
    spin = crystal;
    if (lv >= 2) part(geo.torus(0.75, 0.04, 4, 16), mat(0xa78bfa, { emissive: 0x7c3aed, emissiveIntensity: 1.2 }), turret, 0, 0, 0, Math.PI / 2);
    if (lv >= 3) part(geo.torus(0.95, 0.04, 4, 16), gold, turret, 0, 0, 0, Math.PI / 3);
    turret.add(muzzle);
  } else {
    const ice = mat(0xa5f3fc, { emissive: 0x06b6d4, emissiveIntensity: 0.7 + lv * 0.25, roughness: 0.3, transparent: true, opacity: 0.92 });
    part(geo.cyl(1.2, 1.35, 0.4, 6), mat(0x94a3b8), root, 0, 0.2, 0);
    const ob = part(geo.cyl(0.08, 0.6, 2.6 + lv * 0.4, 4), ice, root, 0, 1.6 + lv * 0.2, 0);
    ob.rotation.y = Math.PI / 4;
    for (let i = 0; i < 2 + lv; i++) {
      const a = (i / (2 + lv)) * Math.PI * 2;
      part(geo.cone(0.18, 1.0, 4), ice, root, Math.cos(a) * 0.85, 0.7, Math.sin(a) * 0.85, Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    }
    turret.position.y = 3.2 + lv * 0.35;
    const orb = part(geo.ico(0.28, 0), mat(0xecfeff, { emissive: 0x22d3ee, emissiveIntensity: 2.4 }), turret, 0, 0, 0);
    orb.castShadow = false;
    spin = orb;
    turret.add(muzzle);
  }
  const rangeRing = new THREE.Mesh(geo.ring(0.97, 1, 64), basicMat(0x67e8f9, 0.55, true));
  rangeRing.position.y = 0.08;
  rangeRing.visible = false;
  root.add(rangeRing);
  return { root, turret, muzzle, spin, rangeRing };
}

/* ── Kristall, Bauplatz, Portal, Falle ─────────────────────── */
export interface CrystalRig {
  root: THREE.Group;
  core: THREE.Mesh;
  shards: THREE.Group;
  light: THREE.PointLight;
}

export function createCrystal(): CrystalRig {
  const root = new THREE.Group();
  const stone = mat(0x64748b);
  const rune = mat(0x0e7490, { emissive: 0x22d3ee, emissiveIntensity: 1.2 });
  part(geo.cyl(3, 3.4, 0.5, 8), stone, root, 0, 0.25, 0);
  part(geo.cyl(2.2, 2.6, 0.5, 8), mat(0x475569), root, 0, 0.75, 0);
  part(geo.torus(2.45, 0.06, 4, 32), rune, root, 0, 0.52, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    part(geo.box(0.35, 2.4, 0.35), stone, root, Math.cos(a) * 2.6, 1.2, Math.sin(a) * 2.6);
    part(geo.oct(0.2), rune, root, Math.cos(a) * 2.6, 2.6, Math.sin(a) * 2.6);
  }
  const core = part(geo.oct(1.1), mat(0xa5f3fc, { emissive: 0x06b6d4, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1 }), root, 0, 3.2, 0);
  core.scale.set(1, 1.8, 1);
  const shards = pivot(root, 0, 3.2, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = part(geo.oct(0.28), mat(0xc4b5fd, { emissive: 0x8b5cf6, emissiveIntensity: 1.8 }), shards, Math.cos(a) * 2, (i % 2) * 0.6 - 0.3, Math.sin(a) * 2);
    s.scale.y = 1.6;
    s.castShadow = false;
  }
  const light = new THREE.PointLight(0x22d3ee, 18, 22, 1.6);
  light.position.set(0, 3.4, 0);
  root.add(light);
  return { root, core, shards, light };
}

export interface PadRig {
  root: THREE.Group;
  rune: THREE.Mesh;
  runeMat: THREE.MeshStandardMaterial;
}

export function createPad(): PadRig {
  const root = new THREE.Group();
  const base = part(geo.cyl(1.7, 1.85, 0.3, 6), mat(0x78716c), root, 0, 0.15, 0);
  base.receiveShadow = true;
  part(geo.cyl(1.35, 1.35, 0.06, 6), mat(0x57534e), root, 0, 0.32, 0);
  const runeMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x2dd4bf, emissiveIntensity: 0.35, flatShading: true });
  const rune = part(geo.torus(1.05, 0.05, 3, 6), runeMat, root, 0, 0.36, 0, Math.PI / 2);
  rune.castShadow = false;
  return { root, rune, runeMat };
}

export function createPortal(color = 0x9333ea): { root: THREE.Group; swirl: THREE.Mesh } {
  const root = new THREE.Group();
  const stone = mat(0x44403c);
  part(geo.box(0.7, 4.2, 0.7), stone, root, -2.2, 2.1, 0);
  part(geo.box(0.7, 4.2, 0.7), stone, root, 2.2, 2.1, 0);
  part(geo.box(5.2, 0.7, 0.8), stone, root, 0, 4.4, 0);
  part(geo.oct(0.3), mat(color, { emissive: color, emissiveIntensity: 2 }), root, 0, 4.9, 0);
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  swirl.position.y = 2.1;
  swirl.scale.y = 1.05;
  root.add(swirl);
  const glow = new THREE.PointLight(color, 10, 12, 1.8);
  glow.position.y = 2.2;
  root.add(glow);
  return { root, swirl };
}

export function createTrap(): THREE.Group {
  const root = new THREE.Group();
  part(geo.cyl(0.8, 0.85, 0.12, 8), mat(0x52525b, { metalness: 0.6 }), root, 0, 0.06, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(geo.cone(0.08, 0.4, 4), mat(0xa1a1aa, { metalness: 0.7 }), root, Math.cos(a) * 0.6, 0.25, Math.sin(a) * 0.6, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  part(geo.ico(0.15), mat(0x86efac, { emissive: 0x22c55e, emissiveIntensity: 2 }), root, 0, 0.2, 0);
  return root;
}
