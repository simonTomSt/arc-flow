/**
 * Library storage. Under Tauri we keep each library item as a JSON file inside
 * `<appData>/arcflow/library/`. In the browser we fall back to localStorage
 * (handled by the store); this module is a no-op there, so nothing throws.
 *
 * Why files-per-item: the design (`docs/engineering/31-data-model.md` §Libraries)
 * calls for diffable, backup-friendly storage. One `charts.json` /
 * `machines.json` / `nozzles.json` per library is enough for M2; multi-chart
 * support later becomes a folder of charts/*.json without changing the API.
 */
import type { CutChart, MachineProfile, NozzleLibrary } from "@arcflow/core";
import { parseCutChart, parseNozzles, serializeCutChart, serializeNozzles } from "@arcflow/core";

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface LibrarySnapshot {
  chart?: CutChart;
  machines?: MachineProfile[];
  nozzles?: NozzleLibrary;
}

const LIB_DIR = "arcflow/library";

/** Lazily imported Tauri modules; dev-server bundle must not include them. */
async function tauri() {
  const [{ BaseDirectory, exists, mkdir, readTextFile, writeTextFile }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-fs"),
    import("@tauri-apps/api/path"),
  ]);
  return { BaseDirectory, exists, mkdir, readTextFile, writeTextFile, appDataDir, join };
}

async function ensureDir(): Promise<string> {
  const t = await tauri();
  const base = await t.appDataDir();
  const dir = await t.join(base, LIB_DIR);
  if (!(await t.exists(dir))) await t.mkdir(dir, { recursive: true });
  return dir;
}

/** Read whatever library files exist. Missing files are not an error. */
export async function loadLibrary(): Promise<LibrarySnapshot> {
  if (!isTauri()) return {};
  try {
    const t = await tauri();
    const dir = await ensureDir();
    const snap: LibrarySnapshot = {};
    const chartPath = await t.join(dir, "chart.json");
    if (await t.exists(chartPath)) snap.chart = parseCutChart(await t.readTextFile(chartPath));
    const machinesPath = await t.join(dir, "machines.json");
    if (await t.exists(machinesPath)) {
      const parsed = JSON.parse(await t.readTextFile(machinesPath)) as { format: string; version: number; machines: MachineProfile[] };
      if (parsed.format === "arcflow-machines" && parsed.version === 1 && Array.isArray(parsed.machines)) snap.machines = parsed.machines;
    }
    const nozzlesPath = await t.join(dir, "nozzles.json");
    if (await t.exists(nozzlesPath)) snap.nozzles = parseNozzles(await t.readTextFile(nozzlesPath));
    return snap;
  } catch (err) {
    console.warn("library.load failed", err);
    return {};
  }
}

export async function saveChart(chart: CutChart): Promise<void> {
  if (!isTauri()) return;
  try {
    const t = await tauri();
    const dir = await ensureDir();
    await t.writeTextFile(await t.join(dir, "chart.json"), serializeCutChart(chart));
  } catch (err) {
    console.warn("library.saveChart failed", err);
  }
}

export async function saveMachines(machines: MachineProfile[]): Promise<void> {
  if (!isTauri()) return;
  try {
    const t = await tauri();
    const dir = await ensureDir();
    const text = JSON.stringify({ format: "arcflow-machines", version: 1, machines }, null, 2);
    await t.writeTextFile(await t.join(dir, "machines.json"), text);
  } catch (err) {
    console.warn("library.saveMachines failed", err);
  }
}

export async function saveNozzles(nozzles: NozzleLibrary): Promise<void> {
  if (!isTauri()) return;
  try {
    const t = await tauri();
    const dir = await ensureDir();
    await t.writeTextFile(await t.join(dir, "nozzles.json"), serializeNozzles(nozzles));
  } catch (err) {
    console.warn("library.saveNozzles failed", err);
  }
}

/** One file bundling everything, for "Eksportuj kopię zapasową". */
export function serializeBackup(snap: Required<Pick<LibrarySnapshot, "chart" | "machines" | "nozzles">>): string {
  return JSON.stringify(
    { format: "arcflow-library-backup", version: 1, exportedAt: new Date().toISOString(), ...snap },
    null,
    2,
  );
}
