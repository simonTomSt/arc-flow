import { type Contour, asCircle, contourLength, corners } from "../geometry/contour";
import { segLength } from "../geometry/segment";
import type { CutChartRow } from "../cutchart/types";
import type { MachineProfile } from "../project/machine";
import type { Mode } from "../project/project";
import { type Classified, classify } from "./classify";
import { type SynergyRules, defaultRules } from "./rules";
import { orderOperations } from "./order";
import type { Direction, LeadIn, LeadOut, Operation, OperationOverrides, Param, Reason, Side, StartAt } from "./types";

export interface GenerateInput {
  contours: Contour[];
  row: CutChartRow;
  machine: MachineProfile;
  mode: Mode;
  overrides?: Record<string, OperationOverrides>;
  rules?: SynergyRules;
  sheet?: { widthMm: number; heightMm: number };
}

/**
 * "GENERUJ" — the synergic pass (spec §5). Computes an automatic value for every
 * parameter of every contour, then applies the user's overrides on top.
 *
 * Mode semantics:
 *  - synergic: value = override ?? auto
 *  - assisted: same, but every operation without `accepted` is flagged needsReview
 *  - manual:   value = override ?? manualDefault (auto is still computed and shown, never applied)
 */
export function generateOperations(input: GenerateInput): Operation[] {
  const rules = input.rules ?? defaultRules;
  const ov = input.overrides ?? {};
  const classified = classify(input.contours);
  const ops = classified.map((c) => buildOp(c, input, rules, ov[c.contour.id] ?? {}));
  return orderOperations(ops, classified, input.machine, input.sheet?.heightMm ?? 0);
}

