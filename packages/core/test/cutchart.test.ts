import { describe, it, expect } from "vitest";
import { applyCalibration, calibrateKerf, editCutChartRow, lookupCutChart, powermax45S235 } from "../src/cutchart";

describe("cutchart lookup", () => {
  it("returns the exact row when preset matches", () => {
    const res = lookupCutChart(powermax45S235, { material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1" });
    expect(res).not.toBeNull();
    expect(res!.interpolated).toBe(false);
    expect(res!.row.kerfMm).toBeCloseTo(1.52, 5);
  });

  it("interpolates between the two closest rows with a warning", () => {
    const res = lookupCutChart(powermax45S235, { material: "S235", thicknessMm: 7, currentA: 45, nozzle: "1.1" });
    expect(res).not.toBeNull();
    expect(res!.interpolated).toBe(true);
    expect(res!.warning).toBeTruthy();
    // 7 mm sits between 6 (1.70) and 8 (1.80).
    expect(res!.row.kerfMm).toBeCloseTo(1.75, 5);
    expect(res!.row.source).toBe("interpolated");
  });

  it("returns null when the current has no neighbours", () => {
    const res = lookupCutChart(powermax45S235, { material: "S235", thicknessMm: 7, currentA: 60, nozzle: "1.1" });
    expect(res).toBeNull();
  });
});

describe("kerf calibration", () => {
  it("recovers the real kerf when outer and hole agree", () => {
    // Cut a 100×100 square with Ø20 hole using kerf 1.52.
    // Real kerf is 1.66, so outer measures 99.86 and hole measures 20.14.
    const res = calibrateKerf({
      nominalSquareMm: 100,
      nominalHoleMm: 20,
      measuredA: 99.86,
      measuredB: 99.86,
      measuredHole: 20.14,
      kerfUsedMm: 1.52,
    });
    expect(res.kerfMm).toBeCloseTo(1.66, 2);
    expect(res.spread).toBeLessThan(0.02);
  });

  it("flags spread when outer and hole disagree", () => {
    const res = calibrateKerf({
      nominalSquareMm: 100,
      nominalHoleMm: 20,
      measuredA: 99.8,
      measuredB: 99.8,
      measuredHole: 20.4,
      kerfUsedMm: 1.52,
    });
    // outer → 1.72, hole → 1.92, mean 1.82, spread 0.20
    expect(res.fromOuter).toBeCloseTo(1.72, 2);
    expect(res.fromHole).toBeCloseTo(1.92, 2);
    expect(res.spread).toBeCloseTo(0.2, 2);
  });
});

describe("cutchart edit", () => {
  it("replaces a row without mutating the original chart", () => {
    const i = powermax45S235.rows.findIndex((r) => r.thicknessMm === 4);
    const next = editCutChartRow(powermax45S235, i, { feedMmMin: 2800 });
    expect(next.rows[i]!.feedMmMin).toBe(2800);
    expect(powermax45S235.rows[i]!.feedMmMin).toBe(2600);
    expect(next).not.toBe(powermax45S235);
    expect(next.rows).not.toBe(powermax45S235.rows);
  });

  it("applies a calibration result: new kerf, source=calibrated, timestamp", () => {
    const i = powermax45S235.rows.findIndex((r) => r.thicknessMm === 6);
    const next = applyCalibration(powermax45S235, i, { kerfMm: 1.665 }, "2026-10-19");
    expect(next.rows[i]!.kerfMm).toBe(1.665);
    expect(next.rows[i]!.source).toBe("calibrated");
    expect(next.rows[i]!.calibratedAt).toBe("2026-10-19");
  });

  it("rounds the calibrated kerf to 3 decimals", () => {
    const i = 0;
    const next = applyCalibration(powermax45S235, i, { kerfMm: 1.666666 }, "2026-10-19");
    expect(next.rows[i]!.kerfMm).toBe(1.667);
  });

  it("throws on out-of-range index", () => {
    expect(() => editCutChartRow(powermax45S235, -1, {})).toThrow();
    expect(() => editCutChartRow(powermax45S235, 999, {})).toThrow();
  });
});
