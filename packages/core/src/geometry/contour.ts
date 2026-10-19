import { type Vec2, EPS, cross, dist, sub, angleOf, dot } from "./vec";
import { type Segment, reverseSeg, segLength, splitSeg, sweep, radius, tessellate, distToSeg, tangentAt } from "./segment";

export interface Contour {
  id: string;
  segments: Segment[];
  closed: boolean;
  /** DXF layer name, used for layer → operation mapping. */
  layer?: string;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Translate every segment of a contour. */
export function translateContour(c: Contour, dx: number, dy: number): Contour {
  const t = (p: Vec2): Vec2 => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...c,
    segments: c.segments.map((s) => (s.kind === "line" ? { ...s, a: t(s.a), b: t(s.b) } : { ...s, a: t(s.a), b: t(s.b), c: t(s.c) })),
  };
}

export function contourLength(c: Contour): number {
  return c.segments.reduce((s, seg) => s + segLength(seg), 0);
}

export function startPoint(c: Contour): Vec2 {
  return c.segments[0]!.a;
}

/**
 * Signed area (positive = CCW). Exact for lines and arcs:
 * shoelace over endpoints plus the circular-segment area of each arc.
 */
export function signedArea(c: Contour): number {
  let a = 0;
  for (const s of c.segments) {
    a += cross(s.a, s.b) / 2;
    if (s.kind === "arc") {
      const r = radius(s);
      const th = sweep(s);
      a += (r * r * (th - Math.sin(th))) / 2;
    }
  }
  return a;
}

export const isCCW = (c: Contour): boolean => signedArea(c) > 0;

export function reverseContour(c: Contour): Contour {
  return { ...c, segments: c.segments.slice().reverse().map(reverseSeg) };
}

export function polygon(c: Contour, tol = 0.05): Vec2[] {
  const pts: Vec2[] = [];
  for (const s of c.segments) {
    const t = tessellate(s, tol);
    pts.push(...(pts.length ? t.slice(1) : t));
  }
  if (c.closed && pts.length > 1 && dist(pts[0]!, pts[pts.length - 1]!) < 1e-6) pts.pop();
  return pts;
}

export function bbox(c: Contour): BBox {
  const pts = polygon(c, 0.02);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

/** Even-odd point-in-polygon on the tessellated contour. */
export function containsPoint(c: Contour, p: Vec2): boolean {
  const pts = polygon(c);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToContour(c: Contour, p: Vec2): number {
  return Math.min(...c.segments.map((s) => distToSeg(p, s)));
}

/** A contour that is a single full circle, or two/more arcs sharing one centre and radius. */
export function asCircle(c: Contour): { center: Vec2; r: number } | null {
  if (!c.closed || c.segments.length === 0) return null;
  const first = c.segments[0]!;
  if (first.kind !== "arc") return null;
  const r = radius(first);
  for (const s of c.segments) {
    if (s.kind !== "arc" || dist(s.c, first.c) > 1e-4 || Math.abs(radius(s) - r) > 1e-4) return null;
  }
  return { center: first.c, r };
}

/**
 * Smallest characteristic size of a closed contour, used by the small-hole rule.
 * Circle → diameter. Otherwise the smaller bbox side (cheap proxy for inscribed width;
 * TODO: replace with true inscribed-circle diameter, see docs/product/12-synergy-rules.md).
 */
export function characteristicSize(c: Contour): number {
  const circ = asCircle(c);
  if (circ) return circ.r * 2;
  const b = bbox(c);
  return Math.min(b.maxX - b.minX, b.maxY - b.minY);
}

/** Rotate the start of a closed contour to segment index `i`, parameter `t`. */
export function rotateStart(c: Contour, i: number, t: number): Contour {
  if (!c.closed) throw new Error("rotateStart: open contour");
  const segs = c.segments;
  const s = segs[i]!;
  if (s.kind === "arc" && s.full) {
    const a0 = angleOf(sub(s.a, s.c)) + sweep(s) * t;
    const r = radius(s);
    const np = { x: s.c.x + r * Math.cos(a0), y: s.c.y + r * Math.sin(a0) };
    return { ...c, segments: [{ ...s, a: np, b: np }] };
  }
  if (t <= EPS) return { ...c, segments: [...segs.slice(i), ...segs.slice(0, i)] };
  if (t >= 1 - EPS) return rotateStart(c, (i + 1) % segs.length, 0);
  const [s1, s2] = splitSeg(s, t);
  return { ...c, segments: [s2, ...segs.slice(i + 1), ...segs.slice(0, i), s1] };
}

/** Corners: vertices between two segments with a direction change, with the turn angle (rad, 0 = straight). */
export function corners(c: Contour): { index: number; at: Vec2; turn: number }[] {
  const out: { index: number; at: Vec2; turn: number }[] = [];
  const n = c.segments.length;
  for (let i = 0; i < n; i++) {
    if (!c.closed && i === 0) continue;
    const prev = c.segments[(i - 1 + n) % n]!;
    const cur = c.segments[i]!;
    const t0 = tangentAt(prev, 1);
    const t1 = tangentAt(cur, 0);
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(t0, t1))));
    if (turn > 1e-3) out.push({ index: i, at: cur.a, turn });
  }
  return out;
}

