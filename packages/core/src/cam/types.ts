import type { Vec2 } from "../geometry/vec";

/** Where a value came from. Override hierarchy (spec §2.3): machine → chart → project → part → contour. */
export type Source = "auto" | "chart" | "machine" | "project" | "part" | "manual";

/** A parameter with its automatic value kept alongside, so the UI can show "przywróć auto". */
export interface Param<T> {
  value: T;
  auto: T;
  source: Source;
}

export type Role = "outer" | "hole" | "island" | "open";
export type Direction = "CW" | "CCW";
export type Side = "left" | "right" | "none";
export type LeadType = "none" | "line" | "arc" | "lineArc" | "center";

export interface LeadIn {
  type: LeadType;
  lengthMm: number;
  angleDeg: number;
}

export interface LeadOut {
  type: "none" | "line";
  lengthMm: number;
}

export interface StartAt {
  seg: number;
  t: number;
}

/**
 * Why the automation made a decision ("Dlaczego?" panel, spec §2.2).
 * `code` is stable for i18n; `params` feed the message template.
 */
export interface Reason {
  code: ReasonCode;
  params: Record<string, number | string>;
}

export type ReasonCode =
  | "ROLE_OUTER"
  | "ROLE_HOLE"
  | "ROLE_ISLAND"
  | "ROLE_OPEN"
  | "SMALL_HOLE_CENTER"
  | "SMALL_HOLE_SPEED"
  | "THC_OFF_SHORT"
  | "THC_OFF_SMALL"
  | "LEAD_CLAMPED"
  | "TOO_SMALL_TO_CUT"
  | "DRILL_SUGGESTED"
  | "KERF_FROM_CHART"
  | "MANUAL_MODE";

export interface Operation {
  id: string;
  contourId: string;
  partId: string;
  role: Role;
  /** Cutting order, 1-based. */
  order: number;
  /** Characteristic size (diameter for circles), mm. */
  sizeMm: number;
  action: Param<"cut" | "mark" | "skip">;
  direction: Param<Direction>;
  side: Param<Side>;
  startAt: Param<StartAt>;
  leadIn: Param<LeadIn>;
  leadOut: Param<LeadOut>;
  overcutMm: Param<number>;
  speedPct: Param<number>;
  thc: Param<boolean>;
  reasons: Reason[];
  /** Assisted mode: true until the user accepts the proposal. */
  needsReview: boolean;
}

/** User overrides stored in the project; any field present wins over auto. */
export interface OperationOverrides {
  action?: "cut" | "mark" | "skip";
  direction?: Direction;
  side?: Side;
  startAt?: StartAt;
  leadIn?: LeadIn;
  leadOut?: LeadOut;
  overcutMm?: number;
  speedPct?: number;
  thc?: boolean;
  accepted?: boolean;
}

/** What a cutting move is for; lets the canvas and simulation colour leads differently. */
export type MoveTag = "lead" | "contour" | "overcut" | "leadOut";

/** Machine-independent toolpath; postprocessors turn this into G-code. */
export type Move =
  | { type: "rapid"; to: Vec2 }
  | { type: "pierce"; at: Vec2 }
  | { type: "thc"; on: boolean }
  | { type: "comp"; side: Side }
  | { type: "line"; to: Vec2; feed: number; tag?: MoveTag }
  | { type: "arc"; to: Vec2; center: Vec2; ccw: boolean; feed: number; full?: boolean; tag?: MoveTag }
  | { type: "cutOff" };

export interface CutBlock {
  opId: string;
  order: number;
  pierce: Vec2;
  moves: Move[];
}

export interface Toolpath {
  blocks: CutBlock[];
}
