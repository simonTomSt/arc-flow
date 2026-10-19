import { type Vec2, EPS, add, angleOf, dist, len, mul, norm, polar, sub, left, right, dot } from "./vec";

/** Straight segment. */
export interface Line {
  kind: "line";
  a: Vec2;
  b: Vec2;
}

/**
 * Circular arc defined by its endpoints, centre and direction.
 * A full circle is represented as a single Arc with a === b and `full: true`.
 */
export interface Arc {
  kind: "arc";
  a: Vec2;
  b: Vec2;
  c: Vec2;
  ccw: boolean;
  full?: boolean;
}

export type Segment = Line | Arc;

export const line = (a: Vec2, b: Vec2): Line => ({ kind: "line", a, b });
export const arc = (a: Vec2, b: Vec2, c: Vec2, ccw: boolean, full = false): Arc =>
  full ? { kind: "arc", a, b, c, ccw, full } : { kind: "arc", a, b, c, ccw };

export const radius = (s: Arc): number => dist(s.a, s.c);

/** Signed sweep angle in radians (positive = CCW). Full circles return ±2π. */
export function sweep(s: Arc): number {
  if (s.full) return s.ccw ? 2 * Math.PI : -2 * Math.PI;
  let d = angleOf(sub(s.b, s.c)) - angleOf(sub(s.a, s.c));
  if (s.ccw) {
    while (d <= EPS) d += 2 * Math.PI;
  } else {
    while (d >= -EPS) d -= 2 * Math.PI;
  }
  return d;
}

export function segLength(s: Segment): number {
  return s.kind === "line" ? dist(s.a, s.b) : Math.abs(sweep(s)) * radius(s);
}

/** Unit tangent (direction of travel) at parameter t ∈ [0,1]. */
export function tangentAt(s: Segment, t: number): Vec2 {
  if (s.kind === "line") return norm(sub(s.b, s.a));
  const p = pointAt(s, t);
  const r = sub(p, s.c);
  return norm(s.ccw ? left(r) : right(r));
}

export function pointAt(s: Segment, t: number): Vec2 {
  if (s.kind === "line") return add(s.a, mul(sub(s.b, s.a), t));
  const a0 = angleOf(sub(s.a, s.c));
  return polar(s.c, radius(s), a0 + sweep(s) * t);
}

export function reverseSeg(s: Segment): Segment {
  if (s.kind === "line") return line(s.b, s.a);
  return arc(s.b, s.a, s.c, !s.ccw, s.full);
}

/** Split a segment at parameter t into two segments. */
export function splitSeg(s: Segment, t: number): [Segment, Segment] {
  const p = pointAt(s, t);
  if (s.kind === "line") return [line(s.a, p), line(p, s.b)];
  return [arc(s.a, p, s.c, s.ccw), arc(p, s.b, s.c, s.ccw)];
}

/** Polyline approximation with a maximum chord deviation `tol` (mm). Includes both endpoints. */
export function tessellate(s: Segment, tol = 0.05): Vec2[] {
  if (s.kind === "line") return [s.a, s.b];
  const r = radius(s);
  const sw = sweep(s);
  const step = r > tol ? 2 * Math.acos(1 - tol / r) : Math.PI / 4;
  const n = Math.max(2, Math.ceil(Math.abs(sw) / step));
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push(pointAt(s, i / n));
  return out;
}

/** Closest distance from point p to segment s. */
export function distToSeg(p: Vec2, s: Segment): number {
  if (s.kind === "line") {
    const d = sub(s.b, s.a);
    const l2 = dot(d, d);
    const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, dot(sub(p, s.a), d) / l2));
    return dist(p, add(s.a, mul(d, t)));
  }
  const r = radius(s);
  const rp = sub(p, s.c);
  if (s.full) return Math.abs(len(rp) - r);
  // Is the projection angle inside the sweep?
  const a0 = angleOf(sub(s.a, s.c));
  const sw = sweep(s);
  let d = angleOf(rp) - a0;
  if (sw > 0) {
    while (d < 0) d += 2 * Math.PI;
    if (d <= sw) return Math.abs(len(rp) - r);
  } else {
    while (d > 0) d -= 2 * Math.PI;
    if (d >= sw) return Math.abs(len(rp) - r);
  }
  return Math.min(dist(p, s.a), dist(p, s.b));
}
