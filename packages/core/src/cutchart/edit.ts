import type { CutChart, CutChartRow } from "./types";
import type { CalibrationResult } from "./lookup";

/** Replace a row in a chart, preserving the rest. Pure. */
export function editCutChartRow(chart: CutChart, index: number, patch: Partial<CutChartRow>): CutChart {
  if (index < 0 || index >= chart.rows.length) throw new Error(`editCutChartRow: index ${index} out of range`);
  const rows = chart.rows.slice();
  const current = rows[index]!;
  rows[index] = { ...current, ...patch };
  return { ...chart, rows };
}

/**
 * Apply a kerf calibration result to a row (spec §5.5): set `kerfMm`, mark the
 * source as `calibrated` and stamp `calibratedAt` with the given ISO date.
 */
export function applyCalibration(
  chart: CutChart,
  index: number,
  result: Pick<CalibrationResult, "kerfMm">,
  isoDate: string,
): CutChart {
  return editCutChartRow(chart, index, {
    kerfMm: round3(result.kerfMm),
    source: "calibrated",
    calibratedAt: isoDate,
  });
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
