import { type Vec2, add, cross, dist, left, mul, sub, dot, norm } from "./vec";
import { type Segment, type Arc, arc, line, radius, tangentAt } from "./segment";
import type { Contour } from "./contour";

export class OffsetUnsupportedError extends Error {}

/**
 * Offset a contour by `d` mm to the LEFT of the direction of travel (negative = right).
 *
 * Analytic offset that keeps arcs as arcs (so G-code keeps G02/G03):
 *  - lines shift along their left normal, arcs change radius,
 *  - outside corners get a round join (arc around the original vertex),
 *  - inside corners are trimmed at the intersection of the neighbouring offsets.
 *
 * Not handled yet (throws OffsetUnsupportedError): segments that collapse or
 * self-intersections created by large offsets. Planned fallback: Clipper2 on the
 * tessellated polygon + arc refit. See docs/engineering/30-architecture.md.
 */
export function offsetContour(c: Contour, d: number): Contour {
  if (Math.abs(d) < 1e-12) return c;
  const off = c.segments.map((s) => offsetSeg(s, d));
  if (!c.closed && off.length === 1) return { ...c, segments: off };

  const out: Segment[] = [];
  const n = off.length;
  const joins = c.closed ? n : n - 1;
  const segs = off.map((s) => ({ ...s })) as Segment[];

  for (let i = 0; i < joins; i++) {
    const j = (i + 1) % n;
    const s0 = segs[i]!;
    const s1 = segs[j]!;
    if (dist(s0.b, s1.a) < 1e-7) continue;
    const vtx = c.segments[j]!.a;
    const turn = cross(tangentAt(c.segments[i]!, 1), tangentAt(c.segments[j]!, 0));
    if (turn * d < 0) {
      // gap on the offset side → round join, inserted after s0
      (s0 as Segment & { join?: Arc }).join = arc(s0.b, s1.a, vtx, turn > 0);
    } else {
      const p = intersectNear(s0, s1, vtx);
      if (!p) throw new OffsetUnsupportedError(`offset: no intersection at vertex ${i}`);
      s0.b = p;
      s1.a = p;
    }
  }
  for (const s of segs) {
    const j = (s as Segment & { join?: Arc }).join;
    delete (s as Segment & { join?: Arc }).join;
    out.push(s);
    if (j) out.push(j);
  }
  return { ...c, segments: out };
}

function offsetSeg(s: Segment, d: number): Segment {
  if (s.kind === "line") {
    const n = mul(left(norm(sub(s.b, s.a))), d);
    return line(add(s.a, n), add(s.b, n));
  }
  const r = radius(s);
  const nr = s.ccw ? r - d : r + d; // left of a CCW arc points to its centre
  if (nr <= 1e-6) throw new OffsetUnsupportedError(`offset: arc radius ${r.toFixed(3)} collapses`);
  const k = nr / r;
  const a = add(s.c, mul(sub(s.a, s.c), k));
  const b = add(s.c, mul(sub(s.b, s.c), k));
  return arc(a, b, s.c, s.ccw, s.full);
}

/** Intersection of the underlying curves of s0 and s1 closest to `near`. */
function intersectNear(s0: Segment, s1: Segment, near: Vec2): Vec2 | null {
  const cands = intersectCurves(s0, s1);
  if (!cands.length) return null;
  return cands.reduce((best, p) => (dist(p, near) < dist(best, near) ? p : best));
}

function intersectCurves(s0: Segment, s1: Segment): Vec2[] {
  if (s0.kind === "line" && s1.kind === "line") {
    const r = sub(s0.b, s0.a);
    const q = sub(s1.b, s1.a);
    const den = cross(r, q);
    if (Math.abs(den) < 1e-12) return [];
    const t = cross(sub(s1.a, s0.a), q) / den;
    return [add(s0.a, mul(r, t))];
  }
  if (s0.kind === "line" && s1.kind === "arc") return lineCircle(s0.a, s0.b, s1.c, radius(s1));
  if (s0.kind === "arc" && s1.kind === "line") return lineCircle(s1.a, s1.b, s0.c, radius(s0));
  const a0 = s0 as Arc;
  const a1 = s1 as Arc;
  return circleCircle(a0.c, radius(a0), a1.c, radius(a1));
}

function lineCircle(a: Vec2, b: Vec2, c: Vec2, r: number): Vec2[] {
  const dvec = sub(b, a);
  const f = sub(a, c);
  const A = dot(dvec, dvec);
  const B = 2 * dot(f, dvec);
  const C = dot(f, f) - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].map((t) => add(a, mul(dvec, t)));
}

function circleCircle(c0: Vec2, r0: number, c1: Vec2, r1: number): Vec2[] {
  const dd = dist(c0, c1);
  if (dd < 1e-12 || dd > r0 + r1 || dd < Math.abs(r0 - r1)) return [];
  const a = (r0 * r0 - r1 * r1 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const u = mul(sub(c1, c0), 1 / dd);
  const p = add(c0, mul(u, a));
  const n = left(u);
  return [add(p, mul(n, h)), add(p, mul(n, -h))];
}

