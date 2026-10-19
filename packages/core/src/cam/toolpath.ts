import { type Vec2, add, mul, left, right } from "../geometry/vec";
import { type Contour, reverseContour, rotateStart, isCCW, asCircle } from "../geometry/contour";
import { type Segment, segLength, splitSeg, tangentAt } from "../geometry/segment";
import { offsetContour } from "../geometry/offset";
import type { CutChartRow } from "../cutchart/types";
import type { MachineProfile } from "../project/machine";
import type { CutBlock, Move, MoveTag, Operation, Toolpath, Side } from "./types";

export interface ToolpathInput {
  contours: Contour[];
  ops: Operation[];
  row: CutChartRow;
  machine: MachineProfile;
}

/**
 * Turn operations into machine-independent moves.
 * Controller compensation (F2100K): nominal geometry + comp moves → G41/G42.
 * No controller compensation (GRBL): geometry offset by kerf/2 here, no comp moves.
 */
export function buildToolpath(input: ToolpathInput): Toolpath {
  const byId = new Map(input.contours.map((c) => [c.id, c]));
  const blocks: CutBlock[] = [];
  for (const op of [...input.ops].sort((a, b) => a.order - b.order)) {
    if (op.action.value !== "cut") continue;
    const c = byId.get(op.contourId);
    if (!c) continue;
    blocks.push(buildBlock(c, op, input));
  }
  return { blocks };
}

/** Oriented contour as it will be cut: rotated to the start point, direction applied, offset if CAM compensates. */
export function cutGeometry(c: Contour, op: Operation, row: CutChartRow, machine: MachineProfile): Contour {
  let g = c;
  if (g.closed) {
    const s = op.startAt.value;
    g = rotateStart(g, Math.min(s.seg, g.segments.length - 1), s.t);
    const wantCCW = op.direction.value === "CCW";
    if (isCCW(g) !== wantCCW) g = reverseContour(g);
  }
  const side = op.side.value;
  if (!machine.controllerCompensation && side !== "none") {
    const d = row.kerfMm / 2;
    g = offsetContour(g, side === "left" ? d : -d);
  }
  return g;
}

function buildBlock(c: Contour, op: Operation, input: ToolpathInput): CutBlock {
  const { row, machine } = input;
  const feed = Math.round((row.feedMmMin * op.speedPct.value) / 100);
  const g = cutGeometry(c, op, row, machine);
  const side: Side = op.side.value;
  const first = g.segments[0]!;
  const S = first.a;
  const t = tangentAt(first, 0);
  const n = side === "right" ? right(t) : left(t); // waste side normal

  const lead = leadMoves(op, S, t, n, side, asCircle(c)?.center, feed);
  const pierce = lead.pierce;
  const moves: Move[] = [{ type: "rapid", to: pierce }, { type: "pierce", at: pierce }];
  if (op.thc.value) moves.push({ type: "thc", on: true });
  if (machine.controllerCompensation && side !== "none") moves.push({ type: "comp", side });
  moves.push(...lead.moves.map((m) => ({ ...m, tag: "lead" as const })));
  for (const s of g.segments) moves.push(segMove(s, feed, "contour"));
  if (op.overcutMm.value > 0 && g.closed) for (const s of prefix(g.segments, op.overcutMm.value)) moves.push(segMove(s, feed, "overcut"));
  if (op.thc.value) moves.push({ type: "thc", on: false });
  const lo = op.leadOut.value;
  if (lo.type === "line" && lo.lengthMm > 0) {
    const last = lastPoint(moves) ?? S;
    moves.push({ type: "line", to: add(last, mul(n, lo.lengthMm)), feed, tag: "leadOut" });
  }
  moves.push({ type: "cutOff" });
  if (machine.controllerCompensation && side !== "none") moves.push({ type: "comp", side: "none" });
  return { opId: op.id, order: op.order, pierce, moves };
}

/** Lead-in geometry. Arc leads are tangent to the contour at S and lie on the waste side. */
function leadMoves(op: Operation, S: Vec2, t: Vec2, n: Vec2, side: Side, center: Vec2 | undefined, feed: number): { pierce: Vec2; moves: Move[] } {
  const L = op.leadIn.value.lengthMm;
  const ccw = side !== "right";
  switch (op.leadIn.value.type) {
    case "none":
      return { pierce: S, moves: [] };
    case "center": {
      const P = center ?? add(S, mul(n, L));
      return { pierce: P, moves: [{ type: "line", to: S, feed }] };
    }
    case "line": {
      const a = (op.leadIn.value.angleDeg * Math.PI) / 180;
      const P = add(S, add(mul(n, L * Math.sin(a)), mul(t, -L * Math.cos(a))));
      return { pierce: P, moves: [{ type: "line", to: S, feed }] };
    }
    case "arc": {
      const R = L;
      const C = add(S, mul(n, R));
      const P = add(C, mul(t, -R));
      return { pierce: P, moves: [{ type: "arc", to: S, center: C, ccw, feed }] };
    }
    case "lineArc": {
      const R = L / 2;
      const C = add(S, mul(n, R));
      const P = add(C, mul(t, -R));
      const P0 = add(P, mul(n, L / 2));
      return { pierce: P0, moves: [{ type: "line", to: P, feed }, { type: "arc", to: S, center: C, ccw, feed }] };
    }
  }
}

function segMove(s: Segment, feed: number, tag: MoveTag): Move {
  if (s.kind === "line") return { type: "line", to: s.b, feed, tag };
  return s.full ? { type: "arc", to: s.b, center: s.c, ccw: s.ccw, feed, full: true, tag } : { type: "arc", to: s.b, center: s.c, ccw: s.ccw, feed, tag };
}

function prefix(segs: Segment[], len: number): Segment[] {
  const out: Segment[] = [];
  let rem = len;
  for (const s of segs) {
    const l = segLength(s);
    if (l >= rem) {
      out.push(splitSeg(s, rem / l)[0]);
      return out;
    }
    out.push(s);
    rem -= l;
  }
  return out;
}

function lastPoint(moves: Move[]): Vec2 | null {
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i]!;
    if ("to" in m) return m.to;
  }
  return null;
}

