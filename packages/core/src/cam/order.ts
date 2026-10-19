import { dist, type Vec2 } from "../geometry/vec";
import { startPoint } from "../geometry/contour";
import type { MachineProfile } from "../project/machine";
import type { Classified } from "./classify";
import type { Operation } from "./types";

/**
 * Cutting order (spec §5.4):
 *  1. deeper parts first (an island must be cut before the hole that frees it),
 *  2. inside a part: holes small → large, then the outline last (part stays attached),
 *  3. between parts: nearest neighbour from program zero,
 *  4. open contours last.
 * TODO: anti tip-up rapids, "all holes on sheet first" option, thermal strategies (design X5).
 */
export function orderOperations(ops: Operation[], cls: Classified[], machine: MachineProfile, sheetHeightMm = 0): Operation[] {
  const byContour = new Map(cls.map((c) => [c.contour.id, c]));
  const parts = new Map<string, Operation[]>();
  const open: Operation[] = [];
  for (const op of ops) {
    if (op.role === "open") open.push(op);
    else (parts.get(op.partId) ?? parts.set(op.partId, []).get(op.partId)!).push(op);
  }

  const partList = [...parts.entries()].map(([id, list]) => {
    const outline = byContour.get(id)!;
    list.sort((a, b) => {
      const ra = a.role === "hole" ? 0 : 1;
      const rb = b.role === "hole" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (byContour.get(a.contourId)?.area ?? 0) - (byContour.get(b.contourId)?.area ?? 0);
    });
    return { id, depth: outline.depth, list, anchor: startPoint(outline.contour) };
  });

  const zero: Vec2 = machine.origin === "top-left" ? { x: 0, y: sheetHeightMm } : { x: 0, y: 0 };
  const sorted: typeof partList = [];
  const depths = [...new Set(partList.map((p) => p.depth))].sort((a, b) => b - a);
  let cur = zero;
  for (const d of depths) {
    const pool = partList.filter((p) => p.depth === d);
    while (pool.length) {
      let bi = 0;
      pool.forEach((p, i) => {
        if (dist(p.anchor, cur) < dist(pool[bi]!.anchor, cur)) bi = i;
      });
      const next = pool.splice(bi, 1)[0]!;
      sorted.push(next);
      cur = next.anchor;
    }
  }

  const out = [...sorted.flatMap((p) => p.list), ...open];
  out.forEach((op, i) => (op.order = i + 1));
  return out;
}
