import * as THREE from 'three';
import { clamp, damp } from '../core/math.ts';

/**
 * Third-Person-Verfolgerkamera mit fester Neigung (gute Übersicht über das
 * Schlachtfeld), Zoom per Mausrad und Drehen mit gedrückter rechter Maustaste.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  distance = 21;
  private pitch = 0.98;
  private target = new THREE.Vector3();
  private shakeT = 0;
  private shakeAmp = 0;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();
  shakeEnabled = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.5, 700);
  }

  snapTo(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.apply(0);
  }

  zoom(steps: number): void {
    this.distance = clamp(this.distance + steps * 2, 14, 36);
  }

  rotate(dx: number, sensitivity: number): void {
    this.yaw -= dx * 0.005 * sensitivity;
  }

  shake(amount: number, dur = 0.25): void {
    if (!this.shakeEnabled) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  update(dt: number, fx: number, fy: number, fz: number): void {
    this.target.x = damp(this.target.x, fx, 8, dt);
    this.target.y = damp(this.target.y, fy, 6, dt);
    this.target.z = damp(this.target.z, fz, 8, dt);
    this.apply(dt);
  }

  private apply(dt: number): void {
    const horiz = Math.cos(this.pitch) * this.distance;
    const h = Math.sin(this.pitch) * this.distance;
    this.camera.position.set(this.target.x - Math.sin(this.yaw) * horiz, this.target.y + h, this.target.z - Math.cos(this.yaw) * horiz);
    this.camera.lookAt(this.target.x, this.target.y + 1, this.target.z);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 4;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
  }

  /** Vorwärtsrichtung der Kamera auf der Bodenebene (für WASD). */
  forward(): { x: number; z: number } {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  /** Schnittpunkt des Mausstrahls mit dem Gelände (zwei Verfeinerungsschritte). */
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
      this.raycaster.ray.intersectPlane(this.plane, this.tmp);
    }
    out.copy(this.tmp);
    return out;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
