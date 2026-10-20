/**
 * Nozzle — one tip/consumables set (design L1). The cut-chart row's `nozzle`
 * field joins against `Nozzle.id`; the chart row's kerf still wins when both
 * are present (the row has been calibrated for the machine), the nozzle's
 * default kerf is only a starting point.
 */
export interface Nozzle {
  id: string;
  /** Human-readable, e.g. "1.1". Used as the row key in cut charts. */
  label: string;
  diameterMm: number;
  defaultKerfMm: number;
  /** Rated current band (optional, informational). */
  currentBand?: { minA: number; maxA: number };
  note?: string;
}

export interface NozzleLibrary {
  id: string;
  nozzles: Nozzle[];
}

/** On-disk envelope — mirrors cut charts (`cutchart/io.ts`). */
export interface NozzleLibraryFile {
  format: "arcflow-nozzles";
  version: 1;
  library: NozzleLibrary;
}
