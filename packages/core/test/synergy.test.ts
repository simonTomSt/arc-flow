import { describe, expect, it } from "vitest";
import { generateOperations, buildToolpath, estimate, reasonPl, classify } from "../src/cam";
import { validate, blocksExport } from "../src/validate";
import { demoProject, toploong1325, grblTable, wspornikWS02, circle, roundedRect } from "../src/project";
import { lookupCutChart, powermax45S235, calibrateKerf } from "../src/cutchart";
import { containsPoint, distToContour } from "../src/geometry";

const row = lookupCutChart(powermax45S235, { material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1" })!.row;

describe("classification", () => {
  it("part / hole / island", () => {
    const cls = classify([roundedRect("o", 0, 0, 200, 200, 0), circle("h", 100, 100, 120), circle("i", 100, 100, 60)]);
    const role = Object.fromEntries(cls.map((c) => [c.contour.id, c.role]));
    expect(role).toEqual({ o: "outer", h: "hole", i: "island" });
  });
});

describe("synergy rules (spec §5, design screen C)", () => {
  const contours = wspornikWS02("a-", 20, 20);
  const ops = generateOperations({ contours, row, machine: toploong1325, mode: "synergic" });
  const byId = Object.fromEntries(ops.map((o) => [o.contourId, o]));

  it("Ø5 hole: centre lead-in, 60 %, THC off, CCW, left comp", () => {
    const o = byId["a-h1"]!;
    expect(o.role).toBe("hole");
    expect(o.leadIn.value.type).toBe("center");
    expect(o.speedPct.value).toBe(60);
    expect(o.thc.value).toBe(false);
    expect(o.direction.value).toBe("CCW");
    expect(o.side.value).toBe("left");
    expect(o.reasons.map(reasonPl)).toContain("Ø5 < 2,5 × grubość (10 mm) → wejście ze środka");
  });

  it("Ø30 hole: line+arc 8 mm, full speed, THC on", () => {
    const o = byId["a-h30"]!;
    expect(o.leadIn.value).toMatchObject({ type: "lineArc", lengthMm: 8 });
    expect(o.speedPct.value).toBe(100);
    expect(o.thc.value).toBe(true);
  });

  it("outline: CW, cut last within its part", () => {
    const o = byId["a-outer"]!;
    expect(o.direction.value).toBe("CW");
    expect(o.order).toBe(ops.length);
  });

  it("holes ordered small → large", () => {
    expect(byId["a-h30"]!.order).toBe(7);
  });

  it("manual override wins and keeps auto value", () => {
    const ops2 = generateOperations({ contours, row, machine: toploong1325, mode: "synergic", overrides: { "a-h1": { overcutMm: 0.8 } } });
    const o = ops2.find((x) => x.contourId === "a-h1")!;
    expect(o.overcutMm).toEqual({ value: 0.8, auto: 0, source: "manual" });
  });

  it("assisted mode flags ops for review until accepted", () => {
    const ops3 = generateOperations({ contours, row, machine: toploong1325, mode: "assisted", overrides: { "a-h1": { accepted: true } } });
    expect(ops3.find((x) => x.contourId === "a-h1")!.needsReview).toBe(false);
    expect(ops3.find((x) => x.contourId === "a-h2")!.needsReview).toBe(true);
  });
});

describe("toolpath geometry", () => {
  it("every pierce of a hole lies inside the hole, clear of the wall", () => {
    const contours = wspornikWS02("a-", 20, 20);
    const ops = generateOperations({ contours, row, machine: toploong1325, mode: "synergic" });
    const tp = buildToolpath({ contours, ops, row, machine: toploong1325 });
    for (const b of tp.blocks) {
      const op = ops.find((o) => o.id === b.opId)!;
      const c = contours.find((x) => x.id === op.contourId)!;
      if (op.role === "hole") {
        expect(containsPoint(c, b.pierce)).toBe(true);
        expect(distToContour(c, b.pierce)).toBeGreaterThan(1.5);
      } else {
        expect(containsPoint(c, b.pierce)).toBe(false);
      }
    }
  });

  it("GRBL path is offset by kerf/2 (no controller compensation)", () => {
    const contours = [circle("h", 50, 50, 30), roundedRect("o", 0, 0, 100, 100, 0)];
    const ops = generateOperations({ contours, row, machine: grblTable, mode: "synergic" });
    const tp = buildToolpath({ contours, ops, row, machine: grblTable });
    const holeBlock = tp.blocks.find((b) => b.opId === "op-h")!;
    const arcMove = holeBlock.moves.find((m) => m.type === "arc" && m.full);
    expect(arcMove && arcMove.type === "arc" ? Math.hypot(arcMove.to.x - 50, arcMove.to.y - 50) : 0).toBeCloseTo(15 - row.kerfMm / 2, 6);
    expect(tp.blocks.flatMap((b) => b.moves).some((m) => m.type === "comp")).toBe(false);
  });

  it("estimate counts pierces", () => {
    const p = demoProject();
    const ops = generateOperations({ contours: p.contours, row, machine: toploong1325, mode: "synergic" });
    const tp = buildToolpath({ contours: p.contours, ops, row, machine: toploong1325 });
    const e = estimate(tp, row, toploong1325);
    expect(e.pierces).toBe(16);
    expect(e.totalTimeS).toBeGreaterThan(0);
  });
});

describe("validation (design screens AS / M / I)", () => {
  it("40 mm manual lead-in in Ø30 → error with max 25.5 mm", () => {
    const contours = wspornikWS02("a-", 20, 20);
    const overrides = { "a-h30": { leadIn: { type: "line" as const, lengthMm: 40, angleDeg: 90 } } };
    const ops = generateOperations({ contours, row, machine: toploong1325, mode: "manual", overrides });
    const tp = buildToolpath({ contours, ops, row, machine: toploong1325 });
    const issues = validate({ contours, ops, toolpath: tp, row, machine: toploong1325, sheet: { widthMm: 600, heightMm: 400 }, mode: "manual" });
    const lead = issues.find((i) => i.code === "LEAD_OUTSIDE_HOLE" && i.contourId === "a-h30");
    expect(lead?.severity).toBe("error");
    expect(lead?.params.max).toBe(25.5);
    expect(blocksExport(issues)).toBe(true);
  });

  it("demo project validates clean", () => {
    const p = demoProject();
    const ops = generateOperations({ contours: p.contours, row, machine: toploong1325, mode: "synergic" });
    const tp = buildToolpath({ contours: p.contours, ops, row, machine: toploong1325 });
    const issues = validate({ contours: p.contours, ops, toolpath: tp, row, machine: toploong1325, sheet: p.sheet, mode: "synergic" });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("cut chart", () => {
  it("interpolates 7 mm between 6 and 8", () => {
    const r = lookupCutChart(powermax45S235, { material: "S235", thicknessMm: 7, currentA: 45, nozzle: "1.1" })!;
    expect(r.interpolated).toBe(true);
    expect(r.row.kerfMm).toBeCloseTo(1.75);
  });

  it("kerf calibration matches design screen F (≈1.66)", () => {
    const k = calibrateKerf({ nominalSquareMm: 50, nominalHoleMm: 20, measuredA: 49.87, measuredB: 49.86, measuredHole: 20.15, kerfUsedMm: 1.52 });
    expect(k.kerfMm).toBeCloseTo(1.66, 2);
  });
});
