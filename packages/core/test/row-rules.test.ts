import { describe, it, expect } from "vitest";
import {
  defaultRules,
  demoProject,
  generateOperations,
  lookupCutChart,
  parseCutChart,
  powermax45S235,
  serializeCutChart,
  toploong1325,
  type CutChart,
  type CutChartRow,
  type Operation,
} from "../src";

/**
 * Spec §5.5: a cut chart row may override the Synergy thresholds. These tests
 * pin the merge order used by `generateOperations` and `validate`:
 *   defaultRules  ⟵  row.rules  ⟵  input.rules
 * and confirm that `smallHoleK` picked up from a row changes which contour is
 * classified as small (so lead type + speed % flip in sync).
 */
function opFor(id: string, ops: Operation[]): Operation {
  const o = ops.find((o) => o.contourId === id);
  if (!o) throw new Error(`no op for ${id}`);
  return o;
}

describe("row-level rule overrides", () => {
  it("row.rules.smallHoleK demotes a Ø5 hole out of the small-hole class", () => {
    // demo: Ø5 hole in 4 mm plate. Default k=2.5 → threshold 10 mm → 5 < 10 → small (center lead).
    // Lower k to 1.0 via the row: threshold 4 mm → 5 > 4 → not small → regular lead.
    const p = demoProject();
    const row = lookupCutChart(powermax45S235, p.preset)!.row;
    const baseline = generateOperations({ contours: p.contours, row, machine: toploong1325, mode: "synergic", sheet: p.sheet });
    const demoted = generateOperations({
      contours: p.contours,
      row: { ...row, rules: { smallHoleK: 1.0 } },
      machine: toploong1325,
      mode: "synergic",
      sheet: p.sheet,
    });
    const holeId = "a-h1";
    expect(opFor(holeId, baseline).leadIn.value.type).toBe("center");
    expect(opFor(holeId, demoted).leadIn.value.type).not.toBe("center");
  });

  it("input.rules beats row.rules (project override wins)", () => {
    // Row says small-holes-off (k=1.0); project pins k=2.5 so Ø5 is small again.
    const p = demoProject();
    const row = lookupCutChart(powermax45S235, p.preset)!.row;
    const result = generateOperations({
      contours: p.contours,
      row: { ...row, rules: { smallHoleK: 1.0 } },
      machine: toploong1325,
      mode: "synergic",
      sheet: p.sheet,
      rules: { ...defaultRules, smallHoleK: 2.5 },
    });
    const holeId = "a-h1";
    expect(opFor(holeId, result).leadIn.value.type).toBe("center");
  });

  it("row.rules round-trips through serializeCutChart / parseCutChart", () => {
    const chart: CutChart = {
      ...powermax45S235,
      rows: powermax45S235.rows.map((r, i): CutChartRow =>
        i === 0 ? { ...r, rules: { smallHoleK: 3.0, leadInK: 1.0 } } : r,
      ),
    };
    const back = parseCutChart(serializeCutChart(chart));
    expect(back.rows[0]!.rules).toEqual({ smallHoleK: 3.0, leadInK: 1.0 });
  });

  it("parser drops non-numeric fields from row.rules", () => {
    const bad = {
      format: "arcflow-cutchart",
      version: 1,
      chart: {
        id: "x",
        name: "x",
        source: "x",
        rows: [
          {
            material: "S235",
            thicknessMm: 4,
            currentA: 45,
            nozzle: "1.1",
            kerfMm: 1.5,
            feedMmMin: 2000,
            pierceHeightMm: 3,
            pierceDelayS: 0.5,
            cutHeightMm: 1.5,
            source: "factory",
            rules: { smallHoleK: 3.0, bogus: "nope", nan: Number.NaN },
          },
        ],
      },
    };
    const back = parseCutChart(JSON.stringify(bad));
    expect(back.rows[0]!.rules).toEqual({ smallHoleK: 3.0 });
  });
});
