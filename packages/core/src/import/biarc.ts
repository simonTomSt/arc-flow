import { type Vec2, EPS, add, cross, dist, dot, left, mul, norm, sub } from "../geometry/vec";
import { type Arc, type Segment, arc, line, distToSeg } from "../geometry/segment";

/**
 * Sampled curve to fit: a map from `t ∈ [0,1]` → position (and optionally tangent).
 * `tangent` must return a unit vector in the direction of travel.
 */
export interface SampledCurve {
  point(t: number): Vec2;
  tangent(t: number): Vec2;
}

/**
 * Fit a sampled curve with a chain of biarcs (and straight segments where a
 * biarc would be degenerate). The output has `tol` as the max deviation from
 * the sampled curve, measured as the maximum of chord distances at midpoints
 * of a dense resampling inside each span.
 */
export function fitBiarcs(curve: SampledCurve, tol: number): Segment[] {
  if (tol <= 0) throw new Error("fitBiarcs: tol must be positive");
  const out: Segment[] = [];
  // Depth-first subdivision; initial split into a handful of spans keeps
  // us from putting one biarc across inflection points.
  const stack: [number, number][] = [];
  const INITIAL = 8;
  for (let i = INITIAL - 1; i >= 0; i--) stack.push([i / INITIAL, (i + 1) / INITIAL]);
  const MAX_DEPTH = 24;
  const depth = new Map<string, number>();
  while (stack.length) {
    const [t0, t1] = stack.pop()!;
    const key = `${t0}:${t1}`;
    const dpth = depth.get(key) ?? 0;
    const span = fitSpan(curve, t0, t1);
    const err = span ? spanError(curve, t0, t1, span) : Infinity;
    if (span && err <= tol) {
      for (const s of span) out.push(s);
      continue;
    }
    if (dpth >= MAX_DEPTH) {
      // Fall back to a straight chord — guarantees termination.
      out.push(line(curve.point(t0), curve.point(t1)));
      continue;
    }
    const tm = (t0 + t1) / 2;
    const kR = `${tm}:${t1}`;
    const kL = `${t0}:${tm}`;
    depth.set(kR, dpth + 1);
    depth.set(kL, dpth + 1);
    stack.push([tm, t1]);
    stack.push([t0, tm]);
  }
  return out;
}

/** One or two segments covering [t0, t1], or null if fitting is degenerate. */
function fitSpan(curve: SampledCurve, t0: number, t1: number): Segment[] | null {
  const p0 = curve.point(t0);
  const p1 = curve.point(t1);
  const T0 = curve.tangent(t0);
  const T1 = curve.tangent(t1);
  if (dist(p0, p1) < EPS) return null;
  // Nearly straight → one line segment.
  const chord = norm(sub(p1, p0));
  if (dot(T0, chord) > 1 - 1e-7 && dot(T1, chord) > 1 - 1e-7) return [line(p0, p1)];
  // Parallel tangents special-case → equal arcs through the chord midpoint.
  if (Math.abs(cross(T0, T1)) < 1e-9 && dot(T0, T1) > 0) {
    const j = mul(add(p0, p1), 0.5);
    const a1 = arcFromPointTangent(p0, T0, j);
    const a2 = arcFromPointTangent(p1, mul(T1, -1), j);
    if (!a1 || !a2) return [line(p0, p1)];
    return [a1, reverseIfArc(a2)];
  }
  const v = sub(p1, p0);
  const Tsum = add(T0, T1);
  const Tdiff = sub(T0, T1);
  const denom = 2 * dot(v, Tsum);
  if (Math.abs(denom) < 1e-12) return null;
  const d = dot(v, v) / denom;
  const j = mul(add(add(p0, p1), mul(Tdiff, d)), 0.5);
  const first = arcFromPointTangent(p0, T0, j);
  // Second arc's tangent at J equals the first arc's tangent at J, which equals
  // the arc solution's natural direction. We can reuse arcFromPointTangent by
  // flipping P1 → J.
  const second = arcFromPointTangent(p1, mul(T1, -1), j);
  if (!first || !second) return null;
  // Reverse the second arc so it reads J → P1.
  return [first, reverseIfArc(second)];
}

function reverseIfArc(s: Segment): Segment {
  if (s.kind === "line") return line(s.b, s.a);
  const a: Arc = { kind: "arc", a: s.b, b: s.a, c: s.c, ccw: !s.ccw };
  if (s.full) a.full = true;
  return a;
}

/**
 * The unique circle (or line) through two points, tangent to `T` at `p`.
 * Returns a segment going from `p` to `q`.
 */
function arcFromPointTangent(p: Vec2, T: Vec2, q: Vec2): Segment | null {
  const v = sub(q, p);
  const L = dot(v, v);
  if (L < EPS) return null;
  // Signed component of v perpendicular to T.
  const perp = cross(T, v);
  if (Math.abs(perp) < 1e-10) return line(p, q);
  // Center lies on the normal to T at p, at distance r = L / (2 · perp).
  const n = left(T); // +90° of T
  const r = L / (2 * perp); // signed: positive = center on left (CCW arc)
  const c = add(p, mul(n, r));
  const ccw = r > 0;
  return arc(p, q, c, ccw);
}

function spanError(curve: SampledCurve, t0: number, t1: number, span: Segment[]): number {
  // Sample a handful of points inside the span and take their minimum distance
  // to any output segment. Cheap and tight enough for fitting control.
  const SAMPLES = 5;
  let maxErr = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = t0 + ((t1 - t0) * i) / (SAMPLES + 1);
    const pt = curve.point(t);
    let best = Infinity;
    for (const s of span) best = Math.min(best, distToSeg(pt, s));
    if (best > maxErr) maxErr = best;
  }
  return maxErr;
}
