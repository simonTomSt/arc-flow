import DxfParser from "dxf-parser";
import { type Vec2, add, cross, dist, dot, left, mul, norm, sub, polar } from "../geometry/vec";
import { type Arc, type Segment, arc, line, radius, reverseSeg, segLength, sweep } from "../geometry/segment";
import { bbox, type Contour } from "../geometry/contour";
import { fitBiarcs } from "./biarc";
import { bsplineCurve, ellipseCurve } from "./curves";

export type Units = "mm" | "inch" | "unknown";

export interface ImportReport {
  units: Units;
  /** Endpoint gaps closed within tolerance (spec §4.1: "Naprawiono 12 przerw"). */
  gapsFixed: number;
  duplicatesRemoved: number;
  openContours: number;
  closedContours: number;
  /** Entity types we skipped, e.g. { SPLINE: 2 }. SPLINE/ELLIPSE → biarc fitting is TODO. */
  unsupported: Record<string, number>;
  /** Human-readable warnings (suspicious scale, unsupported entities...). */
  warnings: string[];
}

export interface ImportResult {
  contours: Contour[];
  report: ImportReport;
}

export interface ImportOptions {
  /** Endpoint join tolerance in mm. Spec default 0.01. */
  joinTolerance?: number;
  /** Biarc fitting tolerance for splines/ellipses in mm. Spec default 0.02. */
  biarcTolerance?: number;
  /** Sheet size in mm; used only to emit "part larger than sheet" warnings. */
  sheet?: { widthMm: number; heightMm: number };
}

interface RawSeg {
  seg: Segment;
  layer: string;
}

/** Parse DXF text → cleaned contours + import report. */
export function importDxf(text: string, opts: ImportOptions = {}): ImportResult {
  const parsed = new DxfParser().parseSync(text) as unknown as ParsedDxf | null;
  if (!parsed) throw new Error("DXF: parse failed");
  const units = unitsOf(parsed);
  const scale = units === "inch" ? 25.4 : 1;
  const unsupported: Record<string, number> = {};
  const raw = entitiesToSegments(parsed.entities ?? [], unsupported, scale, opts.biarcTolerance ?? 0.02);
  const res = buildContours(raw, opts.joinTolerance ?? 0.01);
  const warnings: string[] = [];
  for (const [k, n] of Object.entries(unsupported)) warnings.push(`${n}× ${k} skipped (not supported yet)`);
  if (units === "unknown") warnings.push("DXF has no $INSUNITS; assuming millimetres");
  for (const w of scaleWarnings(res.contours, opts.sheet)) warnings.push(w);
  return { contours: res.contours, report: { ...res.report, units, unsupported, warnings } };
}

/**
 * Flag contours that look wrong for a plasma plate:
 *  - any contour larger than the active sheet (or 3 m if no sheet given),
 *  - any contour whose bbox is sub-millimetre (likely a wrong-unit DXF).
 * Spec §4.1 (`docs/source/plasma-cam-spec.pl.md`).
 */
export function scaleWarnings(contours: Contour[], sheet?: { widthMm: number; heightMm: number }): string[] {
  const warnings: string[] = [];
  const maxW = sheet?.widthMm ?? 3000;
  const maxH = sheet?.heightMm ?? 3000;
  let tooBig = 0;
  let tooSmall = 0;
  for (const c of contours) {
    if (c.segments.length === 0) continue;
    const b = bbox(c);
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (w > maxW || h > maxH) tooBig++;
    else if (Math.max(w, h) < 1) tooSmall++;
  }
  if (tooBig > 0) {
    const which = sheet ? "the sheet" : "3 m";
    warnings.push(`${tooBig} contour${tooBig > 1 ? "s" : ""} larger than ${which} — check units/scale`);
  }
  if (tooSmall > 0) {
    warnings.push(`${tooSmall} contour${tooSmall > 1 ? "s" : ""} smaller than 1 mm — check units/scale`);
  }
  return warnings;
}

interface ParsedDxf {
  header?: Record<string, unknown>;
  entities?: DxfEntity[];
}
interface DxfEntity {
  type: string;
  layer?: string;
  vertices?: { x: number; y: number; bulge?: number }[];
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  shape?: boolean;
  closed?: boolean;
  // SPLINE
  controlPoints?: { x: number; y: number }[];
  fitPoints?: { x: number; y: number }[];
  knotValues?: number[];
  degreeOfSplineCurve?: number;
  // ELLIPSE
  majorAxisEndPoint?: { x: number; y: number };
  axisRatio?: number;
}

