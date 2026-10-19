import type { Contour } from "../geometry/contour";
import type { OperationOverrides } from "../cam/types";

/**
 * What an imported DXF layer should become in CAM.
 *
 *  - `cut`    — regular contour cutting (default for unknown layers)
 *  - `mark`   — low-current marking / scriber (action.mark)
 *  - `punch`  — centre-punch points (handled as mark for now; design P)
 *  - `ignore` — contour is dropped from the project
 */
export type LayerRole = "cut" | "mark" | "punch" | "ignore";

const PATTERNS: Array<{ role: LayerRole; re: RegExp }> = [
  { role: "ignore", re: /^(ignore|hidden|skip|defpoints?)$/i },
  { role: "mark", re: /mark|engrav|scrib/i },
  { role: "punch", re: /punkt|punch|center|dot/i },
  { role: "cut", re: /cut|cięcie|ciecie|out(side|line)?|profil|contour/i },
];

/** Heuristic: guess the role of a DXF layer from its name. */
export function detectLayerRole(name: string): LayerRole {
  for (const { role, re } of PATTERNS) if (re.test(name)) return role;
  return "cut";
}

/** Enumerate all distinct layer names used by `contours`. */
export function layersUsed(contours: Contour[]): string[] {
  const set = new Set<string>();
  for (const c of contours) set.add(c.layer ?? "0");
  return [...set].sort();
}

/** Build a default layer→role mapping for the current contours. */
export function defaultLayerMap(contours: Contour[]): Record<string, LayerRole> {
  const out: Record<string, LayerRole> = {};
  for (const name of layersUsed(contours)) out[name] = detectLayerRole(name);
  return out;
}

/**
 * Apply a layer→role mapping. Returns the filtered contours (IGNORE layers
 * dropped) plus the overrides that force `action` on MARK/PUNKT contours.
 */
export function applyLayerRoles(
  contours: Contour[],
  map: Record<string, LayerRole>,
): { contours: Contour[]; overrides: Record<string, OperationOverrides> } {
  const kept: Contour[] = [];
  const overrides: Record<string, OperationOverrides> = {};
  for (const c of contours) {
    const role = map[c.layer ?? "0"] ?? "cut";
    if (role === "ignore") continue;
    kept.push(c);
    if (role === "mark" || role === "punch") overrides[c.id] = { action: "mark" };
  }
  return { contours: kept, overrides };
}
