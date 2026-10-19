import { type Vec2, norm, sub } from "../geometry/vec";
import type { SampledCurve } from "./biarc";

/**
 * Parametric ellipse arc. DXF ELLIPSE is specified by `center`, `major`
 * (vector from center to the end of the major axis), `axisRatio` (minor/major)
 * and start/end angles measured in the ellipse's local frame (CCW from +X).
 */
export function ellipseCurve(center: Vec2, major: Vec2, axisRatio: number, start: number, end: number): SampledCurve {
  const u = major;
  // v = major rotated +90° then scaled by axisRatio.
  const v = { x: -major.y * axisRatio, y: major.x * axisRatio };
  const sweep = end - start;
  return {
    point(t) {
      const a = start + sweep * t;
      return { x: center.x + u.x * Math.cos(a) + v.x * Math.sin(a), y: center.y + u.y * Math.cos(a) + v.y * Math.sin(a) };
    },
    tangent(t) {
      const a = start + sweep * t;
      // dP/dt = (dP/da)·sweep; direction is independent of magnitude, but keep the sign.
      const d: Vec2 = {
        x: (-u.x * Math.sin(a) + v.x * Math.cos(a)) * (sweep >= 0 ? 1 : -1),
        y: (-u.y * Math.sin(a) + v.y * Math.cos(a)) * (sweep >= 0 ? 1 : -1),
      };
      return norm(d);
    },
  };
}

/**
 * B-spline curve from control points and knots using De Boor's recursion.
 *
 * DXF SPLINE encodes a NURBS; for the plasma-import happy path we treat it
 * as a non-rational B-spline (ignoring per-point weights, which we don't get
 * from `dxf-parser` anyway). That is adequate for the splines produced by
 * every CAD we need to import.
 */
export function bsplineCurve(controlPoints: Vec2[], knots: number[], degree: number): SampledCurve {
  const n = controlPoints.length - 1;
  const p = degree;
  if (knots.length !== n + p + 2) {
    throw new Error(`bspline: expected ${n + p + 2} knots, got ${knots.length}`);
  }
  const u0 = knots[p]!;
  const u1 = knots[n + 1]!;
  return {
    point(t) {
      return deBoor(t * (u1 - u0) + u0, controlPoints, knots, p);
    },
    tangent(t) {
      // Central difference on the curve itself. The samples are safely in-range
      // because t ∈ [0,1] maps to u ∈ [u0, u1] and we clamp inside deBoor.
      const h = 1e-4;
      const t0 = Math.max(0, t - h);
      const t1 = Math.min(1, t + h);
      const a = deBoor(t0 * (u1 - u0) + u0, controlPoints, knots, p);
      const b = deBoor(t1 * (u1 - u0) + u0, controlPoints, knots, p);
      return norm(sub(b, a));
    },
  };
}

function deBoor(u: number, cps: Vec2[], knots: number[], p: number): Vec2 {
  const n = cps.length - 1;
  // Clamp to the valid parameter range.
  const uMin = knots[p]!;
  const uMax = knots[n + 1]!;
  if (u <= uMin) u = uMin;
  if (u >= uMax) u = uMax - 1e-12;
  // Find knot span index k such that knots[k] <= u < knots[k+1].
  let k = p;
  for (let i = p; i <= n; i++) {
    if (u >= knots[i]! && u < knots[i + 1]!) {
      k = i;
      break;
    }
  }
  // Local control points.
  const d: Vec2[] = [];
  for (let i = 0; i <= p; i++) d.push({ ...cps[k - p + i]! });
  for (let r = 1; r <= p; r++) {
    for (let i = p; i >= r; i--) {
      const left = knots[k - p + i]!;
      const right = knots[k + 1 + i - r]!;
      const alpha = right === left ? 0 : (u - left) / (right - left);
      d[i] = {
        x: (1 - alpha) * d[i - 1]!.x + alpha * d[i]!.x,
        y: (1 - alpha) * d[i - 1]!.y + alpha * d[i]!.y,
      };
    }
  }
  return d[p]!;
}
