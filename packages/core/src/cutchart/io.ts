import type { CutChart, CutChartRow } from "./types";

/** On-disk JSON envelope for cut charts (docs/engineering/31-data-model.md). */
export interface CutChartFile {
  format: "arcflow-cutchart";
  version: 1;
  chart: CutChart;
}

export function serializeCutChart(chart: CutChart): string {
  const file: CutChartFile = { format: "arcflow-cutchart", version: 1, chart };
  return JSON.stringify(file, null, 2);
}

/** Parse a cut chart from JSON. Throws on wrong format/version or malformed rows. */
export function parseCutChart(text: string): CutChart {
  const raw = JSON.parse(text) as Partial<CutChartFile>;
  if (raw.format !== "arcflow-cutchart") throw new Error("Not an arcflow cut chart file");
  if (raw.version !== 1) throw new Error(`Unsupported cut chart version ${String(raw.version)}`);
  const c = raw.chart;
  if (!c || typeof c !== "object") throw new Error("Missing chart body");
  if (typeof c.id !== "string" || typeof c.name !== "string" || typeof c.source !== "string") {
    throw new Error("Chart is missing id/name/source");
  }
  if (!Array.isArray(c.rows)) throw new Error("Chart rows must be an array");
  const rows: CutChartRow[] = c.rows.map((r, i) => validateRow(r, i));
  return { id: c.id, name: c.name, source: c.source, rows };
}

function validateRow(r: unknown, i: number): CutChartRow {
  if (!r || typeof r !== "object") throw new Error(`Row ${i} is not an object`);
  const row = r as Record<string, unknown>;
  const need = (k: string, t: "string" | "number"): string | number => {
    const v = row[k];
    if (typeof v !== t) throw new Error(`Row ${i} field "${k}" must be ${t}`);
    return v as string | number;
  };
  const src = row.source;
  if (src !== "factory" && src !== "calibrated" && src !== "manual" && src !== "interpolated") {
    throw new Error(`Row ${i} has invalid source "${String(src)}"`);
  }
  const out: CutChartRow = {
    material: need("material", "string") as string,
    thicknessMm: need("thicknessMm", "number") as number,
    currentA: need("currentA", "number") as number,
    nozzle: need("nozzle", "string") as string,
    kerfMm: need("kerfMm", "number") as number,
    feedMmMin: need("feedMmMin", "number") as number,
    pierceHeightMm: need("pierceHeightMm", "number") as number,
    pierceDelayS: need("pierceDelayS", "number") as number,
    cutHeightMm: need("cutHeightMm", "number") as number,
    source: src,
  };
  if (typeof row.arcVoltageV === "number") out.arcVoltageV = row.arcVoltageV;
  if (typeof row.calibratedAt === "string") out.calibratedAt = row.calibratedAt;
  if (typeof row.note === "string") out.note = row.note;
  if (row.rules && typeof row.rules === "object") {
    const rulesIn = row.rules as Record<string, unknown>;
    const rules: Record<string, number> = {};
    for (const [k, v] of Object.entries(rulesIn)) {
      if (typeof v === "number" && Number.isFinite(v)) rules[k] = v;
    }
    if (Object.keys(rules).length) out.rules = rules as CutChartRow["rules"];
  }
  return out;
}

export type ChartIssueCode =
  | "nonPositiveKerf"
  | "pierceBelowCut"
  | "zeroFeed"
  | "duplicateKey"
  | "missingVoltage"
  | "feedExceedsRapid";

export interface ChartIssue {
  rowIndex: number;
  code: ChartIssueCode;
  severity: "warn" | "error";
  /** Translation key arg; UI resolves to localised copy. */
  params?: Record<string, string | number>;
}

export interface ChartIssueContext {
  /** When set, flag rows whose feed exceeds the machine's rapid speed. */
  rapidMmMin?: number;
  /** When set, flag THC machines where a row lacks arcVoltageV. */
  hasTHC?: boolean;
}

/**
 * Static quality checks for a chart's rows. Machine-dependent checks fire only
 * when the matching context field is provided. The F table surfaces them next
 * to the row so the operator notices before the row ships to toolpath.
 */
export function cutChartIssues(chart: CutChart, ctx: ChartIssueContext = {}): ChartIssue[] {
  const out: ChartIssue[] = [];
  const seen = new Map<string, number>();
  chart.rows.forEach((r, i) => {
    if (r.kerfMm <= 0) out.push({ rowIndex: i, code: "nonPositiveKerf", severity: "error" });
    if (r.feedMmMin === 0 && !r.note) out.push({ rowIndex: i, code: "zeroFeed", severity: "warn" });
    // pierceHeightMm === 0 is the "start from edge, no pierce" convention — don't flag it.
    if (r.pierceHeightMm > 0 && r.pierceHeightMm < r.cutHeightMm) {
      out.push({ rowIndex: i, code: "pierceBelowCut", severity: "warn" });
    }
    if (ctx.hasTHC && r.arcVoltageV === undefined) {
      out.push({ rowIndex: i, code: "missingVoltage", severity: "warn" });
    }
    if (typeof ctx.rapidMmMin === "number" && r.feedMmMin > ctx.rapidMmMin) {
      out.push({
        rowIndex: i,
        code: "feedExceedsRapid",
        severity: "error",
        params: { feed: r.feedMmMin, rapid: ctx.rapidMmMin },
      });
    }
    const key = `${r.material}|${r.thicknessMm}|${r.currentA}|${r.nozzle}`;
    const first = seen.get(key);
    if (first !== undefined) {
      out.push({ rowIndex: i, code: "duplicateKey", severity: "error", params: { first } });
    } else {
      seen.set(key, i);
    }
  });
  return out;
}