function unitsOf(p: ParsedDxf): Units {
  const u = p.header?.["$INSUNITS"];
  if (u === 4) return "mm";
  if (u === 1) return "inch";
  return "unknown";
}

export function entitiesToSegments(ents: DxfEntity[], unsupported: Record<string, number>, scale = 1, biarcTol = 0.02): RawSeg[] {
  const out: RawSeg[] = [];
  const P = (p: { x: number; y: number }): Vec2 => ({ x: p.x * scale, y: p.y * scale });
  for (const e of ents) {
    const layer = e.layer ?? "0";
    switch (e.type) {
      case "LINE": {
        const [a, b] = e.vertices ?? [];
        if (a && b) out.push({ seg: line(P(a), P(b)), layer });
        break;
      }
      case "CIRCLE": {
        const c = P(e.center!);
        const r = e.radius! * scale;
        const p = { x: c.x + r, y: c.y };
        out.push({ seg: arc(p, p, c, true, true), layer });
        break;
      }
      case "ARC": {
        const c = P(e.center!);
        const r = e.radius! * scale;
        // dxf-parser returns angles in radians; DXF arcs are always CCW
        out.push({ seg: arc(polar(c, r, e.startAngle!), polar(c, r, e.endAngle!), c, true), layer });
        break;
      }
      case "ELLIPSE": {
        const c = P(e.center!);
        const major = { x: e.majorAxisEndPoint!.x * scale, y: e.majorAxisEndPoint!.y * scale };
        const ratio = e.axisRatio ?? 1;
        const start = e.startAngle ?? 0;
        const end = e.endAngle ?? Math.PI * 2;
        const curve = ellipseCurve(c, major, ratio, start, end);
        for (const s of fitBiarcs(curve, biarcTol)) out.push({ seg: s, layer });
        break;
      }
      case "SPLINE": {
        const cps = (e.controlPoints ?? []).map(P);
        const knots = e.knotValues ?? [];
        const degree = e.degreeOfSplineCurve ?? 3;
        if (cps.length >= degree + 1 && knots.length === cps.length + degree + 1) {
          try {
            const curve = bsplineCurve(cps, knots, degree);
            for (const s of fitBiarcs(curve, biarcTol)) out.push({ seg: s, layer });
          } catch {
            unsupported["SPLINE"] = (unsupported["SPLINE"] ?? 0) + 1;
          }
        } else if (cps.length >= 2) {
          // Degenerate (missing knots): fall back to a polyline through control points.
          for (let i = 0; i < cps.length - 1; i++) out.push({ seg: line(cps[i]!, cps[i + 1]!), layer });
        } else {
          unsupported["SPLINE"] = (unsupported["SPLINE"] ?? 0) + 1;
        }
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        const vs = e.vertices ?? [];
        const closed = Boolean(e.shape || e.closed);
        const n = closed ? vs.length : vs.length - 1;
        for (let i = 0; i < n; i++) {
          const v0 = vs[i]!;
          const v1 = vs[(i + 1) % vs.length]!;
          out.push({ seg: bulgeSeg(P(v0), P(v1), v0.bulge ?? 0), layer });
        }
        break;
      }
      default:
        unsupported[e.type] = (unsupported[e.type] ?? 0) + 1;
    }
  }
  return out;
}

/** Polyline vertex bulge → line or arc. bulge = tan(sweep/4), positive = CCW. */
export function bulgeSeg(a: Vec2, b: Vec2, bulge: number): Segment {
  if (Math.abs(bulge) < 1e-9) return line(a, b);
  const chord = dist(a, b);
  const mid = mul(add(a, b), 0.5);
  const h = ((chord / 2) * (1 - bulge * bulge)) / (2 * bulge);
  const c = add(mid, mul(left(norm(sub(b, a))), h));
  return arc(a, b, c, bulge > 0);
}

