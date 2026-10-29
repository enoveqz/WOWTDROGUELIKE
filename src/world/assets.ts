import * as THREE from 'three';

/**
 * Geteilte Geometrien und Materialien. Wiederkehrende Objekte (Gegner, Türme,
 * Projektile) nutzen dieselben Ressourcen – das spart Speicher und Draw-Setup.
 */
const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

export const geo = {
  box: (w: number, h: number, d: number) => cached(`box${r2(w)}|${r2(h)}|${r2(d)}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, seg = 6) =>
    cached(`cyl${r2(rt)}|${r2(rb)}|${r2(h)}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 6) => cached(`cone${r2(r)}|${r2(h)}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  ico: (r: number, detail = 0) => cached(`ico${r2(r)}|${detail}`, () => new THREE.IcosahedronGeometry(r, detail)),
  oct: (r: number) => cached(`oct${r2(r)}`, () => new THREE.OctahedronGeometry(r, 0)),
  dodec: (r: number) => cached(`dod${r2(r)}`, () => new THREE.DodecahedronGeometry(r, 0)),
  sphere: (r: number, w = 8, h = 6) => cached(`sph${r2(r)}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h)),
  torus: (r: number, t: number, rs = 6, ts = 16, arc = Math.PI * 2) =>
    cached(`tor${r2(r)}|${r2(t)}|${rs}|${ts}|${r2(arc)}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  ring: (ri: number, ro: number, seg = 40) =>
    cached(`ring${r2(ri)}|${r2(ro)}|${seg}`, () => {
      const g = new THREE.RingGeometry(ri, ro, seg);
      g.rotateX(-Math.PI / 2);
      return g;
    }),
  disc: (r: number, seg = 32) =>
    cached(`disc${r2(r)}|${seg}`, () => {
      const g = new THREE.CircleGeometry(r, seg);
      g.rotateX(-Math.PI / 2);
      return g;
    }),
  plane: (w: number, h: number) => cached(`pl${r2(w)}|${r2(h)}`, () => new THREE.PlaneGeometry(w, h)),
  wing: () =>
    cached('wing', () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(2.6, 0.6);
      shape.lineTo(2.2, -0.4);
      shape.lineTo(1.6, -0.2);
      shape.lineTo(1.2, -0.8);
      shape.lineTo(0.7, -0.3);
      shape.lineTo(0.2, -0.9);
      shape.lineTo(0, 0);
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      return g;
    }),
  cone3: (r: number, h: number) => cached(`cone3${r2(r)}|${r2(h)}`, () => new THREE.ConeGeometry(r, h, 3)),
};

export interface MatOpts {
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export function mat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.emissive ?? 0}|${o.emissiveIntensity ?? 1}|${o.roughness ?? 0.85}|${o.metalness ?? 0.05}|${o.transparent ? 1 : 0}|${o.opacity ?? 1}|${o.side ?? 0}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0.05,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}

export function basicMat(color: number, opacity = 1, additive = false): THREE.MeshBasicMaterial {
  const key = `basic|${color}|${opacity}|${additive}`;
  let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1 || additive,
      opacity,
      depthWrite: !(opacity < 1 || additive),
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    matCache.set(key, m);
  }
  return m;
}

/** Erzeugt ein Mesh mit Schattenwurf und hängt es optional an einen Elternknoten. */
export function part(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  parent: THREE.Object3D | null,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

export function pivot(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Ersetzt alle Materialien eines Modells durch Klone, damit dieses Modell
 * individuell aufleuchten kann (Treffer-Feedback), ohne andere zu beeinflussen.
 */
export function makeMaterialsUnique(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  const map = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.Material;
    if (!(m instanceof THREE.MeshStandardMaterial)) return;
    let c = map.get(m);
    if (!c) {
      c = m.clone();
      c.userData.baseEmissive = c.emissive.getHex();
      c.userData.baseIntensity = c.emissiveIntensity;
      map.set(m, c);
      out.push(c);
    }
    mesh.material = c;
  });
  return out;
}

export function setFlash(mats: THREE.MeshStandardMaterial[], amount: number, color = 0xffffff): void {
  for (const m of mats) {
    if (amount > 0.01) {
      m.emissive.setHex(color);
      m.emissiveIntensity = amount * 0.9;
    } else {
      m.emissive.setHex(m.userData.baseEmissive as number);
      m.emissiveIntensity = m.userData.baseIntensity as number;
    }
  }
}

export function tint(color: number, factor: number): number {
  const c = new THREE.Color(color);
  c.multiplyScalar(factor);
  return c.getHex();
}

export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
