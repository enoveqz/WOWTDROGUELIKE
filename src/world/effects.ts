import * as THREE from 'three';
import { basicMat, geo, mat } from './assets.ts';

/**
 * Effekt-Bibliothek mit Objekt-Pools: Partikel, Ringe, Warnmarkierungen,
 * Strahlen, Bodenzonen und Projektil-Meshes. Keine Objekterzeugung pro Frame.
 */
class ParticlePool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private base: Float32Array;
  private grav: Float32Array;
  private cursor = 0;
  private readonly max: number;

  constructor(max: number, size: number) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.grav = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, color: THREE.Color, speed: number, life: number, gravity: number, spreadY = 1): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const k = i * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
    const a = Math.random() * Math.PI * 2;
    const up = Math.random() * spreadY;
    const s = speed * (0.4 + Math.random() * 0.8);
    this.vel[k] = Math.cos(a) * s;
    this.vel[k + 1] = up * speed;
    this.vel[k + 2] = Math.sin(a) * s;
    this.base[k] = color.r;
    this.base[k + 1] = color.g;
    this.base[k + 2] = color.b;
    this.life[i] = life * (0.6 + Math.random() * 0.6);
    this.maxLife[i] = this.life[i];
    this.grav[i] = gravity;
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[k + 1] = -999;
        continue;
      }
      this.vel[k + 1] -= this.grav[i] * dt;
      this.vel[k] *= 1 - dt * 1.5;
      this.vel[k + 2] *= 1 - dt * 1.5;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.col[k] = this.base[k] * f;
      this.col[k + 1] = this.base[k + 1] * f;
      this.col[k + 2] = this.base[k + 2] * f;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Timed {
  obj: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  dur: number;
  kind: 'ring' | 'beam' | 'zone' | 'tele' | 'flash';
  r0: number;
  r1: number;
  opacity: number;
  fill?: THREE.Mesh;
  active: boolean;
  pulse?: boolean;
}

export type ProjectileKind = 'arrow' | 'bolt' | 'fireball' | 'spear' | 'orb' | 'arcane' | 'frost' | 'knife' | 'meteor';

export class Effects {
  readonly group = new THREE.Group();
  private sparks: ParticlePool;
  private puffs: ParticlePool;
  private timed: Timed[] = [];
  private freeRings: Timed[] = [];
  private freeBeams: Timed[] = [];
  private freeZones: Timed[] = [];
  private freeTele: Timed[] = [];
  private projPools = new Map<string, THREE.Mesh[]>();
  private tmpColor = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  particleScale = 1;

  constructor(particlesEnabled: boolean) {
    this.sparks = new ParticlePool(1400, 0.28);
    this.puffs = new ParticlePool(500, 0.7);
    this.group.add(this.sparks.points, this.puffs.points);
    this.particleScale = particlesEnabled ? 1 : 0.25;
  }

  burst(pos: THREE.Vector3 | { x: number; y: number; z: number }, color: number, count = 14, speed = 4, life = 0.6, gravity = 6): void {
    const n = Math.max(1, Math.round(count * this.particleScale));
    this.tmpColor.setHex(color);
    for (let i = 0; i < n; i++) this.sparks.emit(pos.x, pos.y, pos.z, this.tmpColor, speed, life, gravity);
  }

  puff(pos: { x: number; y: number; z: number }, color: number, count = 6, speed = 1.5, life = 0.9): void {
    const n = Math.max(1, Math.round(count * this.particleScale));
    this.tmpColor.setHex(color);
    for (let i = 0; i < n; i++) this.puffs.emit(pos.x, pos.y, pos.z, this.tmpColor, speed, life, -0.5, 0.6);
  }

  /** Einzelner Partikel ohne Streuung – z. B. für Projektilschweife. */
  trail(pos: THREE.Vector3, color: number): void {
    if (this.particleScale < 1 && Math.random() > this.particleScale) return;
    this.tmpColor.setHex(color);
    this.sparks.emit(pos.x, pos.y, pos.z, this.tmpColor, 0.4, 0.35, 0, 0.3);
  }