/** Dedupe + chain segments into contours, snapping endpoints within `tol`. */
export function buildContours(raw: RawSeg[], tol: number): { contours: Contour[]; report: Omit<ImportReport, "units" | "unsupported" | "warnings"> } {
  let duplicatesRemoved = 0;
  let gapsFixed = 0;
  const pool: RawSeg[] = [];
  // Zero-length cleanup — DXF export quirks sometimes leave L=0 segments.
  for (const r of raw) {
    if (segLength(r.seg) <= tol) {
      duplicatesRemoved++;
      continue;
    }
    // Try merging with an overlapping collinear/co-arc segment on the same layer.
    const mergeIdx = pool.findIndex((p) => p.layer === r.layer && canOverlapMerge(p.seg, r.seg, tol));
    if (mergeIdx >= 0) {
      const merged = overlapMerge(pool[mergeIdx]!.seg, r.seg, tol);
      if (merged) {
        pool[mergeIdx] = { seg: merged, layer: r.layer };
        duplicatesRemoved++;
        continue;
      }
    }
    if (pool.some((p) => sameSeg(p.seg, r.seg, tol))) duplicatesRemoved++;
    else pool.push(r);
  }

  const contours: Contour[] = [];
  let id = 1;
  const nextId = () => `c${id++}`;

  // Full circles are complete contours on their own.
  for (let i = pool.length - 1; i >= 0; i--) {
    const s = pool[i]!.seg;
    if (s.kind === "arc" && s.full) {
      contours.unshift({ id: "", segments: [s], closed: true, layer: pool[i]!.layer });
      pool.splice(i, 1);
    }
  }

  while (pool.length) {
    const first = pool.shift()!;
    const chain: Segment[] = [first.seg];
    let grew = true;
    while (grew) {
      grew = false;
      const end = chain[chain.length - 1]!.b;
      const start = chain[0]!.a;
      if (chain.length > 1 && dist(end, start) <= tol) break;
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i]!.seg;
        let pick: Segment | null = null;
        let atEnd = true;
        if (dist(s.a, end) <= tol) pick = s;
        else if (dist(s.b, end) <= tol) pick = reverseSeg(s);
        else if (dist(s.b, start) <= tol) (pick = s), (atEnd = false);
        else if (dist(s.a, start) <= tol) (pick = reverseSeg(s)), (atEnd = false);
        if (!pick) continue;
        pool.splice(i, 1);
        if (atEnd) {
          if (dist(pick.a, end) > 1e-9) gapsFixed++;
          chain.push({ ...pick, a: end });
        } else {
          if (dist(pick.b, start) > 1e-9) gapsFixed++;
          chain.unshift({ ...pick, b: start });
        }
        grew = true;
        break;
      }
    }
    const s0 = chain[0]!;
    const sN = chain[chain.length - 1]!;
    const closed = dist(sN.b, s0.a) <= tol;
    if (closed && dist(sN.b, s0.a) > 1e-9) {
      gapsFixed++;
      chain[chain.length - 1] = { ...sN, b: s0.a };
    }
    contours.push({ id: "", segments: fuseAdjacent(chain, tol), closed, layer: first.layer });
  }
  contours.forEach((c) => (c.id = nextId()));
  return {
    contours,
    report: {
      gapsFixed,
      duplicatesRemoved,
      openContours: contours.filter((c) => !c.closed).length,
      closedContours: contours.filter((c) => c.closed).length,
    },
  };
}

/**
 * Collapse adjacent collinear lines and co-circular arcs into a single
 * segment. Runs after chaining — fixes the "polyline with a stop in the
 * middle of a side" DXF pattern.
 */
export function fuseAdjacent(chain: Segment[], tol: number): Segment[] {
  if (chain.length < 2) return chain;
  const out: Segment[] = [chain[0]!];
  for (let i = 1; i < chain.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = chain[i]!;
    const fused = tryFuse(prev, cur, tol);
    if (fused) out[out.length - 1] = fused;
    else out.push(cur);
  }
  // One more pass across the seam when closed, done by callers via rotateStart.
  return out;
}

function tryFuse(a: Segment, b: Segment, tol: number): Segment | null {
  if (a.kind === "line" && b.kind === "line") {
    const da = norm(sub(a.b, a.a));
    const db = norm(sub(b.b, b.a));
    if (dot(da, db) > 1 - 1e-6 && Math.abs(cross(da, db)) < 1e-6 && dist(a.b, b.a) <= tol) {
      return line(a.a, b.b);
    }
    return null;
  }
  if (a.kind === "arc" && b.kind === "arc") {
    if (a.full || b.full) return null;
    if (a.ccw !== b.ccw) return null;
    if (dist(a.c, b.c) > tol) return null;
    if (Math.abs(radius(a) - radius(b)) > tol) return null;
    if (dist(a.b, b.a) > tol) return null;
    return arc(a.a, b.b, a.c, a.ccw);
  }
  return null;
}

