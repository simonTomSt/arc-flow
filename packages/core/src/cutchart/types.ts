/** One cut-chart row. Key = material + thickness + current + nozzle (spec §5.5). */
export interface CutChartRow {
  material: string;
  thicknessMm: number;
  currentA: number;
  nozzle: string;
  kerfMm: number;
  feedMmMin: number;
  pierceHeightMm: number;
  pierceDelayS: number;
  cutHeightMm: number;
  /** THC target arc voltage. Absent when the machine has no THC. */
  arcVoltageV?: number;
  source: "factory" | "calibrated" | "manual" | "interpolated";
  calibratedAt?: string;
  note?: string;
}

export interface CutChart {
  id: string;
  name: string;
  /** Plasma source / torch the chart belongs to, e.g. "Hypertherm Powermax 45 XP". */
  source: string;
  rows: CutChartRow[];
}

export interface CutPreset {
  material: string;
  thicknessMm: number;
  currentA: number;
  nozzle: string;
}

export interface LookupResult {
  row: CutChartRow;
  interpolated: boolean;
  warning?: string;
}
