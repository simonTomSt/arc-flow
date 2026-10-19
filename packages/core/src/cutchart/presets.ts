import type { CutChart } from "./types";

/**
 * Starter chart, values copied from the ArcFlow design (screen F · Tabele cięcia).
 * NOT production data: every row must be calibrated on the real machine.
 */
export const powermax45S235: CutChart = {
  id: "pmx45-s235-1.1",
  name: "Stal S235 · dysza 1.1",
  source: "Hypertherm Powermax 45 XP",
  rows: [
    row(3, 40, 1.4, 3800, 3.6, 0.3, 1.5, 112, "calibrated"),
    row(4, 45, 1.52, 2600, 3.8, 0.5, 1.5, 118, "calibrated", undefined, "2025-10-12"),
    row(5, 45, 1.6, 2000, 3.8, 0.6, 1.5, 122, "factory"),
    row(6, 45, 1.7, 1500, 4.0, 0.8, 1.5, 125, "factory"),
    row(8, 45, 1.8, 980, 4.5, 1.0, 1.5, 130, "manual"),
    row(10, 45, 1.9, 650, 4.5, 1.4, 1.5, 135, "factory"),
    row(12, 45, 2.0, 450, 5.0, 2.0, 1.5, 140, "factory", "Granica przebicia"),
    row(16, 45, 2.1, 280, 0, 0, 1.5, 146, "factory", "Tylko start z krawędzi"),
  ],
};

function row(
  t: number,
  a: number,
  k: number,
  v: number,
  ph: number,
  pt: number,
  ch: number,
  u: number,
  source: "factory" | "calibrated" | "manual",
  note?: string,
  calibratedAt?: string,
) {
  return {
    material: "S235",
    thicknessMm: t,
    currentA: a,
    nozzle: "1.1",
    kerfMm: k,
    feedMmMin: v,
    pierceHeightMm: ph,
    pierceDelayS: pt,
    cutHeightMm: ch,
    arcVoltageV: u,
    source,
    ...(calibratedAt ? { calibratedAt } : {}),
    ...(note ? { note } : {}),
  };
}