function buildOp(c: Classified, input: GenerateInput, rules: SynergyRules, o: OperationOverrides): Operation {
  const { row, machine, mode } = input;
  const t = row.thicknessMm;
  const reasons: Reason[] = [];
  const contour = c.contour;
  const circle = asCircle(contour);
  const size = c.sizeMm;

  // §5.1 direction + compensation side
  const cwSwirl = machine.swirl === "CW";
  let dir: Direction = "CW";
  let side: Side = "none";
  if (c.role === "outer" || c.role === "island") {
    dir = cwSwirl ? "CW" : "CCW";
    side = dir === "CCW" ? "right" : "left";
    reasons.push({ code: c.role === "outer" ? "ROLE_OUTER" : "ROLE_ISLAND", params: { dir } });
  } else if (c.role === "hole") {
    dir = cwSwirl ? "CCW" : "CW";
    side = dir === "CCW" ? "left" : "right";
    reasons.push({ code: "ROLE_HOLE", params: { dir } });
  } else {
    reasons.push({ code: "ROLE_OPEN", params: {} });
  }
  if (c.role !== "open") reasons.push({ code: "KERF_FROM_CHART", params: { kerf: row.kerfMm } });

  // §5.3 small holes
  const smallLimit = Math.max(rules.smallHoleK * t, rules.smallHoleMinMm);
  const isSmall = c.role === "hole" && size < smallLimit;
  const minLimit = Math.max(rules.uncuttableK * t, 2 * row.kerfMm);
  let action: "cut" | "mark" | "skip" = "cut";
  if (c.role === "hole" && size < minLimit) {
    reasons.push({ code: "TOO_SMALL_TO_CUT", params: { size, limit: minLimit } });
    action = machine.marker ? "mark" : "cut";
  } else if (c.role === "hole" && size < rules.drillSuggestK * t) {
    reasons.push({ code: "DRILL_SUGGESTED", params: { size, k: rules.drillSuggestK, limit: rules.drillSuggestK * t } });
  }

  // §5.2 lead-in
  let lead: LeadIn;
  const want = Math.max(rules.leadInMinMm, rules.leadInK * t);
  if (c.role === "open") lead = { type: "none", lengthMm: 0, angleDeg: 0 };
  else if (isSmall && circle) {
    lead = { type: "center", lengthMm: circle.r, angleDeg: 0 };
    reasons.push({ code: "SMALL_HOLE_CENTER", params: { size, k: rules.smallHoleK, limit: smallLimit } });
  } else if (c.role === "hole") {
    const maxSafe = size - row.kerfMm - 2 * rules.craterMarginMm;
    const l = Math.max(0.5, Math.min(want, maxSafe));
    lead = { type: isSmall ? "line" : "lineArc", lengthMm: round2(l), angleDeg: rules.arcLeadAngleDeg };
    if (l < want) reasons.push({ code: "LEAD_CLAMPED", params: { len: l, size, kerf: row.kerfMm, margin: rules.craterMarginMm } });
  } else {
    lead = { type: "lineArc", lengthMm: round2(want), angleDeg: rules.arcLeadAngleDeg };
  }

  // speed + THC
  let speed = 100;
  if (isSmall) {
    speed = rules.smallHoleSpeedPct;
    reasons.push({ code: "SMALL_HOLE_SPEED", params: { pct: speed } });
  }
  let thc = machine.hasTHC && c.role !== "open";
  const len = contourLength(contour);
  if (thc && isSmall) {
    thc = false;
    reasons.push({ code: "THC_OFF_SMALL", params: {} });
  } else if (thc && len < rules.thcOffBelowLengthMm) {
    thc = false;
    reasons.push({ code: "THC_OFF_SHORT", params: { len, limit: rules.thcOffBelowLengthMm } });
  }

  const auto = {
    action,
    direction: dir,
    side,
    startAt: autoStart(contour, c.role),
    leadIn: lead,
    leadOut: { type: "none", lengthMm: 0 } as LeadOut,
    overcutMm: rules.defaultOvercutMm,
    speedPct: speed,
    thc,
  };
  const manualDefault = { ...auto, leadIn: { type: "line", lengthMm: want, angleDeg: 90 } as LeadIn, speedPct: 100, thc: machine.hasTHC };
  if (mode === "manual") reasons.unshift({ code: "MANUAL_MODE", params: {} });
  const base = mode === "manual" ? manualDefault : auto;

  const P = <K extends keyof typeof auto>(k: K): Param<(typeof auto)[K]> => {
    const ovv = o[k as keyof OperationOverrides] as (typeof auto)[K] | undefined;
    return ovv !== undefined ? { value: ovv, auto: auto[k], source: "manual" } : { value: base[k], auto: auto[k], source: "auto" };
  };

  return {
    id: `op-${contour.id}`,
    contourId: contour.id,
    partId: c.partId,
    role: c.role,
    order: 0,
    sizeMm: round2(size),
    action: P("action"),
    direction: P("direction"),
    side: P("side"),
    startAt: P("startAt"),
    leadIn: P("leadIn"),
    leadOut: P("leadOut"),
    overcutMm: P("overcutMm"),
    speedPct: P("speedPct"),
    thc: P("thc"),
    reasons,
    needsReview: mode === "assisted" && !o.accepted,
  };
}

/**
 * Auto start point (spec §5.2). Circles: top for holes, left for outlines.
 * Outlines: sharpest corner ≥ 60° (lead mark hidden in the corner), else middle of the longest line.
 * Holes: middle of the longest line.
 * Returned index refers to the contour in its ORIGINAL orientation.
 */
function autoStart(c: Contour, role: string): StartAt {
  if (!c.closed) return { seg: 0, t: 0 };
  const circ = asCircle(c);
  if (circ && c.segments.length === 1) {
    // param along the full circle measured from its start point (angle 0 for imported circles)
    const s = c.segments[0]!;
    const a0 = Math.atan2(s.a.y - circ.center.y, s.a.x - circ.center.x);
    const want = role === "hole" ? Math.PI / 2 : Math.PI;
    let d = want - a0;
    while (d < 0) d += 2 * Math.PI;
    return { seg: 0, t: d / (2 * Math.PI) };
  }
  if (role === "outer" || role === "island") {
    const sharp = corners(c).filter((k) => k.turn >= Math.PI / 3).sort((a, b) => b.turn - a.turn)[0];
    if (sharp) return { seg: sharp.index, t: 0 };
  }
  let best = -1;
  let bestLen = 0;
  c.segments.forEach((s, i) => {
    if (s.kind === "line" && segLength(s) > bestLen) (best = i), (bestLen = segLength(s));
  });
  return best >= 0 ? { seg: best, t: 0.5 } : { seg: 0, t: 0 };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
