/**
 * Synergy thresholds (spec §5). These are DEFAULT starting points, never constants:
 * the cut chart / machine profile / project may override every field.
 */
export interface SynergyRules {
  /** Small hole if size < k × thickness (spec §5.3, default 2.5). */
  smallHoleK: number;
  /** …or below this absolute size from the nozzle table (mm). Larger of the two wins. */
  smallHoleMinMm: number;
  smallHoleSpeedPct: number;
  /** "Not cuttable by plasma" below k × thickness or 2 × kerf. */
  uncuttableK: number;
  /** Suggest marking + drilling below k × thickness (design P · Punktowanie: 1.5). */
  drillSuggestK: number;
  /** THC off on contours shorter than this (design C reason 3: 50 mm). */
  thcOffBelowLengthMm: number;
  /** Lead-in length = max(min, k × thickness). Design shows 8 mm at 4 mm; spec says 1–1.5×. Calibrate. */
  leadInMinMm: number;
  leadInK: number;
  arcLeadAngleDeg: number;
  /** Pierce crater clearance from any contour wall (design AS: 1.5 mm, crater ≈ 3 mm). */
  craterMarginMm: number;
  defaultOvercutMm: number;
  /** Two parts closer than k × thickness → "Za mały mostek" warning. */
  minBridgeK: number;
  /** Open contour whose ends are closer than this is probably a broken closed contour. */
  suspectGapMm: number;
}

export const defaultRules: SynergyRules = {
  smallHoleK: 2.5,
  smallHoleMinMm: 0,
  smallHoleSpeedPct: 60,
  uncuttableK: 1.0,
  drillSuggestK: 1.5,
  thcOffBelowLengthMm: 50,
  leadInMinMm: 3,
  leadInK: 2,
  arcLeadAngleDeg: 90,
  craterMarginMm: 1.5,
  defaultOvercutMm: 0,
  minBridgeK: 2,
  suspectGapMm: 2,
};
