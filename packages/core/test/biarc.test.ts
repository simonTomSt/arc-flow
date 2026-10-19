import { describe, expect, it } from "vitest";
import { fitBiarcs, type SampledCurve } from "../src/import/biarc";
import { bsplineCurve, ellipseCurve } from "../src/import/curves";
import { distToSeg } from "../src/geometry/segment";

function maxDeviation(curve: SampledCurve, segs: ReturnType<typeof fitBiarcs>, samples = 400): number {
  let worst = 0;
  for (let i = 0; i <= samples; i++) {
    const p = curve.point(i / samples);
    let best = Infinity;
    for (const s of segs) best = Math.min(best, distToSeg(p, s));
    if (best > worst) worst = best;
  }
  return worst;
}

describe("biarc fitting", () => {
  it("fits an ellipse within tolerance and emits only arcs", () => {
    const tol = 0.02;
    const curve = ellipseCurve({ x: 0, y: 0 }, { x: 30, y: 0 }, 0.6, 0, 2 * Math.PI);
    const segs = fitBiarcs(curve, tol);
    expect(segs.length).toBeGreaterThan(0);
    for (const s of segs) expect(s.kind).toBe("arc");
    expect(maxDeviation(curve, segs)).toBeLessThanOrEqual(tol);
  });

  it("fits a half-ellipse (open) within tolerance", () => {
    const tol = 0.01;
    const curve = ellipseCurve({ x: 10, y: 5 }, { x: 20, y: 0 }, 0.5, 0, Math.PI);
    const segs = fitBiarcs(curve, tol);
    expect(maxDeviation(curve, segs)).toBeLessThanOrEqual(tol);
  });

  it("fits a cubic B-spline (open uniform knots) within tolerance", () => {
    const tol = 0.05;
    const cps = [
      { x: 0, y: 0 },
      { x: 10, y: 30 },
      { x: 40, y: 30 },
      { x: 60, y: 0 },
      { x: 90, y: 50 },
    ];
    const degree = 3;
    // Clamped uniform knot vector for 5 control points, degree 3: n+p+2 = 9.
    const knots = [0, 0, 0, 0, 0.5, 1, 1, 1, 1];
    const curve = bsplineCurve(cps, knots, degree);
    const segs = fitBiarcs(curve, tol);
    expect(maxDeviation(curve, segs)).toBeLessThanOrEqual(tol);
  });

  it("tightens with smaller tolerance", () => {
    const curve = ellipseCurve({ x: 0, y: 0 }, { x: 50, y: 0 }, 0.3, 0, 2 * Math.PI);
    const a = fitBiarcs(curve, 0.1);
    const b = fitBiarcs(curve, 0.01);
    expect(b.length).toBeGreaterThan(a.length);
    expect(maxDeviation(curve, b)).toBeLessThanOrEqual(0.01);
  });
});
