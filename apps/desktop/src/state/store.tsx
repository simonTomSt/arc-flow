import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  applyLayerRoles,
  buildToolpath,
  defaultLayerMap,
  demoProject,
  estimate,
  generateOperations,
  importDxf,
  type ImportReport,
  type LayerRole,
  lookupCutChart,
  parseProject,
  powermax45S235,
  serializeProject,
  toploong1325,
  grblTable,
  translateContour,
  validate,
  type MachineProfile,
  type Mode,
  type OperationOverrides,
  type Project,
} from "@arcflow/core";

export type Workspace = "start" | "sketch" | "cam" | "nesting" | "sim" | "export";
export type Theme = "dark" | "light" | "ultra-dark";
export type Lang = "pl" | "en";

/** Snapshot of a pending import, shown on the "Import report" screen before it is accepted. */
export interface PendingImport {
  fileName: string;
  report: ImportReport;
  rawContours: Project["contours"];
  layerMap: Record<string, LayerRole>;
}

export interface UiState {
  project: Project;
  workspace: Workspace;
  selectedContourId: string | null;
  theme: Theme;
  lang: Lang;
  touch: boolean;
  showExport: boolean;
  /** Bumped by "Generuj"; derived data is recomputed from the project anyway. */
  generation: number;
  /** Set when an import needs operator review (design: Import report). */
  pendingImport: PendingImport | null;
}

export type Action =
  | { type: "setWorkspace"; ws: Workspace }
  | { type: "setMode"; mode: Mode }
  | { type: "select"; id: string | null }
  | { type: "override"; contourId: string; patch: OperationOverrides }
  | { type: "restoreAuto"; contourId: string; key: keyof OperationOverrides }
  | { type: "generate" }
  | { type: "stageDxf"; text: string; name: string }
  | { type: "setLayerRole"; layer: string; role: LayerRole }
  | { type: "acceptImport"; mode: "replace" | "append" }
  | { type: "cancelImport" }
  | { type: "loadProject"; project: Project }
  | { type: "setMachine"; id: string }
  | { type: "setTheme"; theme: Theme }
  | { type: "setLang"; lang: Lang }
  | { type: "setTouch"; touch: boolean }
  | { type: "showExport"; show: boolean };

export const machines: MachineProfile[] = [toploong1325, grblTable];

function prefixIds(contours: Project["contours"], prefix: string): Project["contours"] {
  return contours.map((c) => ({ ...c, id: `${prefix}${c.id}` }));
}

function reducer(s: UiState, a: Action): UiState {
  switch (a.type) {
    case "setWorkspace":
      return { ...s, workspace: a.ws };
    case "setMode":
      return { ...s, project: { ...s.project, mode: a.mode } };
    case "select":
      return { ...s, selectedContourId: a.id };
    case "override": {
      const prev = s.project.overrides[a.contourId] ?? {};
      return { ...s, project: { ...s.project, overrides: { ...s.project.overrides, [a.contourId]: { ...prev, ...a.patch } } } };
    }
    case "restoreAuto": {
      const prev = { ...(s.project.overrides[a.contourId] ?? {}) };
      delete prev[a.key];
      return { ...s, project: { ...s.project, overrides: { ...s.project.overrides, [a.contourId]: prev } } };
    }
    case "generate":
      return { ...s, generation: s.generation + 1 };
    case "stageDxf": {
      const res = importDxf(a.text, { sheet: s.project.sheet });
      return {
        ...s,
        pendingImport: {
          fileName: a.name,
          report: res.report,
          rawContours: res.contours,
          layerMap: defaultLayerMap(res.contours),
        },
      };
    }
    case "setLayerRole": {
      if (!s.pendingImport) return s;
      return { ...s, pendingImport: { ...s.pendingImport, layerMap: { ...s.pendingImport.layerMap, [a.layer]: a.role } } };
    }
    case "cancelImport":
      return { ...s, pendingImport: null };
    case "acceptImport": {
      if (!s.pendingImport) return s;
      const { rawContours, layerMap, fileName } = s.pendingImport;
      const { contours, overrides } = applyLayerRoles(rawContours, layerMap);
      const prefix = `i${s.generation + 1}-`;
      const prefixed = prefixIds(contours, prefix);
      const prefixedOverrides: Record<string, OperationOverrides> = {};
      for (const [k, v] of Object.entries(overrides)) prefixedOverrides[`${prefix}${k}`] = v;
      if (a.mode === "replace") {
        return {
          ...s,
          project: {
            ...s.project,
            name: fileName.replace(/\.(dxf|svg)$/i, ""),
            contours: prefixed,
            overrides: prefixedOverrides,
          },
          selectedContourId: null,
          workspace: "cam",
          pendingImport: null,
        };
      }
      // Append: shift new contours to the right of the current content so they don't overlap.
      const shift = sheetFillOffset(s.project.contours, s.project.sheet.widthMm);
      const shifted = prefixed.map((c) => translateContour(c, shift, 0));
      return {
        ...s,
        project: {
          ...s.project,
          contours: [...s.project.contours, ...shifted],
          overrides: { ...s.project.overrides, ...prefixedOverrides },
        },
        selectedContourId: null,
        workspace: "cam",
        pendingImport: null,
      };
    }
    case "loadProject":
      return { ...s, project: a.project, selectedContourId: null, pendingImport: null, workspace: "cam" };
    case "setMachine":
      return { ...s, project: { ...s.project, machineId: a.id } };
    case "setTheme":
      return { ...s, theme: a.theme };
    case "setLang":
      return { ...s, lang: a.lang };
    case "setTouch":
      return { ...s, touch: a.touch };
    case "showExport":
      return { ...s, showExport: a.show };
  }
}

function sheetFillOffset(existing: Project["contours"], sheetWidth: number): number {
  if (existing.length === 0) return 0;
  let maxX = 0;
  for (const c of existing) for (const s of c.segments) {
    maxX = Math.max(maxX, s.a.x, s.b.x);
    if (s.kind === "arc") maxX = Math.max(maxX, s.c.x + 50);
  }
  // Leave a 10 mm gap; wrap back if we would run past the sheet.
  const shift = maxX + 10;
  return shift < sheetWidth ? shift : 10;
}

const initial: UiState = {
  project: demoProject(),
  workspace: "cam",
  selectedContourId: "a-h1",
  theme: "dark",
  lang: "pl",
  touch: false,
  showExport: false,
  generation: 0,
  pendingImport: null,
};

/** Everything computed from the project. Pure functions from @arcflow/core, memoised. */
export function useDerived(s: UiState) {
  return useMemo(() => {
    const p = s.project;
    const machine = machines.find((m) => m.id === p.machineId) ?? toploong1325;
    const look = lookupCutChart(powermax45S235, p.preset);
    if (!look) throw new Error("No cut chart row for preset");
    const row = look.row;
    const ops = generateOperations({ contours: p.contours, row, machine, mode: p.mode, overrides: p.overrides, sheet: p.sheet });
    const toolpath = buildToolpath({ contours: p.contours, ops, row, machine });
    const issues = validate({ contours: p.contours, ops, toolpath, row, machine, sheet: p.sheet, mode: p.mode });
    const est = estimate(toolpath, row, machine);
    return { machine, row, ops, toolpath, issues, est, chartWarning: look.warning };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.project, s.generation]);
}

/** Serialize the project to a .arcflow string. */
export function projectToArcflow(p: Project): string {
  return serializeProject(p);
}

export function projectFromArcflow(text: string): Project {
  return parseProject(text);
}

const Ctx = createContext<{ state: UiState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}
