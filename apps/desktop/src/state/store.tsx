import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  applyCalibration,
  applyLayerRoles,
  bbox,
  buildToolpath,
  type CalibrationResult,
  type CutChart,
  type CutChartRow,
  defaultLayerMap,
  demoProject,
  editCutChartRow,
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
  type Issue,
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

/** One row in the Start screen's "Ostatnie projekty" list. */
export interface RecentProject {
  path: string;
  name: string;
  openedAt: string;
  /** "Wyeksportowano" or "N uwag" chip (design A). */
  status?: string;
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
  /** Monotonic counter for DXF imports; drives the `iN-` id prefix so appended parts can't collide with earlier ones. */
  importSeq: number;
  /** Set when an import needs operator review (design: Import report). */
  pendingImport: PendingImport | null;
  /** Start-screen recent-projects list; persisted in localStorage. */
  recent: RecentProject[];
  /** Absolute path of the last G-code export; persisted in localStorage. */
  lastExportPath: string | null;
  /** The active cut chart (library). In M2 we keep a single starter chart; L1/L2 add more. */
  chart: CutChart;
  /** Charts screen (design F) is open as an overlay. */
  showCharts: boolean;
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
  | { type: "loadProject"; project: Project; path?: string }
  | { type: "setMachine"; id: string }
  | { type: "setTheme"; theme: Theme }
  | { type: "setLang"; lang: Lang }
  | { type: "setTouch"; touch: boolean }
  | { type: "showExport"; show: boolean }
  | { type: "noteRecent"; entry: RecentProject }
  | { type: "clearRecent" }
  | { type: "noteExport"; path: string }
  | { type: "applyFixes"; issues: Issue[] }
  | { type: "showCharts"; show: boolean }
  | { type: "editChartRow"; index: number; patch: Partial<CutChartRow> }
  | { type: "applyCalibration"; index: number; result: CalibrationResult };

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
      const nextSeq = s.importSeq + 1;
      const prefix = `i${nextSeq}-`;
      const prefixed = prefixIds(contours, prefix);
      const prefixedOverrides: Record<string, OperationOverrides> = {};
      for (const [k, v] of Object.entries(overrides)) prefixedOverrides[`${prefix}${k}`] = v;
      if (a.mode === "replace") {
        return {
          ...s,
          importSeq: nextSeq,
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
        importSeq: nextSeq,
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
    case "loadProject": {
      const entry: RecentProject | null = a.path
        ? { path: a.path, name: a.project.name, openedAt: new Date().toISOString() }
        : null;
      const recent = entry ? [entry, ...s.recent.filter((r) => r.path !== entry.path)].slice(0, 6) : s.recent;
      return { ...s, project: a.project, selectedContourId: null, pendingImport: null, workspace: "cam", recent };
    }
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
    case "noteRecent": {
      const dedup = s.recent.filter((r) => r.path !== a.entry.path);
      return { ...s, recent: [a.entry, ...dedup].slice(0, 6) };
    }
    case "clearRecent":
      return { ...s, recent: [] };
    case "noteExport":
      return { ...s, lastExportPath: a.path };
    case "showCharts":
      return { ...s, showCharts: a.show };
    case "editChartRow":
      return { ...s, chart: editCutChartRow(s.chart, a.index, a.patch) };
    case "applyCalibration":
      return { ...s, chart: applyCalibration(s.chart, a.index, a.result, new Date().toISOString().slice(0, 10)) };
    case "applyFixes": {
      const overrides = { ...s.project.overrides };
      for (const i of a.issues) {
        if (!i.fix || !i.contourId) continue;
        const prev = overrides[i.contourId] ?? {};
        if (i.fix.code === "MARK_INSTEAD") overrides[i.contourId] = { ...prev, action: "mark" };
        else if (i.fix.code === "SHORTEN_LEAD" && typeof i.fix.params.len === "number") {
          const current = prev.leadIn ?? { type: "line" as const, lengthMm: i.fix.params.len, angleDeg: 0 };
          overrides[i.contourId] = { ...prev, leadIn: { ...current, lengthMm: i.fix.params.len } };
        }
        // JOIN_GAP needs geometry work — skipped here, button marks it unsupported.
      }
      return { ...s, project: { ...s.project, overrides } };
    }
  }
}

function sheetFillOffset(existing: Project["contours"], sheetWidth: number): number {
  if (existing.length === 0) return 0;
  let maxX = 0;
  for (const c of existing) maxX = Math.max(maxX, bbox(c).maxX);
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
  importSeq: 0,
  pendingImport: null,
  recent: [],
  lastExportPath: null,
  chart: powermax45S235,
  showCharts: false,
};

const PERSIST_KEY = "arcflow.ui.v1";

interface Persisted {
  recent: RecentProject[];
  lastExportPath: string | null;
  theme: Theme;
  lang: Lang;
  touch: boolean;
}

function loadPersisted(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as Partial<Persisted>;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function savePersisted(s: UiState) {
  if (typeof window === "undefined") return;
  const v: Persisted = { recent: s.recent, lastExportPath: s.lastExportPath, theme: s.theme, lang: s.lang, touch: s.touch };
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(v));
  } catch {
    // Quota or disabled storage — fine, we only lose cross-session memory.
  }
}

/** Everything computed from the project. Pure functions from @arcflow/core, memoised. */
export function useDerived(s: UiState) {
  return useMemo(() => {
    const p = s.project;
    const machine = machines.find((m) => m.id === p.machineId) ?? toploong1325;
    const look = lookupCutChart(s.chart, p.preset);
    if (!look) throw new Error("No cut chart row for preset");
    const row = look.row;
    const ops = generateOperations({ contours: p.contours, row, machine, mode: p.mode, overrides: p.overrides, sheet: p.sheet });
    const toolpath = buildToolpath({ contours: p.contours, ops, row, machine });
    const issues = validate({ contours: p.contours, ops, toolpath, row, machine, sheet: p.sheet, mode: p.mode });
    const est = estimate(toolpath, row, machine);
    return { machine, row, ops, toolpath, issues, est, chartWarning: look.warning };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.project, s.generation, s.chart]);
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
  const [state, dispatch] = useReducer(reducer, initial, (base) => ({ ...base, ...loadPersisted() }));
  useEffect(() => savePersisted(state), [state.recent, state.lastExportPath, state.theme, state.lang, state.touch]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}
