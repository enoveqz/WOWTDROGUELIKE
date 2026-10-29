import * as THREE from 'three';
import { CLASSES, type ClassId } from '../config/classes.ts';
import { MOUNTS, type MountId } from '../config/mounts.ts';
import { RACES, type RaceId } from '../config/races.ts';
import { geo, mat } from '../world/assets.ts';
import { createCrystal, createHero, createMount, createPet, type HeroRig, type MountRig } from '../world/models.ts';

/**
 * 3D-Präsentationsbühne für Hauptmenü und Heldenwahl: Held, Reittier und
 * Aetherkristall auf einer schwebenden Insel mit langsam kreisender Kamera.
 */
export class Showcase {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private stage = new THREE.Group();
  private hero: HeroRig | null = null;
  private mount: MountRig | null = null;
  private pet: THREE.Group | null = null;
  private crystal = createCrystal();
  private particles: THREE.Points;
  private t = 0;
  private key = '';
  /** Horizontaler Versatz der Bühne (UI-Panels links/rechts). */
  offsetX = 0;
  focus: 'menu' | 'hero' = 'menu';

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 400);
    const s = this.scene;
    s.background = new THREE.Color(0x070b16);
    s.fog = new THREE.Fog(0x0b1224, 18, 60);
    s.add(new THREE.HemisphereLight(0x9ccfff, 0x1a1030, 1.1));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    s.add(key);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 1.6);
    rim.position.set(-8, 5, -6);
    s.add(rim);
    const fill = new THREE.PointLight(0x22d3ee, 14, 18, 1.6);
    fill.position.set(-3, 3, 4);
    s.add(fill);

    // Schwebende Insel
    const island = new THREE.Group();
    const top = new THREE.Mesh(geo.cyl(5, 4.4, 0.8, 9), mat(0x4d7c3a));
    top.position.y = -0.4;
    top.receiveShadow = true;
    island.add(top);
    const rock = new THREE.Mesh(geo.cone(4.4, 5.5, 9), mat(0x57534e));
    rock.rotation.x = Math.PI;
    rock.position.y = -3.55;
    island.add(rock);
    const ring = new THREE.Mesh(geo.torus(5.2, 0.05, 4, 48), mat(0x0e7490, { emissive: 0x22d3ee, emissiveIntensity: 1.5 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    island.add(ring);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const r = new THREE.Mesh(geo.dodec(0.3 + (i % 3) * 0.15), mat(0x78716c));
      r.position.set(Math.cos(a) * 4.1, 0.05, Math.sin(a) * 4.1);
      r.castShadow = true;
      island.add(r);
    }
    this.stage.add(island);
    this.crystal.root.scale.setScalar(0.55);
    this.crystal.root.position.set(-2.6, 0, -2.6);
    this.stage.add(this.crystal.root);
    s.add(this.stage);

    // Aetherpartikel
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 16 - 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(this.particles);
  }

  setSelection(race: RaceId, cls: ClassId, mount: MountId, showMount: boolean): void {
    const k = `${race}|${cls}|${mount}|${showMount}`;
    if (k === this.key) return;
    this.key = k;
    if (this.hero) this.stage.remove(this.hero.root);
    if (this.mount) this.stage.remove(this.mount.root);
    if (this.pet) this.stage.remove(this.pet);
    this.hero = createHero(RACES[race], CLASSES[cls]);
    this.hero.root.scale.setScalar(1.25);
    this.hero.root.position.set(0.8, 0, 0.8);
    this.hero.root.rotation.y = -0.35;
    this.stage.add(this.hero.root);
    this.mount = createMount(MOUNTS[mount]);
    this.mount.root.position.set(-1.4, 0, 1.2);
    this.mount.root.rotation.y = 0.9;
    this.mount.root.visible = showMount;
    this.mount.root.scale.setScalar(1.05);
    this.stage.add(this.mount.root);
    this.pet = null;
    if (cls === 'ranger') {
      const p = createPet();
      p.root.position.set(2.4, 0, 1.8);
      p.root.rotation.y = -0.6;
      this.pet = p.root;
      this.stage.add(p.root);
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const hero = this.focus === 'hero';
    const radius = hero ? 10.5 : 15;
    const a = t * 0.12 + 0.6;
    const lookY = hero ? 1.6 : 2.2;
    this.camera.position.set(Math.sin(a) * radius, hero ? 4 : 6.5, Math.cos(a) * radius);
    this.camera.lookAt(0, lookY, 0);
    // Bühne seitlich versetzen, damit UI-Panels sie nicht verdecken
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.stage.position.copy(right.multiplyScalar(-this.offsetX));
    this.stage.position.y = Math.sin(t * 0.8) * 0.15;
    this.crystal.core.rotation.y += dt * 0.6;
    this.crystal.shards.rotation.y -= dt * 0.8;
    this.crystal.core.position.y = 3.2 + Math.sin(t * 1.4) * 0.2;
    if (this.hero) {
      const h = this.hero;
      h.body.position.y = Math.sin(t * 2) * 0.02;
      h.armL.rotation.x = Math.sin(t * 2) * 0.06;
      h.armR.rotation.x = -0.3 + Math.sin(t * 2 + 1) * 0.06;
      h.head.rotation.y = Math.sin(t * 0.7) * 0.25;
      if (h.cape) h.cape.rotation.x = 0.12 + Math.sin(t * 1.7) * 0.06;
    }
    if (this.mount) {
      this.mount.head.rotation.x = Math.sin(t * 1.3) * 0.08;
      this.mount.tail.rotation.x = 0.2 + Math.sin(t * 2.5) * 0.15;
    }
    const arr = (this.particles.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += dt * 0.4;
      if (arr[i + 1] > 12) arr[i + 1] = -4;
    }
    (this.particles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
