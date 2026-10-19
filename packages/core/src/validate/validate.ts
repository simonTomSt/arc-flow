import { type Contour, bbox, containsPoint, distToContour, polygon } from "../geometry/contour";
import { dist } from "../geometry/vec";
import type { CutChartRow } from "../cutchart/types";
import type { MachineProfile } from "../project/machine";
import type { Mode } from "../project/project";
import { type SynergyRules, defaultRules } from "../cam/rules";
import type { Operation, Toolpath } from "../cam/types";

export type Severity = "error" | "warning" | "info";

export interface Issue {
  code: IssueCode;
  severity: Severity;
  opId?: string;
  contourId?: string;
  params: Record<string, number | string>;
  /** Suggested one-click fix, if any (design: "Zastosuj zalecane"). */
  fix?: { code: string; params: Record<string, number | string> };
}

export type IssueCode =
  | "OPEN_CONTOUR_GAP"
  | "OPEN_CONTOUR"
  | "LEAD_OUTSIDE_HOLE"
  | "HOLE_TOO_SMALL"
  | "OUTSIDE_SHEET"
  | "OUTSIDE_WORK_AREA"
  | "NO_COMPENSATION"
  | "BRIDGE_TOO_SMALL"
  | "NEEDS_REVIEW";

export interface ValidateInput {
  contours: Contour[];
  ops: Operation[];
  toolpath: Toolpath;
  row: CutChartRow;
  machine: MachineProfile;
  sheet: { widthMm: number; heightMm: number };
  mode: Mode;
  rules?: SynergyRules;
}

/**
 * Pre-export validation (spec §6.4, design screen I).
 * Errors block export (user can consciously override); warnings and infos never block.
 * Runs in every mode — Manual turns the automation off, never the checks.
 */
export function validate(input: ValidateInput): Issue[] {
  const rules = input.rules ?? defaultRules;
  const { row, machine, sheet } = input;
  const byId = new Map(input.contours.map((c) => [c.id, c]));
  const issues: Issue[] = [];

  for (const op of input.ops) {
    const c = byId.get(op.contourId);
    if (!c) continue;
    const base = { opId: op.id, contourId: c.id };

    if (!c.closed) {
      const gap = dist(c.segments[0]!.a, c.segments[c.segments.length - 1]!.b);
      if (gap <= rules.suspectGapMm) issues.push({ ...base, code: "OPEN_CONTOUR_GAP", severity: "error", params: { gap }, fix: { code: "JOIN_GAP", params: { gap } } });
      else issues.push({ ...base, code: "OPEN_CONTOUR", severity: "info", params: {} });
    }

    if (op.role === "hole" && op.action.value === "cut") {
      const min = Math.max(rules.uncuttableK * row.thicknessMm, 2 * row.kerfMm);
      if (op.sizeMm < min) issues.push({ ...base, code: "HOLE_TOO_SMALL", severity: "warning", params: { size: op.sizeMm, min }, fix: { code: "MARK_INSTEAD", params: {} } });

      const block = input.toolpath.blocks.find((b) => b.opId === op.id);
      if (block) {
        const p = block.pierce;
        const clearance = distToContour(c, p);
        const need = rules.craterMarginMm + row.kerfMm / 2;
        const isCenter = op.leadIn.value.type === "center";
        if (!containsPoint(c, p) || (!isCenter && clearance < need)) {
          const maxSafe = Math.max(0, op.sizeMm - row.kerfMm - 2 * rules.craterMarginMm);
          issues.push({ ...base, code: "LEAD_OUTSIDE_HOLE", severity: "error", params: { len: op.leadIn.value.lengthMm, size: op.sizeMm, max: round1(maxSafe) }, fix: { code: "SHORTEN_LEAD", params: { len: round1(maxSafe) } } });
        }
      }
    }

    if (c.closed && op.role !== "open" && op.side.value === "none" && op.action.value === "cut") {
      issues.push({ ...base, code: "NO_COMPENSATION", severity: input.mode === "manual" ? "warning" : "error", params: {} });
    }

    const b = bbox(c);
    if (b.minX < 0 || b.minY < 0 || b.maxX > sheet.widthMm || b.maxY > sheet.heightMm) issues.push({ ...base, code: "OUTSIDE_SHEET", severity: "error", params: {} });
    else if (b.maxX > machine.workAreaMm.x || b.maxY > machine.workAreaMm.y) issues.push({ ...base, code: "OUTSIDE_WORK_AREA", severity: "error", params: {} });

    if (op.needsReview) issues.push({ ...base, code: "NEEDS_REVIEW", severity: "info", params: {} });
  }

  // Bridges between different part outlines (design: "Za mały mostek · 4,8 mm")
  const outlines = input.ops.filter((o) => o.role === "outer").map((o) => byId.get(o.contourId)!);
  const minBridge = rules.minBridgeK * row.thicknessMm;
  for (let i = 0; i < outlines.length; i++) {
    for (let j = i + 1; j < outlines.length; j++) {
      const gap = minGap(outlines[i]!, outlines[j]!) - row.kerfMm;
      if (gap < minBridge) issues.push({ code: "BRIDGE_TOO_SMALL", severity: "warning", contourId: outlines[i]!.id, params: { gap: round1(gap), min: minBridge, other: outlines[j]!.id } });
    }
  }
  return issues;
}

export const blocksExport = (issues: Issue[]): boolean => issues.some((i) => i.severity === "error");

function minGap(a: Contour, b: Contour): number {
  const ba = bbox(a);
  const bb = bbox(b);
  const dx = Math.max(0, bb.minX - ba.maxX, ba.minX - bb.maxX);
  const dy = Math.max(0, bb.minY - ba.maxY, ba.minY - bb.maxY);
  if (Math.hypot(dx, dy) > 100) return Infinity; // far apart, skip the O(n·m) check
  const pa = polygon(a, 0.2);
  const pb = polygon(b, 0.2);
  let m = Infinity;
  for (const p of pa) for (const q of pb) m = Math.min(m, dist(p, q));
  return m;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