function canOverlapMerge(p: Segment, q: Segment, tol: number): boolean {
  if (p.kind !== q.kind) return false;
  if (p.kind === "line" && q.kind === "line") return collinearOverlap(p.a, p.b, q.a, q.b, tol);
  if (p.kind === "arc" && q.kind === "arc") {
    if ((p.full ?? false) !== (q.full ?? false)) return false;
    if (dist(p.c, q.c) > tol) return false;
    if (Math.abs(radius(p) - radius(q)) > tol) return false;
    if (p.ccw !== q.ccw) return false;
    return arcAngleOverlap(p, q, tol);
  }
  return false;
}

function overlapMerge(p: Segment, q: Segment, tol: number): Segment | null {
  if (p.kind === "line" && q.kind === "line") {
    const d = norm(sub(p.b, p.a));
    // Project all four endpoints on direction d, pick the two extremes.
    const base = p.a;
    const ts: { t: number; pt: Vec2 }[] = [p.a, p.b, q.a, q.b].map((pt) => ({ t: dot(sub(pt, base), d), pt }));
    ts.sort((x, y) => x.t - y.t);
    void tol;
    return line(ts[0]!.pt, ts[ts.length - 1]!.pt);
  }
  if (p.kind === "arc" && q.kind === "arc") {
    // Convert each endpoint to an angle around the shared centre and take the
    // union of the two sweeps. Signed angles are measured in the arc's
    // direction (CCW positive, CW negative) from a0.
    const a = p;
    const a0 = Math.atan2(a.a.y - a.c.y, a.a.x - a.c.x);
    const r = radius(a);
    const toSigned = (pt: Vec2): number => {
      let d = Math.atan2(pt.y - a.c.y, pt.x - a.c.x) - a0;
      if (a.ccw) {
        while (d < -1e-9) d += 2 * Math.PI;
      } else {
        while (d > 1e-9) d -= 2 * Math.PI;
      }
      return d;
    };
    const pts = [a.a, a.b, q.a, q.b].map(toSigned);
    const lo = Math.min(...pts);
    const hi = Math.max(...pts);
    const pt = (ang: number): Vec2 => ({ x: a.c.x + r * Math.cos(a0 + ang), y: a.c.y + r * Math.sin(a0 + ang) });
    return arc(pt(lo), pt(hi), a.c, a.ccw);
  }
  return null;
}

function collinearOverlap(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2, tol: number): boolean {
  const da = sub(a1, a0);
  const L = Math.hypot(da.x, da.y);
  if (L < tol) return false;
  const u = { x: da.x / L, y: da.y / L };
  const perp = (p: Vec2) => Math.abs((p.x - a0.x) * -u.y + (p.y - a0.y) * u.x);
  if (perp(b0) > tol || perp(b1) > tol) return false;
  const t0 = (b0.x - a0.x) * u.x + (b0.y - a0.y) * u.y;
  const t1 = (b1.x - a0.x) * u.x + (b1.y - a0.y) * u.y;
  const [lo, hi] = t0 <= t1 ? [t0, t1] : [t1, t0];
  // Intervals [0, L] and [lo, hi] must overlap (not just touch at an endpoint).
  return hi > tol && lo < L - tol;
}

function arcAngleOverlap(a: Arc, b: Arc, tol: number): boolean {
  const a0 = Math.atan2(a.a.y - a.c.y, a.a.x - a.c.x);
  const r = radius(a);
  const toSigned = (pt: Vec2): number => {
    let d = Math.atan2(pt.y - a.c.y, pt.x - a.c.x) - a0;
    if (a.ccw) {
      while (d < -1e-9) d += 2 * Math.PI;
    } else {
      while (d > 1e-9) d -= 2 * Math.PI;
    }
    return d;
  };
  const sa = Math.abs(sweep(a));
  const bLo = toSigned(b.a);
  const bHi = toSigned(b.b);
  const [lo, hi] = bLo <= bHi ? [bLo, bHi] : [bHi, bLo];
  const chordTol = tol / Math.max(r, 1e-6);
  return Math.abs(hi) > chordTol && Math.abs(lo) < sa - chordTol;
}

function sameSeg(p: Segment, q: Segment, tol: number): boolean {
  if (p.kind !== q.kind) return false;
  const endsMatch = (dist(p.a, q.a) <= tol && dist(p.b, q.b) <= tol) || (dist(p.a, q.b) <= tol && dist(p.b, q.a) <= tol);
  if (!endsMatch) return false;
  if (p.kind === "arc" && q.kind === "arc") return dist(p.c, q.c) <= tol && (p.full ?? false) === (q.full ?? false);
  return true;
}
