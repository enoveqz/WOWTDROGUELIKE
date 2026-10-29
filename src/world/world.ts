import * as THREE from 'three';
import { BIOMES, type BiomeDef, type DecorSpec } from '../config/biomes.ts';
import type { LevelDef } from '../config/levels.ts';
import { clamp, distToPolyline, type Vec2 } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import type { Quality } from '../meta/save.ts';
import { geo, mat } from './assets.ts';
import { createCrystal, createPad, createPortal, type CrystalRig, type PadRig } from './models.ts';
import { smoothstep, ValueNoise } from './noise.ts';

export interface Collider {
  x: number;
  z: number;
  r: number;
}

export const MAP_HALF = 38;
const TERRAIN_SIZE = 150;
const GRID_RES = 1;
const GRID_N = TERRAIN_SIZE / GRID_RES + 1;

/**
 * Baut die Low-Poly-Spielwelt eines Levels: Gelände, Pfade, Dekoration,
 * Bauplätze, Kristall, Portale, Licht, Himmel und Wetterpartikel.
 */
export class World {
  readonly group = new THREE.Group();
  readonly level: LevelDef;
  readonly biome: BiomeDef;
  readonly colliders: Collider[] = [];
  readonly pads: PadRig[] = [];
  crystal!: CrystalRig;
  portals: { root: THREE.Group; swirl: THREE.Mesh }[] = [];
  sun!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  private heights = new Float32Array(GRID_N * GRID_N);
  private noise: ValueNoise;
  private pools: { x: number; z: number; r: number }[] = [];
  private grid = new Map<number, Collider[]>();
  private weather!: THREE.Points;
  private weatherVel!: Float32Array;
  private lavaMats: THREE.MeshStandardMaterial[] = [];
  private time = 0;

  constructor(level: LevelDef, quality: Quality) {
    this.level = level;
    this.biome = BIOMES[level.biome];
    this.noise = new ValueNoise(hashString(level.id));
    const rng = new Rng(hashString(level.id) ^ 0x51ed);
    this.planPools(rng);
    this.buildHeightfield();
    this.buildTerrain();
    this.buildSky();
    this.buildLights(quality);
    this.buildPaths();
    this.buildPools();
    this.buildDecor(rng, quality);
    this.buildPads();
    this.buildCrystal();
    this.buildPortals();
    this.buildWeather(quality);
    this.indexColliders();
  }

  /* ── Höhe & Kollision ─────────────────────────────────────── */
  private rawHeight(x: number, z: number): number {
    const n = this.noise.fbm(x * 0.045, z * 0.045, 4);
    let h = (n - 0.45) * 2.2;
    // Kartenränder steigen zu Hügeln/Klippen an
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const rise = smoothstep(MAP_HALF - 4, MAP_HALF + 14, edge);
    h += rise * (9 + this.noise.fbm(x * 0.09 + 30, z * 0.09, 3) * 10);
    if (this.biome.id === 'volcano') h += rise * 4;
    // Pfade, Bauplätze, Kristall und Start werden eingeebnet
    let flat = 0;
    for (const path of this.level.paths) {
      const d = distToPolyline(x, z, path);
      flat = Math.max(flat, 1 - smoothstep(3.2, 6.5, d));
    }
    for (const p of this.level.pads) flat = Math.max(flat, 1 - smoothstep(2.2, 3.6, Math.hypot(x - p.x, z - p.z)));
    const c = this.level.crystal;
    flat = Math.max(flat, 1 - smoothstep(4.5, 8, Math.hypot(x - c.x, z - c.z)));
    h = h * (1 - flat) + 0 * flat;
    for (const pool of this.pools) {
      const d = Math.hypot(x - pool.x, z - pool.z);
      h -= (1 - smoothstep(pool.r * 0.6, pool.r * 1.15, d)) * 1.1;
    }
    return h;
  }

