import { Fragment, useContext, useMemo, useState } from "react";
import {
  calibrateKerf,
  cutChartIssues,
  defaultRules,
  lookupCutChart,
  parseCutChart,
  serializeCutChart,
  type ChartIssue,
  type CutChart,
  type CutChartRow,
  type SynergyRules,
} from "@arcflow/core";
import { useStore } from "../state/store";
import { LangContext, fmtNum, useT } from "../i18n";
import type { MessageKey } from "../i18n";
import { openTextFile, saveTextFile } from "../platform/save";

/**
 * Design screen F — Cut charts & kerf calibration.
 * Materials tree on the left, parameter table in the middle, wizard modal
 * writes a new kerf back into the chart via dispatch("applyCalibration").
 * One starter chart for now (powermax45S235); multi-chart lives in L1/L2.
 */
export function ChartsScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const lang = useContext(LangContext);
  const chart = state.chart;
  const [selectedMaterialNozzle, setSelectedMaterialNozzle] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<number>(() => chart.rows.findIndex((r) => r.thicknessMm === state.project.preset.thicknessMm && r.nozzle === state.project.preset.nozzle));
  const [wizard, setWizard] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const activeMachine = useMemo(
    () => state.machines.find((m) => m.id === state.project.machineId) ?? state.machines[0]!,
    [state.project.machineId, state.machines],
  );
  const issues = useMemo(
    () => cutChartIssues(chart, { hasTHC: activeMachine.hasTHC, rapidMmMin: activeMachine.rapidMmMin }),
    [chart, activeMachine],
  );
  const issuesByRow = useMemo(() => {
    const m = new Map<number, ChartIssue[]>();
    for (const i of issues) {
      const list = m.get(i.rowIndex) ?? [];
      list.push(i);
      m.set(i.rowIndex, list);
    }
    return m;
  }, [issues]);

  const grouped = useMemo(() => groupByMaterialNozzle(chart), [chart]);
  const activeKey = selectedMaterialNozzle ?? grouped[0]?.key ?? null;
  const activeGroup = grouped.find((g) => g.key === activeKey);
  const activeRow = selectedRow >= 0 ? chart.rows[selectedRow] : null;

  function close() {
    dispatch({ type: "showCharts", show: false });
  }

  async function doExport() {
    const name = `${chart.id || "cutchart"}.arcflow-chart.json`;
    await saveTextFile(name, serializeCutChart(chart), [
      { name: "ArcFlow cut chart", extensions: ["json"] },
    ]);
  }

  async function doImport() {
    setImportError(null);
    const picked = await openTextFile([{ name: "ArcFlow cut chart", extensions: ["json"] }]);
    if (!picked) return;
    let next: CutChart;
    try {
      next = parseCutChart(picked.text);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
      return;
    }
    // Guard: project needs a row for its preset; without one, the CAM screen crashes.
    const look = lookupCutChart(next, state.project.preset);
    if (!look) {
      setImportError(
        `No row for ${state.project.preset.material} · ${state.project.preset.thicknessMm} mm · ${state.project.preset.currentA} A · nozzle ${state.project.preset.nozzle}`,
      );
      return;
    }
    dispatch({ type: "loadChart", chart: next });
    setSelectedMaterialNozzle(null);
    setSelectedRow(next.rows.findIndex((r) => r.thicknessMm === state.project.preset.thicknessMm && r.nozzle === state.project.preset.nozzle));
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={t("charts.title")}>
      <div className="charts-shell">
        <header className="charts-header">
          <strong>{t("charts.title")}</strong>
          <span className="charts-sub">{t("charts.subtitle", { source: chart.source })}</span>
          {issues.length > 0 && (
            <span className="chip-s chip-warn" title={issues.map((i) => formatIssue(i, t)).join("\n")}>
              {issues.length === 1 ? t("charts.issueCount.one") : t("charts.issueCount", { n: issues.length })}
            </span>
          )}
          <div className="spacer" />
          <button className="btn" onClick={doImport}>{t("charts.import")}</button>
          <button className="btn" onClick={doExport}>{t("charts.export")}</button>
          <button className="btn" onClick={close}>{t("charts.close")}</button>
        </header>
        {importError && (
          <div className="charts-import-error" role="alert">
            {t("charts.importError", { reason: importError })}
          </div>
        )}
        <div className="charts-body">
          <aside className="charts-tree">
            <h3>{t("charts.materials")}</h3>
            {grouped.map((g) => (
              <button
                key={g.key}
                className="tree-row"
                aria-selected={g.key === activeKey}
                onClick={() => { setSelectedMaterialNozzle(g.key); setSelectedRow(g.indices[0] ?? -1); }}
              >
                <span>{g.material} · {t("start.nozzle", { n: g.nozzle })}</span>
                <span className="meta">{g.indices.length}</span>
              </button>
            ))}
          </aside>
          <section className="charts-table-wrap">
            <div className="charts-toolbar">
              <strong>{t("charts.rows")}</strong>
              <div className="spacer" />
              <button
                className="btn primary"
                disabled={!activeRow}
                title={!activeRow ? t("charts.selectRow") : ""}
                onClick={() => setWizard(true)}
              >
                {t("charts.calibrate")}
              </button>
            </div>
            <div className="charts-table-scroll">
              <table className="charts-table">
                <thead>
                  <tr>
                    <th aria-label={t("rules.title")}></th>
                    <th>{t("charts.col.thickness")}</th>
                    <th>{t("charts.col.current")}</th>
                    <th>{t("charts.col.nozzle")}</th>
                    <th>{t("charts.col.kerf")}</th>
                    <th>{t("charts.col.feed")}</th>
                    <th>{t("charts.col.pierceHeight")}</th>
                    <th>{t("charts.col.pierceDelay")}</th>
                    <th>{t("charts.col.cutHeight")}</th>
                    <th>{t("charts.col.voltage")}</th>
                    <th>{t("charts.col.source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeGroup?.indices ?? []).map((idx) => {
                    const r = chart.rows[idx];
                    if (!r) return null;
                    const rowIssues = issuesByRow.get(idx) ?? [];
                    const hasError = rowIssues.some((i) => i.severity === "error");
                    const hasWarn = rowIssues.some((i) => i.severity === "warn");
                    const open = expandedRow === idx;
                    const hasRules = r.rules && Object.keys(r.rules).length > 0;
                    return (
                      <Fragment key={idx}>
                        <tr
                          aria-selected={idx === selectedRow}
                          onClick={() => setSelectedRow(idx)}
                          className={hasError ? "row-error" : hasWarn ? "row-warn" : undefined}
                        >
                          <td className="row-expand">
                            <button
                              className={`chev${open ? " open" : ""}${hasRules ? " has-rules" : ""}`}
                              aria-expanded={open}
                              aria-label={open ? t("rules.hide") : t("rules.show")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRow(open ? null : idx);
                                setSelectedRow(idx);
                              }}
                            >
                              ▸
                            </button>
                          </td>
                          <td>{fmtNum(r.thicknessMm, lang)} mm</td>
                          <td>{r.currentA} A</td>
                          <td>{r.nozzle}</td>
                          <td>{fmtNum(r.kerfMm, lang)} mm</td>
                          <td>{r.feedMmMin} mm/min</td>
                          <td>{fmtNum(r.pierceHeightMm, lang)} mm</td>
                          <td>{fmtNum(r.pierceDelayS, lang)} s</td>
                          <td>{fmtNum(r.cutHeightMm, lang)} mm</td>
                          <td>{r.arcVoltageV !== undefined ? `${r.arcVoltageV} V` : "—"}</td>
                          <td>
                            <span className={`src-chip src-${r.source}`}>{t(`charts.source.${r.source}` as MessageKey)}</span>
                            {r.calibratedAt && <div className="src-date">{t("charts.calibratedAt", { date: r.calibratedAt })}</div>}
                            {r.note && <div className="src-date">{r.note}</div>}
                            {rowIssues.map((i, k) => (
                              <div key={k} className={`row-issue row-issue-${i.severity}`}>{formatIssue(i, t)}</div>
                            ))}
                          </td>
                        </tr>
                        {open && (
                          <tr className="row-expand-body">
                            <td colSpan={11}>
                              <RowRulesEditor index={idx} row={r} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      {wizard && activeRow && (
        <KerfWizard
          row={activeRow}
          rowIndex={selectedRow}
          onClose={() => setWizard(false)}
        />
      )}
    </div>
  );
}

interface Group {
  key: string;
  material: string;
  nozzle: string;
  indices: number[];
}

function formatIssue(i: ChartIssue, t: (k: MessageKey, p?: Record<string, string | number>) => string): string {
  const key = `charts.issue.${i.code}` as MessageKey;
  return t(key, i.params);
}

/** The subset of SynergyRules exposed on screen F. Keep narrow — the rest can be edited via `.json` import. */
const EDITABLE_RULES = [
  "smallHoleK",
  "smallHoleMinMm",
  "smallHoleSpeedPct",
  "leadInK",
  "leadInMinMm",
  "craterMarginMm",
  "thcOffBelowLengthMm",
  "defaultOvercutMm",
] as const satisfies readonly (keyof SynergyRules)[];

function RowRulesEditor({ index, row }: { index: number; row: CutChartRow }) {
  const { dispatch } = useStore();
  const t = useT();
  const lang = useContext(LangContext);
  const rules = row.rules ?? {};

  function setField(k: keyof SynergyRules, v: number | null) {
    const next: Partial<SynergyRules> = { ...rules };
    if (v === null) delete next[k];
    else next[k] = v;
    const patch: Partial<CutChartRow> = Object.keys(next).length ? { rules: next } : { rules: undefined };
    dispatch({ type: "editChartRow", index, patch });
  }

  return (
    <div className="row-rules">
      <div className="row-rules-head">
        <b>{t("rules.title")}</b>
        <small>{t("rules.hint")}</small>
      </div>
      <div className="row-rules-grid">
        {EDITABLE_RULES.map((k) => {
          const def = defaultRules[k];
          const override = rules[k];
          const hasOverride = override !== undefined;
          return (
            <label key={k} className={hasOverride ? "override" : undefined}>
              <span>{t(`rules.${k}` as MessageKey)}</span>
              <span className="field-row">
                <input
                  type="text"
                  inputMode="decimal"
                  value={hasOverride ? fmtNum(override as number, lang, 3) : ""}
                  placeholder={t("rules.default", { v: def })}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) return setField(k, null);
                    const n = parseFloat(raw.replace(",", "."));
                    if (Number.isFinite(n)) setField(k, n);
                  }}
                />
                {hasOverride && (
                  <button className="link" onClick={() => setField(k, null)} title={t("rules.restore")}>↺</button>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function groupByMaterialNozzle(chart: CutChart): Group[] {
  const map = new Map<string, Group>();
  chart.rows.forEach((r, i) => {
    const key = `${r.material}|${r.nozzle}`;
    const g = map.get(key) ?? { key, material: r.material, nozzle: r.nozzle, indices: [] };
    g.indices.push(i);
    map.set(key, g);
  });
  return Array.from(map.values());
}

function KerfWizard({ row, rowIndex, onClose }: { row: CutChartRow; rowIndex: number; onClose: () => void }) {
  const t = useT();
  const lang = useContext(LangContext);
  const { dispatch } = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sq, setSq] = useState(100);
  const [hole, setHole] = useState(20);
  const [mA, setMA] = useState<string>("");
  const [mB, setMB] = useState<string>("");
  const [mH, setMH] = useState<string>("");

  const parsed = {
    a: parseLocaleNumber(mA),
    b: parseLocaleNumber(mB),
    h: parseLocaleNumber(mH),
  };
  const canStep3 = parsed.a !== null && parsed.b !== null && parsed.h !== null;
  const result = canStep3
    ? calibrateKerf({
        nominalSquareMm: sq,
        nominalHoleMm: hole,
        measuredA: parsed.a!,
        measuredB: parsed.b!,
        measuredHole: parsed.h!,
        kerfUsedMm: row.kerfMm,
      })
    : null;
  const spreadWarn = result ? result.spread > 0.1 : false;

  function apply() {
    if (!result) return;
    dispatch({ type: "applyCalibration", index: rowIndex, result });
    onClose();
  }

  return (
    <div className="modal wizard" role="dialog" aria-modal="true" aria-label={t("wizard.title")}>
      <header>
        <strong>{t("wizard.title")}</strong>
        <span className="charts-sub">{t("wizard.step", { n: step })}</span>
        <div className="spacer" />
        <span className="chip-s">{t("wizard.row")}: {t("wizard.row.summary", { material: row.material, t: row.thicknessMm, a: row.currentA, nz: row.nozzle })}</span>
      </header>
      <div className="body">
        {step === 1 && (
          <div className="wizard-step">
            <h4>{t("wizard.step1.title")}</h4>
            <p>{t("wizard.step1.text", { sq, hole, kerf: row.kerfMm })}</p>
            <WizardSample sq={sq} hole={hole} />
            <div className="wizard-fields">
              <NumberField label={t("wizard.sq")} value={sq} onChange={setSq} unit="mm" />
              <NumberField label={t("wizard.hole")} value={hole} onChange={setHole} unit="mm" />
              <NumberField label={t("wizard.kerfUsed")} value={row.kerfMm} onChange={() => {}} unit="mm" readOnly />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="wizard-step">
            <h4>{t("wizard.step2.title")}</h4>
            <p>{t("wizard.step2.text")}</p>
            <WizardSample sq={sq} hole={hole} />
            <div className="wizard-fields">
              <TextField label={t("wizard.measuredA")} value={mA} onChange={setMA} unit="mm" placeholder={fmtNum(sq, lang)} />
              <TextField label={t("wizard.measuredB")} value={mB} onChange={setMB} unit="mm" placeholder={fmtNum(sq, lang)} />
              <TextField label={t("wizard.measuredHole")} value={mH} onChange={setMH} unit="mm" placeholder={fmtNum(hole, lang)} />
            </div>
          </div>
        )}
        {step === 3 && result && (
          <div className="wizard-step">
            <h4>{t("wizard.step3.title")}</h4>
            <div className="wizard-result">
              <div className="result-big">
                <span className="label">{t("wizard.result.kerf")}</span>
                <strong>{fmtNum(result.kerfMm, lang, 3)} mm</strong>
                <span className="charts-sub">{t("wizard.result.delta", { delta: fmtNum(result.kerfMm - row.kerfMm, lang, 3) })}</span>
              </div>
              <div className="result-grid">
                <div><span>{t("wizard.result.fromOuter")}</span><b>{fmtNum(result.fromOuter, lang, 3)} mm</b></div>
                <div><span>{t("wizard.result.fromHole")}</span><b>{fmtNum(result.fromHole, lang, 3)} mm</b></div>
                <div><span>{t("wizard.result.spread")}</span><b>{fmtNum(result.spread, lang, 3)} mm</b></div>
              </div>
              {spreadWarn && (
                <div className="wizard-warn">
                  {t("wizard.result.spreadWarn", { spread: fmtNum(result.spread, lang, 3) })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <footer>
        <div className="wizard-footer">
          <button className="btn" onClick={onClose}>{t("action.cancel")}</button>
          <div className="spacer" />
          {step > 1 && <button className="btn" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>{t("wizard.back")}</button>}
          {step < 3 && (
            <button
              className="btn primary"
              disabled={step === 2 && !canStep3}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            >
              {t("wizard.next")}
            </button>
          )}
          {step === 3 && (
            <button className="btn primary" onClick={apply} disabled={!result}>{t("wizard.apply")}</button>
          )}
        </div>
      </footer>
    </div>
  );
}

function parseLocaleNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function NumberField({ label, value, onChange, unit, readOnly }: { label: string; value: number; onChange: (n: number) => void; unit: string; readOnly?: boolean }) {
  const lang = useContext(LangContext);
  return (
    <label>
      <span>{label}</span>
      <span className="field-row">
        <input
          type="text"
          inputMode="decimal"
          value={fmtNum(value, lang, 3)}
          readOnly={readOnly}
          onChange={(e) => {
            const n = parseLocaleNumber(e.target.value);
            if (n !== null) onChange(n);
          }}
        />
        <em>{unit}</em>
      </span>
    </label>
  );
}

function TextField({ label, value, onChange, unit, placeholder }: { label: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string }) {
  return (
    <label>
      <span>{label}</span>
      <span className="field-row">
        <input type="text" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        <em>{unit}</em>
      </span>
    </label>
  );
}

function WizardSample({ sq, hole }: { sq: number; hole: number }) {
  // Simple schematic — not to scale, just so the operator sees what to cut.
  const r = Math.max(10, (hole / sq) * 60);
  return (
    <svg viewBox="0 0 180 140" width="180" height="140" aria-hidden="true" className="wizard-sample">
      <rect x="20" y="10" width="140" height="120" rx="4" fill="none" stroke="var(--cam-cut)" strokeWidth="2" />
      <circle cx="90" cy="70" r={r / 2} fill="none" stroke="var(--cam-cut)" strokeWidth="2" />
      <text x="90" y="8" textAnchor="middle" fontSize="10" fill="var(--text-3)">A</text>
      <text x="170" y="74" textAnchor="start" fontSize="10" fill="var(--text-3)">B</text>
      <text x="90" y="72" textAnchor="middle" fontSize="9" fill="var(--text-3)">Ø</text>
    </svg>
  );
}
