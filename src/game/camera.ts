import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/math.ts';

/**
 * Verfolgerkamera hinter dem Helden (MMORPG-Stil): frei drehbar und neigbar
 * per Maus, Zoom per Mausrad, folgt beim Laufen sanft der Blickrichtung.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.78;
  distance = 20;
  private target = new THREE.Vector3();
  private shakeT = 0;
  private shakeAmp = 0;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  shakeEnabled = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.5, 700);
  }

  snapTo(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.apply(0);
  }

  zoom(steps: number): void {
    this.distance = clamp(this.distance + steps * 2, 7, 42);
  }

  /** Maus-Orbit: dx dreht, dy neigt. */
  orbit(dx: number, dy: number, sensitivity: number, invertY = false): void {
    this.yaw -= dx * 0.0055 * sensitivity;
    this.pitch = clamp(this.pitch + dy * 0.0045 * sensitivity * (invertY ? -1 : 1), 0.18, 1.38);
  }

  /** Kamera schwenkt sanft hinter die Figur (wie beim Laufen in MMORPGs). */
  followBehind(facing: number, dt: number, strength = 2.5): void {
    this.yaw = dampAngle(this.yaw, facing, strength, dt);
  }

  shake(amount: number, dur = 0.25): void {
    if (!this.shakeEnabled) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  update(dt: number, fx: number, fy: number, fz: number, groundAt?: (x: number, z: number) => number): void {
    this.target.x = damp(this.target.x, fx, 10, dt);
    this.target.y = damp(this.target.y, fy, 8, dt);
    this.target.z = damp(this.target.z, fz, 10, dt);
    this.apply(dt, groundAt);
  }

  private apply(dt: number, groundAt?: (x: number, z: number) => number): void {
    const horiz = Math.cos(this.pitch) * this.distance;
    const h = Math.sin(this.pitch) * this.distance;
    const lookY = this.target.y + 1.6;
    const cam = this.camera.position;
    cam.set(this.target.x - Math.sin(this.yaw) * horiz, lookY + h, this.target.z - Math.cos(this.yaw) * horiz);
    // Nicht unter das Gelände tauchen
    if (groundAt) {
      const g = groundAt(cam.x, cam.z) + 1.2;
      if (cam.y < g) cam.y = g;
    }
    this.camera.lookAt(this.target.x, lookY, this.target.z);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 4;
      cam.x += (Math.random() - 0.5) * a;
      cam.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
  }

  forward(): { x: number; z: number } {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  /** Bildschirmposition (NDC) eines Weltpunkts; z > 1 bedeutet hinter der Kamera. */
  project(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(x, y, z).project(this.camera);
  }

  /** Schnittpunkt eines Bildschirmpunkts mit dem Gelände. */
  groundPoint(ndcX: number, ndcY: number, heightAt: (x: number, z: number) => number, out: THREE.Vector3): THREE.Vector3 {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    this.plane.constant = 0;
    if (!this.raycaster.ray.intersectPlane(this.plane, this.tmp)) {
      out.set(this.target.x, 0, this.target.z);
      return out;
    }
    for (let i = 0; i < 2; i++) {
      const h = heightAt(this.tmp.x, this.tmp.z);
      this.plane.constant = -h;
      if (!this.raycaster.ray.intersectPlane(this.plane, this.tmp2)) break;
      this.tmp.copy(this.tmp2);
    }
    out.copy(this.tmp);
    return out;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