  private buildHeightfield(): void {
    const half = TERRAIN_SIZE / 2;
    for (let iz = 0; iz < GRID_N; iz++) {
      for (let ix = 0; ix < GRID_N; ix++) {
        this.heights[iz * GRID_N + ix] = this.rawHeight(ix * GRID_RES - half, iz * GRID_RES - half);
      }
    }
  }

  /** Bilinear interpolierte Geländehöhe – günstig genug für jeden Frame. */
  heightAt(x: number, z: number): number {
    const half = TERRAIN_SIZE / 2;
    const fx = clamp((x + half) / GRID_RES, 0, GRID_N - 1.001);
    const fz = clamp((z + half) / GRID_RES, 0, GRID_N - 1.001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h00 = this.heights[iz * GRID_N + ix];
    const h10 = this.heights[iz * GRID_N + ix + 1];
    const h01 = this.heights[(iz + 1) * GRID_N + ix];
    const h11 = this.heights[(iz + 1) * GRID_N + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  private indexColliders(): void {
    for (const c of this.colliders) {
      const key = cellKey(Math.floor(c.x / 4), Math.floor(c.z / 4));
      let arr = this.grid.get(key);
      if (!arr) this.grid.set(key, (arr = []));
      arr.push(c);
    }
  }

  addCollider(c: Collider): void {
    this.colliders.push(c);
    const key = cellKey(Math.floor(c.x / 4), Math.floor(c.z / 4));
    let arr = this.grid.get(key);
    if (!arr) this.grid.set(key, (arr = []));
    arr.push(c);
  }

  removeCollider(c: Collider): void {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
    const arr = this.grid.get(cellKey(Math.floor(c.x / 4), Math.floor(c.z / 4)));
    if (arr) {
      const j = arr.indexOf(c);
      if (j >= 0) arr.splice(j, 1);
    }
  }

  /**
   * Schiebt einen Kreis (x,z,r) aus Hindernissen und Kartenrändern heraus.
   * Wird für Held, Reittier, Begleiter und Gegner verwendet – nichts läuft
   * durch Bäume, Felsen, Türme oder den Kristall.
   */
  resolve(pos: { x: number; z: number }, r: number): boolean {
    let hit = false;
    const cx = Math.floor(pos.x / 4);
    const cz = Math.floor(pos.z / 4);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const arr = this.grid.get(cellKey(gx, gz));
        if (!arr) continue;
        for (const c of arr) {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const min = c.r + r;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.0001;
            const push = min - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
            hit = true;
          }
        }
      }
    }
    const lim = MAP_HALF - 1;
    if (pos.x < -lim) ((pos.x = -lim), (hit = true));
    if (pos.x > lim) ((pos.x = lim), (hit = true));
    if (pos.z < -lim - 1) ((pos.z = -lim - 1), (hit = true));
    if (pos.z > lim + 1) ((pos.z = lim + 1), (hit = true));
    return hit;
  }

