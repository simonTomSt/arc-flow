import { describe, expect, it } from "vitest";
import { buildContours, fuseAdjacent } from "../src/import/dxf";
import { arc, line, segLength } from "../src/geometry/segment";
import { contourLength } from "../src/geometry/contour";

describe("DXF cleanup — zero-length + overlap merge", () => {
  it("drops zero-length line segments and reports them", () => {
    const raw = [
      { seg: line({ x: 0, y: 0 }, { x: 10, y: 0 }), layer: "0" },
      { seg: line({ x: 10, y: 0 }, { x: 10, y: 0 }), layer: "0" }, // zero-length
      { seg: line({ x: 10, y: 0 }, { x: 10, y: 5 }), layer: "0" },
      { seg: line({ x: 10, y: 5 }, { x: 0, y: 5 }), layer: "0" },
      { seg: line({ x: 0, y: 5 }, { x: 0, y: 0 }), layer: "0" },
    ];
    const { contours, report } = buildContours(raw, 0.01);
    expect(contours).toHaveLength(1);
    expect(contours[0]!.segments).toHaveLength(4); // 4 sides, no zero-length
    expect(report.duplicatesRemoved).toBe(1);
  });

  it("merges two overlapping collinear lines into one before chaining", () => {
    const raw = [
      { seg: line({ x: 0, y: 0 }, { x: 10, y: 0 }), layer: "0" },
      { seg: line({ x: 4, y: 0 }, { x: 14, y: 0 }), layer: "0" }, // overlaps
      { seg: line({ x: 14, y: 0 }, { x: 14, y: 5 }), layer: "0" },
      { seg: line({ x: 14, y: 5 }, { x: 0, y: 5 }), layer: "0" },
      { seg: line({ x: 0, y: 5 }, { x: 0, y: 0 }), layer: "0" },
    ];
    const { contours, report } = buildContours(raw, 0.01);
    expect(contours).toHaveLength(1);
    const c = contours[0]!;
    expect(c.closed).toBe(true);
    expect(contourLength(c)).toBeCloseTo(2 * (14 + 5), 6);
    expect(report.duplicatesRemoved).toBeGreaterThan(0);
  });

  it("fuses adjacent collinear lines in a chained contour", () => {
    const chain = [
      line({ x: 0, y: 0 }, { x: 5, y: 0 }),
      line({ x: 5, y: 0 }, { x: 10, y: 0 }), // same direction → fuse
      line({ x: 10, y: 0 }, { x: 10, y: 5 }),
    ];
    const fused = fuseAdjacent(chain, 0.01);
    expect(fused).toHaveLength(2);
    expect(segLength(fused[0]!)).toBeCloseTo(10, 6);
  });

  it("fuses adjacent co-circular arcs", () => {
    const a1 = arc({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, true);
    const a2 = arc({ x: 0, y: 10 }, { x: -10, y: 0 }, { x: 0, y: 0 }, true);
    const fused = fuseAdjacent([a1, a2], 0.01);
    expect(fused).toHaveLength(1);
    expect(segLength(fused[0]!)).toBeCloseTo(Math.PI * 10, 4);
  });

  it("does not fuse arcs with different centres", () => {
    const a1 = arc({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, true);
    const a2 = arc({ x: 0, y: 10 }, { x: -10, y: 0 }, { x: 0, y: 0.5 }, true);
    const fused = fuseAdjacent([a1, a2], 0.01);
    expect(fused).toHaveLength(2);
  });
});
