import { useContext, useRef, useState, type DragEvent } from "react";
import { lookupCutChart } from "@arcflow/core";
import { machines, projectFromArcflow, useStore, type Lang, type RecentProject, type Theme } from "../state/store";
import { LangContext, fmtNum, useT } from "../i18n";
import { openTextFile, openTextFiles } from "../platform/save";
import type { Mode } from "@arcflow/core";

/**
 * Design screen A — Start. Drop zone (DXF/SVG, several files → one sheet),
 * recent projects with status chips, machine cards, defaults, mode / language /
 * touch / theme / last export path. The actual DXF import is staged on the
 * store (`stageDxf`) so the next screen is the Import report, not CAM.
 */
export function StartScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const lang = useContext(LangContext);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modes: Mode[] = ["synergic", "assisted", "manual"];
  const langs: Lang[] = ["pl", "en"];
  const themes: Theme[] = ["dark", "light", "ultra-dark"];
  const preset = state.project.preset;
  const chartRow = lookupCutChart(state.chart, preset)?.row;

  async function stageFiles(files: File[]) {
    for (const f of files) {
      if (!/\.(dxf|svg)$/i.test(f.name)) continue;
      dispatch({ type: "stageDxf", text: await f.text(), name: f.name });
      // Only stage one at a time — Import report screen will append the rest.
      break;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    void stageFiles(files);
  }

  return (
    <div className="start-wrap">
      <div className="start-grid">
        <section
          className="start-card drop"
          data-dragging={dragging}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
        >
          <h2>{t("start.title")}</h2>
          <p>{t("start.drop")}</p>
          <div className="drop-ctas">
            <button className="btn" disabled title={t("placeholder.notYet")} onClick={(e) => e.stopPropagation()}>{t("start.newSketch")}</button>
            <button className="btn" disabled title={t("placeholder.notYet")} onClick={(e) => e.stopPropagation()}>{t("start.readyShapes")}</button>
          </div>
          <input ref={fileInput} type="file" accept=".dxf,.svg" multiple hidden onChange={async (e) => { await stageFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </section>

        <section className="start-card">
          <div className="start-card-head">
            <h3>{t("start.recent")}</h3>
            {state.recent.length > 0 && (
              <button className="link" onClick={() => dispatch({ type: "clearRecent" })}>{t("start.recentClear")}</button>
            )}
          </div>
          <RecentProjects />
        </section>

        <section className="start-card">
          <h3>{t("start.machines")}</h3>
          <div className="machine-cards">
            {machines.map((m) => (
              <button key={m.id} className="machine-card" aria-pressed={state.project.machineId === m.id} onClick={() => dispatch({ type: "setMachine", id: m.id })}>
                <b>{m.name}</b>
                <span>{m.controller} · {m.hasTHC ? "THC" : "bez THC"} · {m.swirl}</span>
              </button>
            ))}
            <button className="machine-card add" disabled title={t("placeholder.notYet")}>
              <b>{t("start.addMachine")}</b>
            </button>
          </div>
        </section>

        <section className="start-card">
          <h3>{t("start.material")}</h3>
          <div className="material-chip">
            <div className="row">
              <b>{preset.material}</b> · <b>{preset.thicknessMm} mm</b> · <b>{preset.currentA} A</b> · {t("start.nozzle", { n: preset.nozzle })}
            </div>
            {chartRow && (
              <div className="row sub">
                <span>{t("start.kerf", { mm: fmtNum(chartRow.kerfMm, lang, 2) })}</span>
                <span>·</span>
                <span>{t("start.speed", { v: Math.round(chartRow.feedMmMin) })}</span>
                <span>·</span>
                <span>{chartRow.calibratedAt ? t("start.calibratedAt", { date: fmtShortDate(chartRow.calibratedAt, lang) }) : t("start.calibratedNever")}</span>
              </div>
            )}
          </div>

          <h3 style={{ marginTop: 14 }}>{t("start.mode")}</h3>
          <div className="seg">
            {modes.map((m) => (
              <button key={m} aria-pressed={state.project.mode === m} onClick={() => dispatch({ type: "setMode", mode: m })}>{t(`mode.${m}` as const)}</button>
            ))}
          </div>

          <h3 style={{ marginTop: 14 }}>{t("start.lang")}</h3>
          <div className="seg">
            {langs.map((l) => (
              <button key={l} aria-pressed={state.lang === l} onClick={() => dispatch({ type: "setLang", lang: l })}>{l.toUpperCase()}</button>
            ))}
          </div>

          <h3 style={{ marginTop: 14 }}>{t("start.touch")}</h3>
          <label className="prop" style={{ padding: 0 }}>
            <input type="checkbox" checked={state.touch} onChange={(e) => dispatch({ type: "setTouch", touch: e.target.checked })} />
            <span className="auto">{state.touch ? "on" : "off"}</span>
          </label>

          <h3 style={{ marginTop: 14 }}>Theme</h3>
          <div className="seg">
            {themes.map((th) => (
              <button key={th} aria-pressed={state.theme === th} onClick={() => dispatch({ type: "setTheme", theme: th })}>{th}</button>
            ))}
          </div>

          <h3 style={{ marginTop: 14 }}>{t("start.lastExport")}</h3>
          <div className="auto" style={{ color: "var(--text-3)", wordBreak: "break-all" }}>
            {state.lastExportPath ?? t("start.lastExportNone")}
          </div>
        </section>
      </div>
    </div>
  );
}

function fmtShortDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return lang === "pl" ? `${dd}.${mm}` : `${mm}/${dd}`;
}

function RecentProjects() {
  const { state, dispatch } = useStore();
  const t = useT();

  async function openProject() {
    const picked = await openTextFile([{ name: "ArcFlow project", extensions: ["arcflow", "json"] }]);
    if (!picked) return;
    try {
      dispatch({ type: "loadProject", project: projectFromArcflow(picked.text), path: picked.path });
    } catch (err) {
      console.error("Failed to open project", err);
    }
  }

  async function pickDxf() {
    const files = await openTextFiles([{ name: "DXF", extensions: ["dxf"] }]);
    for (const f of files) {
      dispatch({ type: "stageDxf", text: f.text, name: f.name });
      break;
    }
  }

  if (state.recent.length === 0) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <button className="btn" onClick={openProject}>{t("action.openProject")}</button>
        <button className="btn" onClick={pickDxf}>{t("action.importDxf")}</button>
        <span className="auto" style={{ color: "var(--text-3)" }}>{t("start.recentEmpty")}</span>
      </div>
    );
  }

  return (
    <div className="recent-list">
      {state.recent.map((r) => <RecentRow key={r.path} r={r} />)}
      <div className="recent-ctas">
        <button className="btn" onClick={openProject}>{t("action.openProject")}</button>
        <button className="btn" onClick={pickDxf}>{t("action.importDxf")}</button>
      </div>
    </div>
  );
}

function RecentRow({ r }: { r: RecentProject }) {
  const { dispatch } = useStore();
  const t = useT();
  async function reopen() {
    try {
      // In the browser we don't have the original File — fall back to the open dialog.
      const picked = await openTextFile([{ name: "ArcFlow project", extensions: ["arcflow", "json"] }]);
      if (!picked) return;
      dispatch({ type: "loadProject", project: projectFromArcflow(picked.text), path: picked.path });
    } catch (err) {
      console.error("Failed to open project", err);
    }
  }
  return (
    <button className="recent-row" onClick={reopen} title={r.path}>
      <div className="recent-thumb" aria-hidden>
        <svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="16" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="22" cy="16" r="1.5" fill="currentColor" /></svg>
      </div>
      <div className="recent-meta">
        <b>{r.name}</b>
        <span className="auto">{new Date(r.openedAt).toLocaleDateString()}</span>
      </div>
      {r.status && <span className="recent-chip">{r.status}</span>}
      {!r.status && <span className="recent-chip neutral">{t("start.status.exported")}</span>}
    </button>
  );
}