  /* ── Aufbau ───────────────────────────────────────────────── */
  private planPools(rng: Rng): void {
    if (!this.biome.pool) return;
    let tries = 0;
    while (this.pools.length < 3 && tries++ < 200) {
      const x = rng.range(-30, 30);
      const z = rng.range(-30, 30);
      const r = rng.range(2.6, 4.2);
      if (this.minPathDist(x, z) < r + 5) continue;
      if (this.level.pads.some((p) => Math.hypot(p.x - x, p.z - z) < r + 4)) continue;
      if (Math.hypot(this.level.crystal.x - x, this.level.crystal.z - z) < r + 9) continue;
      if (this.pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 4)) continue;
      this.pools.push({ x, z, r });
    }
  }

  private minPathDist(x: number, z: number): number {
    let d = Infinity;
    for (const p of this.level.paths) d = Math.min(d, distToPolyline(x, z, p));
    return d;
  }

  private buildTerrain(): void {
    const seg = 150;
    let g: THREE.BufferGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const jitter = (this.noise.noise(x * 1.7, z * 1.7) - 0.5) * 0.18;
      pos.setY(i, this.heightAt(x, z) + jitter);
    }
    g = g.toNonIndexed();
    const p2 = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(p2.count * 3);
    const low = new THREE.Color(this.biome.groundLow);
    const high = new THREE.Color(this.biome.groundHigh);
    const path = new THREE.Color(this.biome.pathColor);
    const edge = new THREE.Color(this.biome.pathEdge);
    const cliff = new THREE.Color(this.biome.cliff);
    const c = new THREE.Color();
    for (let i = 0; i < p2.count; i += 3) {
      const x = (p2.getX(i) + p2.getX(i + 1) + p2.getX(i + 2)) / 3;
      const z = (p2.getZ(i) + p2.getZ(i + 1) + p2.getZ(i + 2)) / 3;
      const y = (p2.getY(i) + p2.getY(i + 1) + p2.getY(i + 2)) / 3;
      const n = this.noise.noise(x * 0.35, z * 0.35);
      c.copy(low).lerp(high, clamp(n * 0.9 + y * 0.05, 0, 1));
      const d = this.minPathDist(x, z);
      if (d < 2.4) c.copy(path).lerp(edge, n * 0.35);
      else if (d < 3.1) c.lerp(edge, 0.6);
      if (y > 2.2) c.lerp(cliff, clamp((y - 2.2) / 4, 0, 0.85));
      for (const pool of this.pools) {
        if (Math.hypot(x - pool.x, z - pool.z) < pool.r + 0.8) c.lerp(edge, 0.5);
      }
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = c.r;
        colors[(i + k) * 3 + 1] = c.g;
        colors[(i + k) * 3 + 2] = c.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.group.add(mesh);
  }

  private buildSky(): void {
    const g = new THREE.SphereGeometry(320, 24, 12);
    const top = new THREE.Color(this.biome.skyTop);
    const bottom = new THREE.Color(this.biome.skyBottom);
    const colors: number[] = [];
    const pos = g.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getY(i) / 320 + 0.15, 0, 1);
      c.copy(bottom).lerp(top, Math.pow(t, 0.7));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.name = 'sky';
    sky.renderOrder = -10;
    this.group.add(sky);
  }

  private buildLights(quality: Quality): void {
    this.hemi = new THREE.HemisphereLight(this.biome.hemiSky, this.biome.hemiGround, 1.15);
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(this.biome.sun, this.biome.sunIntensity);
    this.sun.position.set(-30, 55, 25);
    this.sun.target.position.set(0, 0, 0);
    this.sun.castShadow = quality !== 'low';
    const size = quality === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(size, size);
    const s = 48;
    Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: 160 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.group.add(this.sun, this.sun.target);
    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    this.group.add(amb);
  }

  private buildPaths(): void {
    // Leuchtende Wegsteine markieren die Gegnerrouten in regelmäßigen Abständen.
    const m = mat(0x334155, { emissive: this.biome.id === 'volcano' ? 0xff6a00 : 0x7c3aed, emissiveIntensity: 0.9 });
    for (const path of this.level.paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const steps = Math.floor(len / 6);
        for (let s = 1; s <= steps; s++) {
          const t = s / (steps + 1);
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const nx = -(b.z - a.z) / len;
          const nz = (b.x - a.x) / len;
          for (const side of [-1, 1]) {
            const px = x + nx * 3 * side;
            const pz = z + nz * 3 * side;
            const stone = new THREE.Mesh(geo.box(0.25, 0.35, 0.25), m);
            stone.position.set(px, this.heightAt(px, pz) + 0.15, pz);
            this.group.add(stone);
          }
        }
      }
    }
  }

  private buildPools(): void {
    const pool = this.biome.pool;
    if (!pool) return;
    for (const p of this.pools) {
      const m = new THREE.MeshStandardMaterial({
        color: pool.color,
        emissive: pool.emissive,
        emissiveIntensity: pool.kind === 'lava' ? 1.4 : 0.35,
        roughness: pool.kind === 'ice' ? 0.15 : 0.25,
        metalness: 0.1,
        transparent: pool.kind === 'water',
        opacity: pool.kind === 'water' ? 0.85 : 1,
        flatShading: true,
      });
      if (pool.kind === 'lava') this.lavaMats.push(m);
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(p.r * 1.05, 14), m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, -0.55, p.z);
      this.group.add(mesh);
      this.addColliderRaw({ x: p.x, z: p.z, r: p.r * 0.85 });
      if (pool.kind === 'lava') {
        const light = new THREE.PointLight(0xff5a1a, 8, 14, 1.8);
        light.position.set(p.x, 1.5, p.z);
        this.group.add(light);
      }
    }
  }

  private addColliderRaw(c: Collider): void {
    this.colliders.push(c);
  }

  private buildDecor(rng: Rng, quality: Quality): void {
    const density = quality === 'low' ? 0.55 : quality === 'medium' ? 0.8 : 1;
    const dummy = new THREE.Object3D();
    const occupied: Collider[] = [];
    for (const spec of this.biome.decor) {
      const count = Math.floor(spec.count * density);
      const placements: { x: number; z: number; s: number; rot: number; color: number }[] = [];
      let tries = 0;
      while (placements.length < count && tries++ < count * 25) {
        // Dekoration bevorzugt die Ränder, damit das Spielfeld lesbar bleibt
        const edgeBias = rng.next() < 0.55;
        const x = edgeBias ? rng.pick([-1, 1]) * rng.range(28, 52) : rng.range(-52, 52);
        const z = edgeBias ? rng.range(-52, 52) : rng.range(-52, 52);
        const [px, pz] = rng.chance(0.5) ? [x, z] : [z, x];
        if (!this.decorAllowed(px, pz, spec)) continue;
        if (occupied.some((o) => Math.hypot(o.x - px, o.z - pz) < o.r + 0.9)) continue;
        const s = rng.range(spec.scale[0], spec.scale[1]);
        placements.push({ x: px, z: pz, s, rot: rng.range(0, Math.PI * 2), color: rng.pick(spec.colors) });
        const r = colliderRadius(spec.type) * s;
        occupied.push({ x: px, z: pz, r });
        if (spec.solid && Math.abs(px) < MAP_HALF + 1 && Math.abs(pz) < MAP_HALF + 2) this.addColliderRaw({ x: px, z: pz, r });
      }
      this.instanceDecor(spec, placements, dummy, quality);
    }
  }

  private decorAllowed(x: number, z: number, spec: DecorSpec): boolean {
    const d = this.minPathDist(x, z);
    if (d < (spec.solid ? 5.5 : 3.5)) return false;
    if (this.level.pads.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) return false;
    const c = this.level.crystal;
    if (Math.hypot(c.x - x, c.z - z) < 9) return false;
    const s = this.level.playerStart;
    if (Math.hypot(s.x - x, s.z - z) < 4) return false;
    if (this.pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 1.5)) return false;
    if (Math.abs(x) > 70 || Math.abs(z) > 70) return false;
    return true;
  }

  private instanceDecor(spec: DecorSpec, places: { x: number; z: number; s: number; rot: number; color: number }[], dummy: THREE.Object3D, quality: Quality): void {
    if (places.length === 0) return;
    const parts = decorParts(spec.type);
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, emissive: p.emissive ?? 0, emissiveIntensity: p.emissive ? 1.6 : 1 }), places.length);
      im.castShadow = quality !== 'low' && p.shadow !== false;
      im.receiveShadow = false;
      const col = new THREE.Color();
      places.forEach((pl, i) => {
        const y = this.heightAt(pl.x, pl.z);
        dummy.position.set(pl.x + p.offset[0] * pl.s, y + p.offset[1] * pl.s, pl.z + p.offset[2] * pl.s);
        dummy.rotation.set(p.rot?.[0] ?? 0, pl.rot, p.rot?.[2] ?? 0);
        dummy.scale.setScalar(pl.s);
        if (p.scale) dummy.scale.set(pl.s * p.scale[0], pl.s * p.scale[1], pl.s * p.scale[2]);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        col.setHex(p.color ?? pl.color);
        if (!p.color) col.offsetHSL(0, 0, ((i * 7919) % 13) / 130 - 0.05);
        im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
    }
  }

  private buildPads(): void {
    for (const p of this.level.pads) {
      const pad = createPad();
      pad.root.position.set(p.x, this.heightAt(p.x, p.z), p.z);
      this.group.add(pad.root);
      this.pads.push(pad);
    }
  }

  private buildCrystal(): void {
    this.crystal = createCrystal();
    const c = this.level.crystal;
    this.crystal.root.position.set(c.x, this.heightAt(c.x, c.z), c.z);
    this.group.add(this.crystal.root);
    this.addColliderRaw({ x: c.x, z: c.z, r: 2.6 });
  }

  private buildPortals(): void {
    const color = this.biome.id === 'volcano' ? 0xf97316 : this.biome.id === 'snow' ? 0x60a5fa : 0x9333ea;
    for (const path of this.level.paths) {
      const a = path[0];
      const b = path[1];
      const portal = createPortal(color);
      portal.root.position.set(a.x, this.heightAt(a.x, a.z), a.z);
      portal.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      this.group.add(portal.root);
      this.portals.push(portal);
      const nx = Math.cos(portal.root.rotation.y);
      const nz = -Math.sin(portal.root.rotation.y);
      this.addColliderRaw({ x: a.x + nx * 2.2, z: a.z + nz * 2.2, r: 0.6 });
      this.addColliderRaw({ x: a.x - nx * 2.2, z: a.z - nz * 2.2, r: 0.6 });
    }
  }

  private buildWeather(quality: Quality): void {
    const n = quality === 'low' ? 250 : quality === 'medium' ? 500 : 900;
    const pos = new Float32Array(n * 3);
    this.weatherVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
      this.resetWeatherVel(i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const kind = this.biome.particle;
    const m = new THREE.PointsMaterial({
      color: this.biome.particleColor,
      size: kind === 'snow' ? 0.22 : kind === 'embers' ? 0.2 : kind === 'sand' ? 0.12 : 0.18,
      transparent: true,
      opacity: kind === 'sand' ? 0.55 : 0.85,
      depthWrite: false,
      blending: kind === 'embers' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.weather = new THREE.Points(g, m);
    this.weather.frustumCulled = false;
    this.group.add(this.weather);
  }

  private resetWeatherVel(i: number): void {
    const v = this.weatherVel;
    switch (this.biome.particle) {
      case 'snow':
        v[i * 3] = 0.4 + Math.random() * 0.6;
        v[i * 3 + 1] = -(1 + Math.random() * 1.2);
        v[i * 3 + 2] = Math.random() * 0.4;
        break;
      case 'sand':
        v[i * 3] = 5 + Math.random() * 4;
        v[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
        v[i * 3 + 2] = 1 + Math.random();
        break;
      case 'embers':
        v[i * 3] = (Math.random() - 0.5) * 0.6;
        v[i * 3 + 1] = 0.8 + Math.random() * 1.4;
        v[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        break;
      default:
        v[i * 3] = 0.6 + Math.random();
        v[i * 3 + 1] = -(0.4 + Math.random() * 0.5);
        v[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
  }

  setWeatherIntensity(mult: number): void {
    const m = this.weather.material as THREE.PointsMaterial;
    m.opacity = Math.min(1, (this.biome.particle === 'sand' ? 0.55 : 0.85) * mult);
  }

  /** Animiert Kristall, Portale, Lava und Wetter. */
  update(dt: number, focus: THREE.Vector3, weatherSpeed = 1): void {
    this.time += dt;
    const t = this.time;
    const cr = this.crystal;
    cr.core.rotation.y += dt * 0.6;
    cr.core.position.y = 3.2 + Math.sin(t * 1.4) * 0.18;
    cr.shards.rotation.y -= dt * 0.8;
    for (const p of this.portals) {
      p.swirl.rotation.z += dt * 1.5;
      (p.swirl.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 3) * 0.12;
    }
    for (const m of this.lavaMats) m.emissiveIntensity = 1.2 + Math.sin(t * 1.3) * 0.35;
    const pos = this.weather.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const v = this.weatherVel;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      arr[k] += v[k] * dt * weatherSpeed;
      arr[k + 1] += v[k + 1] * dt * weatherSpeed;
      arr[k + 2] += v[k + 2] * dt * weatherSpeed;
      if (this.biome.particle === 'leaves') arr[k] += Math.sin(t * 2 + i) * dt * 0.6;
      const dx = arr[k] - focus.x;
      const dz = arr[k + 2] - focus.z;
      if (arr[k + 1] < 0 || arr[k + 1] > 20 || Math.abs(dx) > 45 || Math.abs(dz) > 45) {
        arr[k] = focus.x + (Math.random() - 0.5) * 88;
        arr[k + 2] = focus.z + (Math.random() - 0.5) * 88;
        arr[k + 1] = this.biome.particle === 'embers' ? Math.random() * 2 : this.biome.particle === 'sand' ? Math.random() * 6 : 12 + Math.random() * 6;
      }
    }
    pos.needsUpdate = true;
  }

  setPadHighlight(on: boolean, hoverIndex = -1, occupied: boolean[] = []): void {
    this.pads.forEach((p, i) => {
      p.rune.visible = !occupied[i];
      p.runeMat.emissiveIntensity = !on ? 0.35 : i === hoverIndex ? 3.2 : 1.4 + Math.sin(this.time * 4) * 0.4;
    });
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Points).isPoints) {
        if (o.name === 'terrain' || o.name === 'sky' || o instanceof THREE.InstancedMesh || o instanceof THREE.Points) {
          m.geometry.dispose();
          const mm = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
          else mm.dispose();
        }
      }
    });
    for (const m of this.lavaMats) m.dispose();
  }

  /** Pfad als Liste von 3D-Punkten (für Minimap und Gegnerbewegung). */
  pathPoints(index: number): Vec2[] {
    return this.level.paths[index];
  }
}

function cellKey(x: number, z: number): number {
  return (x + 512) * 1024 + (z + 512);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colliderRadius(type: DecorSpec['type']): number {
  switch (type) {
    case 'tree':
    case 'pine':
    case 'snowpine':
      return 0.6;
    case 'rock':
    case 'lavarock':
      return 0.85;
    case 'cactus':
      return 0.45;
    case 'obelisk':
      return 0.9;
    case 'icecrystal':
      return 0.55;
    case 'deadtree':
      return 0.4;
    default:
      return 0.5;
  }
}

interface DecorPart {
  geo: THREE.BufferGeometry;
  offset: [number, number, number];
  color?: number;
  emissive?: number;
  scale?: [number, number, number];
  rot?: [number, number, number];
  shadow?: boolean;
}

function decorParts(type: DecorSpec['type']): DecorPart[] {
  switch (type) {
    case 'tree':
      return [
        { geo: new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5), offset: [0, 0.8, 0], color: 0x6b4423 },
        { geo: new THREE.IcosahedronGeometry(1.25, 0), offset: [0, 2.3, 0] },
        { geo: new THREE.IcosahedronGeometry(0.85, 0), offset: [0.35, 3.1, 0.15] },
      ];
    case 'pine':
      return [
        { geo: new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5), offset: [0, 0.6, 0], color: 0x5b3a22 },
        { geo: new THREE.ConeGeometry(1.25, 2.2, 6), offset: [0, 2.0, 0] },
        { geo: new THREE.ConeGeometry(0.9, 1.8, 6), offset: [0, 3.2, 0] },
      ];
    case 'snowpine':
      return [
        { geo: new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5), offset: [0, 0.6, 0], color: 0x5b3a22 },
        { geo: new THREE.ConeGeometry(1.3, 2.3, 6), offset: [0, 2.0, 0] },
        { geo: new THREE.ConeGeometry(0.95, 0.6, 6), offset: [0, 2.6, 0], color: 0xf8fafc },
        { geo: new THREE.ConeGeometry(0.9, 1.8, 6), offset: [0, 3.3, 0] },
        { geo: new THREE.ConeGeometry(0.5, 0.6, 6), offset: [0, 3.95, 0], color: 0xf8fafc },
      ];
    case 'bush':
      return [{ geo: new THREE.IcosahedronGeometry(0.7, 0), offset: [0, 0.45, 0], scale: [1.2, 0.8, 1.1] }];
    case 'rock':
      return [{ geo: new THREE.DodecahedronGeometry(0.9, 0), offset: [0, 0.35, 0], scale: [1.2, 0.8, 1] }];
    case 'lavarock':
      return [
        { geo: new THREE.DodecahedronGeometry(0.95, 0), offset: [0, 0.4, 0], scale: [1.1, 0.95, 1] },
        { geo: new THREE.BoxGeometry(0.12, 0.8, 0.12), offset: [0.4, 0.5, 0.65], color: 0xff6a1a, emissive: 0xff4500, shadow: false },
      ];
    case 'cactus':
      return [
        { geo: new THREE.CylinderGeometry(0.3, 0.35, 2.2, 6), offset: [0, 1.1, 0] },
        { geo: new THREE.CylinderGeometry(0.18, 0.2, 0.9, 6), offset: [0.45, 1.3, 0] },
        { geo: new THREE.CylinderGeometry(0.16, 0.18, 0.7, 6), offset: [-0.42, 1.0, 0] },
        { geo: new THREE.ConeGeometry(0.12, 0.2, 5), offset: [0, 2.3, 0], color: 0xf472b6, shadow: false },
      ];
    case 'deadtree':
      return [
        { geo: new THREE.CylinderGeometry(0.12, 0.25, 2.4, 5), offset: [0, 1.2, 0] },
        { geo: new THREE.CylinderGeometry(0.06, 0.1, 1.2, 4), offset: [0.4, 2.0, 0], rot: [0, 0, -0.8] },
        { geo: new THREE.CylinderGeometry(0.05, 0.09, 0.9, 4), offset: [-0.3, 1.6, 0], rot: [0, 0, 0.9] },
      ];
    case 'icecrystal':
      return [
        { geo: new THREE.OctahedronGeometry(0.6, 0), offset: [0, 0.9, 0], scale: [0.7, 2, 0.7], emissive: 0x0ea5e9, shadow: false },
        { geo: new THREE.OctahedronGeometry(0.4, 0), offset: [0.5, 0.5, 0.2], scale: [0.6, 1.6, 0.6], emissive: 0x0ea5e9, shadow: false },
      ];
    case 'obelisk':
      return [
        { geo: new THREE.CylinderGeometry(0.25, 0.7, 4, 4), offset: [0, 2, 0] },
        { geo: new THREE.OctahedronGeometry(0.3, 0), offset: [0, 4.3, 0], color: 0xfbbf24, emissive: 0xf59e0b, shadow: false },
      ];
    case 'mushroom':
      return [
        { geo: new THREE.CylinderGeometry(0.08, 0.1, 0.4, 5), offset: [0, 0.2, 0], color: 0xf5f5f4 },
        { geo: new THREE.ConeGeometry(0.3, 0.25, 7), offset: [0, 0.45, 0] },
      ];
    case 'bones':
    default:
      return [
        { geo: new THREE.BoxGeometry(0.9, 0.12, 0.12), offset: [0, 0.06, 0], shadow: false },
        { geo: new THREE.DodecahedronGeometry(0.22, 0), offset: [0.5, 0.15, 0.1], shadow: false },
      ];
  }
}
