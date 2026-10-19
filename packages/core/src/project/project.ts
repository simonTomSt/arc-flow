import type { Contour } from "../geometry/contour";
import type { CutPreset } from "../cutchart/types";
import type { OperationOverrides } from "../cam/types";

export type Mode = "synergic" | "assisted" | "manual";

/** Project document, saved as `.arcflow` JSON (docs/engineering/31-data-model.md). */
export interface Project {
  format: "arcflow";
  version: 1;
  name: string;
  sheet: { widthMm: number; heightMm: number };
  machineId: string;
  chartId: string;
  preset: CutPreset;
  mode: Mode;
  /** Geometry already placed on the sheet (part transforms/nesting: TODO). */
  contours: Contour[];
  /** User overrides per contour id. Everything not here is automatic. */
  overrides: Record<string, OperationOverrides>;
}

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}

export function parseProject(text: string): Project {
  const p = JSON.parse(text) as Project;
  if (p.format !== "arcflow") throw new Error("Not an .arcflow file");
  if (p.version !== 1) throw new Error(`Unsupported .arcflow version ${String(p.version)}`);
  return p;
}