  /** Expandierender Ring auf dem Boden. */
  ring(x: number, y: number, z: number, radius: number, color: number, dur = 0.45, from = 0.2): void {
    let t = this.freeRings.pop();
    if (!t) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const obj = new THREE.Mesh(geo.ring(0.82, 1, 48), m);
      t = { obj, mat: m, t: 0, dur, kind: 'ring', r0: 0, r1: 0, opacity: 0.9, active: false };
      this.group.add(obj);
    }
    t.mat.color.setHex(color);
    t.obj.position.set(x, y + 0.12, z);
    t.t = 0;
    t.dur = dur;
    t.r0 = radius * from;
    t.r1 = radius;
    t.opacity = 0.9;
    t.active = true;
    t.obj.visible = true;
    this.timed.push(t);
  }

  /** Lichtstrahl zwischen zwei Punkten (Kettenblitz, Heilung, Laser). */
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, width = 0.12, dur = 0.22): void {
    let t = this.freeBeams.pop();
    if (!t) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const obj = new THREE.Mesh(geo.cyl(1, 1, 1, 4), m);
      t = { obj, mat: m, t: 0, dur, kind: 'beam', r0: width, r1: width, opacity: 1, active: false };
      this.group.add(obj);
    }
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    t.obj.position.copy(a).addScaledVector(dir, 0.5);
    t.obj.quaternion.setFromUnitVectors(this.up, dir.normalize());
    t.obj.scale.set(width, len, width);
    t.mat.color.setHex(color);
    t.t = 0;
    t.dur = dur;
    t.r0 = width;
    t.opacity = 1;
    t.active = true;
    t.obj.visible = true;
    this.timed.push(t);
  }

  /** Bodenzone (Rauch, Pfeilhagel, Wurzeln, Feuer). Rückgabe: Entfernen-Funktion. */
  zone(x: number, y: number, z: number, radius: number, color: number, dur: number, opacity = 0.35, pulse = true): () => void {
    let t = this.freeZones.pop();
    if (!t) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const obj = new THREE.Mesh(geo.disc(1, 40), m);
      t = { obj, mat: m, t: 0, dur, kind: 'zone', r0: radius, r1: radius, opacity, active: false };
      this.group.add(obj);
    }
    t.mat.color.setHex(color);
    t.obj.position.set(x, y + 0.1, z);
    t.obj.scale.setScalar(radius);
    t.t = 0;
    t.dur = dur;
    t.r0 = radius;
    t.opacity = opacity;
    t.pulse = pulse;
    t.active = true;
    t.obj.visible = true;
    this.timed.push(t);
    const ref = t;
    return () => {
      if (ref.active) ref.t = ref.dur;
    };
  }

  /** Warnmarkierung für Bossangriffe/Meteore: füllt sich bis zum Einschlag. */
  telegraph(x: number, y: number, z: number, radius: number, dur: number, color = 0xef4444, cone?: { dir: number; angle: number }): void {
    let t = this.freeTele.pop();
    if (!t) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const obj = new THREE.Mesh(geo.disc(1, 40), m);
      const fill = new THREE.Mesh(geo.disc(1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
      fill.position.y = 0.01;
      obj.add(fill);
      t = { obj, mat: m, t: 0, dur, kind: 'tele', r0: radius, r1: radius, opacity: 0.22, fill, active: false };
      this.group.add(obj);
    }
    const g = cone ? sectorGeo(cone.angle) : geo.disc(1, 40);
    t.obj.geometry = g;
    t.fill!.geometry = g;
    if (cone) t.obj.rotation.y = cone.dir;
    else t.obj.rotation.y = 0;
    t.mat.color.setHex(color);
    (t.fill!.material as THREE.MeshBasicMaterial).color.setHex(color);
    t.obj.position.set(x, y + 0.14, z);
    t.obj.scale.setScalar(radius);
    t.t = 0;
    t.dur = dur;
    t.opacity = 0.22;
    t.active = true;
    t.obj.visible = true;
    this.timed.push(t);
  }

  /** Projektil-Mesh aus dem Pool holen. */
  acquireProjectile(kind: ProjectileKind, color: number): THREE.Mesh {
    const key = `${kind}|${color}`;
    const pool = this.projPools.get(key);
    const m = pool?.pop();
    if (m) {
      m.visible = true;
      return m;
    }
    let mesh: THREE.Mesh;
    switch (kind) {
      case 'arrow':
        mesh = new THREE.Mesh(geo.box(0.06, 0.06, 0.9), mat(color, { emissive: color, emissiveIntensity: 0.6 }));
        break;
      case 'spear':
        mesh = new THREE.Mesh(geo.box(0.07, 0.07, 1.3), mat(0x6b4423));
        break;
      case 'knife':
        mesh = new THREE.Mesh(geo.box(0.04, 0.04, 0.5), basicMat(color, 1, true));
        break;
      case 'fireball':
        mesh = new THREE.Mesh(geo.ico(0.42, 1), basicMat(color, 1, true));
        break;
      case 'meteor':
        mesh = new THREE.Mesh(geo.dodec(0.9), mat(0x3f3a36, { emissive: 0xff4d00, emissiveIntensity: 1.6 }));
        break;
      case 'arcane':
        mesh = new THREE.Mesh(geo.oct(0.3), basicMat(color, 1, true));
        break;
      case 'frost':
        mesh = new THREE.Mesh(geo.oct(0.25), basicMat(color, 1, true));
        break;
      case 'orb':
      case 'bolt':
      default:
        mesh = new THREE.Mesh(geo.ico(0.22, 0), basicMat(color, 1, true));
    }
    mesh.userData.poolKey = key;
    this.group.add(mesh);
    return mesh;
  }

  releaseProjectile(mesh: THREE.Mesh): void {
    mesh.visible = false;
    const key = mesh.userData.poolKey as string;
    let pool = this.projPools.get(key);
    if (!pool) this.projPools.set(key, (pool = []));
    pool.push(mesh);
  }

  update(dt: number): void {
    this.sparks.update(dt);
    this.puffs.update(dt);
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const t = this.timed[i];
      t.t += dt;
      const f = Math.min(1, t.t / t.dur);
      switch (t.kind) {
        case 'ring': {
          const r = t.r0 + (t.r1 - t.r0) * (1 - Math.pow(1 - f, 3));
          t.obj.scale.setScalar(Math.max(0.01, r));
          t.mat.opacity = t.opacity * (1 - f);
          break;
        }
        case 'beam':
          t.mat.opacity = 1 - f;
          t.obj.scale.x = t.obj.scale.z = t.r0 * (1 - f * 0.6);
          break;
        case 'zone': {
          const fadeIn = Math.min(1, t.t / 0.2);
          const fadeOut = Math.min(1, (t.dur - t.t) / 0.4);
          const pulse = t.pulse ? 0.8 + Math.sin(t.t * 6) * 0.2 : 1;
          t.mat.opacity = t.opacity * Math.max(0, Math.min(fadeIn, fadeOut)) * pulse;
          break;
        }
        case 'tele': {
          t.mat.opacity = 0.18 + f * 0.12;
          t.fill!.scale.setScalar(Math.max(0.01, f));
          (t.fill!.material as THREE.MeshBasicMaterial).opacity = 0.25 + f * 0.35;
          break;
        }
        default:
          break;
      }
      if (t.t >= t.dur) {
        t.active = false;
        t.obj.visible = false;
        this.timed.splice(i, 1);
        if (t.kind === 'ring') this.freeRings.push(t);
        else if (t.kind === 'beam') this.freeBeams.push(t);
        else if (t.kind === 'zone') this.freeZones.push(t);
        else if (t.kind === 'tele') this.freeTele.push(t);
      }
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((o as THREE.Points).isPoints) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    for (const t of [...this.timed, ...this.freeRings, ...this.freeBeams, ...this.freeZones, ...this.freeTele]) t.mat.dispose();
  }
}

const sectorCache = new Map<number, THREE.BufferGeometry>();
function sectorGeo(angle: number): THREE.BufferGeometry {
  const key = Math.round(angle * 100);
  let g = sectorCache.get(key);
  if (!g) {
    // Sektor zentriert um +Z
    g = new THREE.CircleGeometry(1, 24, Math.PI / 2 - angle / 2, angle);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI);
    sectorCache.set(key, g);
  }
  return g;
}
