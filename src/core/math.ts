export interface Vec2 {
  x: number;
  z: number;
}

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

/** Kürzester Winkelabstand (Radiant) von a nach b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  return a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt));
}

/** Abstand eines Punktes zu einem Liniensegment (XZ-Ebene). */
export function distToSegment(px: number, pz: number, a: Vec2, b: Vec2): { d: number; t: number } {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz || 1e-6;
  const t = clamp(((px - a.x) * abx + (pz - a.z) * abz) / len2, 0, 1);
  const cx = a.x + abx * t;
  const cz = a.z + abz * t;
  return { d: Math.sqrt(dist2(px, pz, cx, cz)), t };
}

export function distToPolyline(px: number, pz: number, pts: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const { d } = distToSegment(px, pz, pts[i], pts[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

export function polylineLength(pts: readonly Vec2[]): number {
  let l = 0;
  for (let i = 0; i < pts.length - 1; i++) l += dist(pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
  return l;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)} %`;
}
