import { type Contour, containsPoint, signedArea, startPoint, characteristicSize } from "../geometry/contour";
import { pointAt } from "../geometry/segment";
import type { Role } from "./types";

export interface Classified {
  contour: Contour;
  role: Role;
  /** Nesting depth among closed contours: 0 = part outline, 1 = hole, 2 = island … */
  depth: number;
  parentId: string | null;
  /** Id of the contour that is the outline of the part this contour belongs to. */
  partId: string;
  area: number;
  sizeMm: number;
}

/** Build the part → hole → island hierarchy (spec §4.1, §5.1). */
export function classify(contours: Contour[]): Classified[] {
  const closed = contours.filter((c) => c.closed);
  const areas = new Map(closed.map((c) => [c.id, Math.abs(signedArea(c))]));
  const probe = (c: Contour) => pointAt(c.segments[0]!, 0.5) ?? startPoint(c);

  const parent = new Map<string, string | null>();
  for (const c of closed) {
    const p = probe(c);
    let best: Contour | null = null;
    for (const o of closed) {
      if (o === c) continue;
      if ((areas.get(o.id) ?? 0) <= (areas.get(c.id) ?? 0)) continue;
      if (!containsPoint(o, p)) continue;
      if (!best || (areas.get(o.id) ?? 0) < (areas.get(best.id) ?? 0)) best = o;
    }
    parent.set(c.id, best ? best.id : null);
  }
  const depthOf = (id: string): number => {
    let d = 0;
    let p = parent.get(id) ?? null;
    while (p) {
      d++;
      p = parent.get(p) ?? null;
    }
    return d;
  };

  const out: Classified[] = [];
  for (const c of contours) {
    if (!c.closed) {
      out.push({ contour: c, role: "open", depth: 0, parentId: null, partId: c.id, area: 0, sizeMm: 0 });
      continue;
    }
    const depth = depthOf(c.id);
    const role: Role = depth % 2 === 1 ? "hole" : depth === 0 ? "outer" : "island";
    const partId = depth % 2 === 1 ? (parent.get(c.id) ?? c.id) : c.id;
    out.push({ contour: c, role, depth, parentId: parent.get(c.id) ?? null, partId, area: areas.get(c.id) ?? 0, sizeMm: characteristicSize(c) });
  }
  return out;
}
