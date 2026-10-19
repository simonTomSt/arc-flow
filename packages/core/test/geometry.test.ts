import { describe, expect, it } from "vitest";
import { signedArea, isCCW, reverseContour, offsetContour, bbox, rotateStart, contourLength, containsPoint } from "../src/geometry";
import { roundedRect, circle } from "../src/project/demo";
import { bulgeSeg, buildContours } from "../src/import/dxf";
import { line } from "../src/geometry/segment";

describe("contour area & orientation", () => {
  it("rounded rect area is exact (arcs included)", () => {
    const c = roundedRect("r", 0, 0, 160, 110, 10);
    const expected = 160 * 110 - (4 - Math.PI) * 100;
    expect(signedArea(c)).toBeCloseTo(expected, 6);
    expect(isCCW(c)).toBe(true);
    expect(isCCW(reverseContour(c))).toBe(false);
  });

  it("full circle area", () => {
    expect(signedArea(circle("c", 0, 0, 30))).toBeCloseTo(Math.PI * 225, 6);
  });
});

describe("offset keeps arcs", () => {
  it("square offset outward by 1 gets round corners", () => {
    const sq = roundedRect("s", 0, 0, 100, 50, 0); // CCW, left = inside
    const out = offsetContour(sq, -1); // right of CCW = outside
    const b = bbox(out);
    expect(b.minX).toBeCloseTo(-1, 3);
    expect(b.maxY).toBeCloseTo(51, 3);
    expect(out.segments.filter((s) => s.kind === "arc")).toHaveLength(4);
    expect(contourLength(out)).toBeCloseTo(300 + 2 * Math.PI, 3);
  });

  it("square offset inward trims corners", () => {
    const sq = roundedRect("s", 0, 0, 100, 50, 0);
    const inn = offsetContour(sq, 1);
    expect(bbox(inn).minX).toBeCloseTo(1, 6);
    expect(contourLength(inn)).toBeCloseTo(2 * (98 + 48), 6);
  });

  it("circle offset changes radius", () => {
    const c = offsetContour(circle("c", 0, 0, 20), 0.76);
    expect(signedArea(c)).toBeCloseTo(Math.PI * (10 - 0.76) ** 2, 6);
  });
});

describe("rotateStart", () => {
  it("splits a line and keeps the contour closed", () => {
    const sq = roundedRect("s", 0, 0, 100, 50, 0);
    const r = rotateStart(sq, 1, 0.5);
    expect(r.segments[0]!.a).toEqual({ x: 50, y: 0 });
    expect(r.segments[r.segments.length - 1]!.b).toEqual({ x: 50, y: 0 });
    expect(contourLength(r)).toBeCloseTo(300, 6);
  });
});

describe("DXF helpers", () => {
  it("bulge 1 is a CCW semicircle", () => {
    const s = bulgeSeg({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    expect(s.kind).toBe("arc");
    if (s.kind === "arc") {
      expect(s.c.x).toBeCloseTo(5);
      expect(s.c.y).toBeCloseTo(0);
      expect(s.ccw).toBe(true);
    }
  });

  it("chains shuffled, reversed lines with small gaps and removes duplicates", () => {
    const raw = [
      line({ x: 0, y: 0 }, { x: 10, y: 0 }),
      line({ x: 10, y: 10 }, { x: 10.005, y: 0.004 }), // reversed + gap
      line({ x: 0, y: 10 }, { x: 0, y: 0 }),
      line({ x: 10, y: 10 }, { x: 0, y: 10 }),
      line({ x: 0, y: 0 }, { x: 10, y: 0 }), // duplicate
    ].map((seg) => ({ seg, layer: "0" }));
    const { contours, report } = buildContours(raw, 0.01);
    expect(contours).toHaveLength(1);
    expect(contours[0]!.closed).toBe(true);
    expect(report.duplicatesRemoved).toBe(1);
    expect(report.gapsFixed).toBeGreaterThan(0);
    expect(containsPoint(contours[0]!, { x: 5, y: 5 })).toBe(true);
  });
});
