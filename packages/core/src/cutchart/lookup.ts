import type { CutChart, CutChartRow, CutPreset, LookupResult } from "./types";

/**
 * Find the row for a preset. Exact match first; otherwise linear interpolation
 * between the two nearest thicknesses with the same material/current/nozzle
 * (spec §5.5: "Interpolacja między grubościami ... z ostrzeżeniem").
 */
export function lookupCutChart(chart: CutChart, p: CutPreset): LookupResult | null {
  const same = chart.rows.filter((r) => r.material === p.material && r.nozzle === p.nozzle);
  const exact = same.find((r) => r.thicknessMm === p.thicknessMm && r.currentA === p.currentA);
  if (exact) return { row: exact, interpolated: false };

  const cands = same.filter((r) => r.currentA === p.currentA).sort((a, b) => a.thicknessMm - b.thicknessMm);
  const lo = [...cands].reverse().find((r) => r.thicknessMm < p.thicknessMm);
  const hi = cands.find((r) => r.thicknessMm > p.thicknessMm);
  if (!lo || !hi) return null;
  const t = (p.thicknessMm - lo.thicknessMm) / (hi.thicknessMm - lo.thicknessMm);
  const L = (a: number, b: number) => a + (b - a) * t;
  const row: CutChartRow = {
    material: p.material,
    thicknessMm: p.thicknessMm,
    currentA: p.currentA,
    nozzle: p.nozzle,
    kerfMm: L(lo.kerfMm, hi.kerfMm),
    feedMmMin: Math.round(L(lo.feedMmMin, hi.feedMmMin)),
    pierceHeightMm: L(lo.pierceHeightMm, hi.pierceHeightMm),
    pierceDelayS: L(lo.pierceDelayS, hi.pierceDelayS),
    cutHeightMm: L(lo.cutHeightMm, hi.cutHeightMm),
    ...(lo.arcVoltageV !== undefined && hi.arcVoltageV !== undefined ? { arcVoltageV: Math.round(L(lo.arcVoltageV, hi.arcVoltageV)) } : {}),
    source: "interpolated",
  };
  return { row, interpolated: true, warning: `Interpolated between ${lo.thicknessMm} mm and ${hi.thicknessMm} mm — calibrate before production` };
}

/**
 * Kerf calibration wizard (design screen F). Sample: square A×B with hole Ø C.
 * Outer measures shrink by kerf deviation, hole grows by it.
 * Returns the real kerf, given the kerf the sample was cut with.
 */
export function calibrateKerf(input: {
  nominalSquareMm: number;
  nominalHoleMm: number;
  measuredA: number;
  measuredB: number;
  measuredHole: number;
  kerfUsedMm: number;
}): { kerfMm: number; fromOuter: number; fromHole: number; spread: number } {
  const outerAvg = (input.measuredA + input.measuredB) / 2;
  const fromOuter = input.kerfUsedMm + (input.nominalSquareMm - outerAvg);
  const fromHole = input.kerfUsedMm + (input.measuredHole - input.nominalHoleMm);
  const kerfMm = (fromOuter + fromHole) / 2;
  return { kerfMm, fromOuter, fromHole, spread: Math.abs(fromOuter - fromHole) };
}
