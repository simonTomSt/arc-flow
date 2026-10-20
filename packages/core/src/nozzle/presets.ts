import type { NozzleLibrary } from "./types";

/**
 * Starter nozzle set used by `powermax45S235` and the design (0,8 / 1,0 / 1,1 / 1,2).
 * `defaultKerfMm` is a safe midpoint for S235 at the recommended current; the cut chart
 * is still the source of truth once calibrated.
 */
export const defaultNozzles: NozzleLibrary = {
  id: "default",
  nozzles: [
    { id: "n-0.8", label: "0.8", diameterMm: 0.8, defaultKerfMm: 1.1, currentBand: { minA: 20, maxA: 30 } },
    { id: "n-1.0", label: "1.0", diameterMm: 1.0, defaultKerfMm: 1.4, currentBand: { minA: 30, maxA: 45 } },
    { id: "n-1.1", label: "1.1", diameterMm: 1.1, defaultKerfMm: 1.6, currentBand: { minA: 40, maxA: 55 } },
    { id: "n-1.2", label: "1.2", diameterMm: 1.2, defaultKerfMm: 1.8, currentBand: { minA: 50, maxA: 65 } },
  ],
};
