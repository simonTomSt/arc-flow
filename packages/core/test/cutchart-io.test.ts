import { describe, it, expect } from "vitest";
import {
  cutChartIssues,
  parseCutChart,
  powermax45S235,
  serializeCutChart,
  type CutChart,
} from "../src/cutchart";

describe("cutchart serialize/parse", () => {
  it("round-trips the starter chart", () => {
    const text = serializeCutChart(powermax45S235);
    const back = parseCutChart(text);
    expect(back).toEqual(powermax45S235);
  });

  it("wraps the chart in an envelope with format + version", () => {
    const text = serializeCutChart(powermax45S235);
    const parsed = JSON.parse(text) as { format: string; version: number };
    expect(parsed.format).toBe("arcflow-cutchart");
    expect(parsed.version).toBe(1);
  });

  it("rejects wrong format", () => {
    expect(() => parseCutChart(JSON.stringify({ format: "other", version: 1, chart: {} }))).toThrow(/cut chart/);
  });

  it("rejects unsupported version", () => {
    expect(() => parseCutChart(JSON.stringify({ format: "arcflow-cutchart", version: 2, chart: {} }))).toThrow(/version/);
  });

  it("rejects a row with the wrong field type", () => {
    const bad = {
      format: "arcflow-cutchart",
      version: 1,
      chart: {
        id: "x",
        name: "x",
        source: "x",
        rows: [{ material: "S235", thicknessMm: "4", currentA: 45, nozzle: "1.1", kerfMm: 1, feedMmMin: 1, pierceHeightMm: 1, pierceDelayS: 0, cutHeightMm: 1, source: "factory" }],
      },
    };
    expect(() => parseCutChart(JSON.stringify(bad))).toThrow(/thicknessMm/);
  });

  it("rejects a row with an invalid source value", () => {
    const bad = {
      format: "arcflow-cutchart",
      version: 1,
      chart: {
        id: "x",
        name: "x",
        source: "x",
        rows: [{ material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1", kerfMm: 1, feedMmMin: 1, pierceHeightMm: 1, pierceDelayS: 0, cutHeightMm: 1, source: "banana" }],
      },
    };
    expect(() => parseCutChart(JSON.stringify(bad))).toThrow(/source/);
  });
});

describe("cutChartIssues", () => {
  it("reports no issues on the starter chart alone", () => {
    const issues = cutChartIssues(powermax45S235);
    // The 16 mm row has feed = 0 but carries a note explaining it, so no zeroFeed.
    expect(issues).toEqual([]);
  });

  it("flags missing arc voltage when the machine has THC", () => {
    const chart: CutChart = {
      ...powermax45S235,
      rows: powermax45S235.rows.map((r, i) => (i === 0 ? { ...r, arcVoltageV: undefined } : r)),
    };
    const issues = cutChartIssues(chart, { hasTHC: true });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rowIndex: 0, code: "missingVoltage", severity: "warn" });
  });

  it("does not flag missing voltage when the machine has no THC", () => {
    const chart: CutChart = {
      ...powermax45S235,
      rows: powermax45S235.rows.map((r, i) => (i === 0 ? { ...r, arcVoltageV: undefined } : r)),
    };
    expect(cutChartIssues(chart, { hasTHC: false })).toEqual([]);
  });

  it("flags feed exceeding the machine rapid", () => {
    const issues = cutChartIssues(powermax45S235, { rapidMmMin: 2500 });
    // Rows with feed 3800 and 2600 exceed 2500.
    const codes = issues.map((i) => i.code);
    expect(codes.filter((c) => c === "feedExceedsRapid")).toHaveLength(2);
  });

  it("flags non-positive kerf, pierce-below-cut, and duplicate keys", () => {
    const chart: CutChart = {
      id: "t",
      name: "t",
      source: "t",
      rows: [
        { material: "S235", thicknessMm: 3, currentA: 40, nozzle: "1.1", kerfMm: 0, feedMmMin: 3000, pierceHeightMm: 3, pierceDelayS: 0.3, cutHeightMm: 1.5, source: "factory" },
        { material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1", kerfMm: 1.5, feedMmMin: 2000, pierceHeightMm: 1, pierceDelayS: 0.5, cutHeightMm: 1.5, source: "factory" },
        { material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1", kerfMm: 1.5, feedMmMin: 2000, pierceHeightMm: 3, pierceDelayS: 0.5, cutHeightMm: 1.5, source: "factory" },
      ],
    };
    const issues = cutChartIssues(chart);
    const codes = issues.map((i) => `${i.rowIndex}:${i.code}`);
    expect(codes).toContain("0:nonPositiveKerf");
    expect(codes).toContain("1:pierceBelowCut");
    expect(codes).toContain("2:duplicateKey");
  });

  it("does not flag zero feed when the row carries an explanatory note", () => {
    const chart: CutChart = {
      ...powermax45S235,
      rows: powermax45S235.rows.map((r) => (r.thicknessMm === 16 ? { ...r, note: "Tylko start z krawędzi" } : r)),
    };
    const zeroFeed = cutChartIssues(chart).filter((i) => i.code === "zeroFeed");
    expect(zeroFeed).toEqual([]);
  });

  it("flags zero feed when there is no note", () => {
    const chart: CutChart = {
      ...powermax45S235,
      rows: powermax45S235.rows.map((r) => (r.thicknessMm === 16 ? { material: r.material, thicknessMm: r.thicknessMm, currentA: r.currentA, nozzle: r.nozzle, kerfMm: r.kerfMm, feedMmMin: 0, pierceHeightMm: r.pierceHeightMm, pierceDelayS: r.pierceDelayS, cutHeightMm: r.cutHeightMm, source: r.source } : r)),
    };
    const zeroFeed = cutChartIssues(chart).filter((i) => i.code === "zeroFeed");
    expect(zeroFeed).toHaveLength(1);
  });
});
