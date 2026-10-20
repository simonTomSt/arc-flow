import { useContext, useMemo, useState } from "react";
import { parseNozzles, serializeNozzles, type Nozzle, type NozzleLibrary } from "@arcflow/core";
import { useStore } from "../state/store";
import { LangContext, fmtNum, useT } from "../i18n";
import { openTextFile, saveTextFile } from "../platform/save";

/**
 * Design screen L1 — Nozzle library. Overlay modal:
 *  1. Libraries rail (Dysze selected; Maszyny / Tabele open their overlays).
 *  2. Nozzle list with "Dodaj dyszę".
 *  3. Right editor + "Używana w tabelach" / "Pozwolono na maszynach" lists derived
 *     from state.chart and state.machines so changes aren't fictional.
 */
export function NozzlesScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const [selectedId, setSelectedId] = useState<string>(() => state.nozzles.nozzles[0]?.id ?? "");
  const [importError, setImportError] = useState<string | null>(null);

  const selected = state.nozzles.nozzles.find((n) => n.id === selectedId) ?? state.nozzles.nozzles[0]!;

  const chartUsage = useMemo(() => {
    const rows = state.chart.rows.filter((r) => r.nozzle === selected.label);
    return rows.length;
  }, [state.chart, selected.label]);

  function close() {
    dispatch({ type: "showNozzles", show: false });
  }
  function openCharts() {
    dispatch({ type: "showNozzles", show: false });
    dispatch({ type: "showCharts", show: true });
  }
  function openMachines() {
    dispatch({ type: "showNozzles", show: false });
    dispatch({ type: "showMachines", show: true });
  }
  function update(patch: Partial<Nozzle>) {
    dispatch({ type: "upsertNozzle", nozzle: { ...selected, ...patch } });
  }
  function add() {
    const used = new Set(state.nozzles.nozzles.map((n) => n.id));
    let i = state.nozzles.nozzles.length + 1;
    let id = `n-new-${i}`;
    while (used.has(id)) id = `n-new-${++i}`;
    const n: Nozzle = { id, label: "nowa", diameterMm: 1.0, defaultKerfMm: 1.4 };
    dispatch({ type: "upsertNozzle", nozzle: n });
    setSelectedId(id);
  }
  function remove() {
    if (state.nozzles.nozzles.length <= 1) return;
    dispatch({ type: "deleteNozzle", id: selected.id });
    setSelectedId(state.nozzles.nozzles.find((n) => n.id !== selected.id)!.id);
  }
  async function doExport() {
    await saveTextFile(`${state.nozzles.id || "nozzles"}.arcflow-nozzles.json`, serializeNozzles(state.nozzles), [
      { name: "ArcFlow nozzle library", extensions: ["json"] },
    ]);
  }
  async function doImport() {
    setImportError(null);
    const picked = await openTextFile([{ name: "ArcFlow nozzle library", extensions: ["json"] }]);
    if (!picked) return;
    let next: NozzleLibrary;
    try {
      next = parseNozzles(picked.text);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
      return;
    }
    dispatch({ type: "loadNozzles", library: next });
    setSelectedId(next.nozzles[0]?.id ?? "");
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={t("nozzles.title")}>
      <div className="machines-shell">
        <header className="charts-header">
          <strong>{t("nozzles.title")}</strong>
          <span className="charts-sub">{t("nozzles.subtitle")}</span>
          <div className="spacer" />
          <button className="btn" onClick={doImport}>{t("nozzles.import")}</button>
          <button className="btn" onClick={doExport}>{t("nozzles.export")}</button>
          <button className="btn" onClick={close}>{t("charts.close")}</button>
        </header>
        {importError && (
          <div className="charts-import-error" role="alert">
            {t("nozzles.importError", { reason: importError })}
          </div>
        )}
        <div className="machines-body">
          <aside className="library-rail">
            <h3>{t("library.nav")}</h3>
            <button className="tree-row" aria-selected onClick={() => undefined}>
              <span>{t("nozzles.open")}</span>
            </button>
            <button className="tree-row" onClick={openMachines}>
              <span>{t("machines.open")}</span>
            </button>
            <button className="tree-row" onClick={openCharts}>
              <span>{t("charts.open")}</span>
            </button>
          </aside>
          <aside className="machines-list">
            <div className="list-section-head">{t("nozzles.list")}</div>
            {state.nozzles.nozzles.map((n) => {
              const rows = state.chart.rows.filter((r) => r.nozzle === n.label).length;
              return (
                <button
                  key={n.id}
                  className="machine-row"
                  aria-selected={n.id === selected.id}
                  onClick={() => setSelectedId(n.id)}
                >
                  <b>Ø {n.label}</b>
                  <span>k ≈ {n.defaultKerfMm} mm{rows > 0 ? " · " + t("nozzles.chipRow", { rows }) : ""}</span>
                </button>
              );
            })}
            <button className="machine-row template" onClick={add}>
              <b>+ {t("nozzles.add")}</b>
            </button>
          </aside>
          <section className="machine-editor">
            <div className="editor-head">
              <div>
                <strong>Ø {selected.label}</strong>
                <div className="charts-sub">{selected.diameterMm} mm · k ≈ {selected.defaultKerfMm} mm</div>
              </div>
              <div className="spacer" />
              <button
                className="btn danger"
                onClick={remove}
                disabled={state.nozzles.nozzles.length <= 1}
                title={state.nozzles.nozzles.length <= 1 ? t("nozzles.lastOne") : ""}
              >
                {t("nozzles.delete")}
              </button>
            </div>
            <div className="editor-grid">
              <fieldset className="editor-section">
                <legend>{t("machines.section.general")}</legend>
                <label>
                  <span>{t("nozzles.field.label")}</span>
                  <input type="text" value={selected.label} onChange={(e) => update({ label: e.target.value })} />
                </label>
                <label>
                  <span>{t("nozzles.field.diameter")}</span>
                  <NumInput value={selected.diameterMm} unit="mm" onChange={(v) => update({ diameterMm: v })} digits={2} />
                </label>
                <label>
                  <span>{t("nozzles.field.defaultKerf")}</span>
                  <NumInput value={selected.defaultKerfMm} unit="mm" onChange={(v) => update({ defaultKerfMm: v })} digits={3} />
                </label>
                <label>
                  <span>{t("nozzles.field.note")}</span>
                  <input type="text" value={selected.note ?? ""} onChange={(e) => update({ note: e.target.value || undefined })} />
                </label>
              </fieldset>
              <fieldset className="editor-section">
                <legend>{t("nozzles.field.currentBand")}</legend>
                <label>
                  <span>{t("nozzles.field.currentMin")}</span>
                  <NumInput
                    value={selected.currentBand?.minA ?? 0}
                    unit="A"
                    digits={0}
                    onChange={(v) => update({ currentBand: { minA: v, maxA: selected.currentBand?.maxA ?? v } })}
                  />
                </label>
                <label>
                  <span>{t("nozzles.field.currentMax")}</span>
                  <NumInput
                    value={selected.currentBand?.maxA ?? 0}
                    unit="A"
                    digits={0}
                    onChange={(v) => update({ currentBand: { minA: selected.currentBand?.minA ?? v, maxA: v } })}
                  />
                </label>
              </fieldset>
              <fieldset className="editor-section preview">
                <legend>{t("nozzles.usedBy.charts")}</legend>
                {chartUsage > 0 ? (
                  <div className="charts-sub">
                    <b>{state.chart.name}</b> — {t("nozzles.chipRow", { rows: chartUsage })}
                  </div>
                ) : (
                  <div className="charts-sub">{t("nozzles.usedBy.charts.none")}</div>
                )}
                <div className="preview-explain">
                  <b>{t("nozzles.usedBy.machines")}</b>
                  <div>{t("nozzles.usedBy.machines.hint")}</div>
                </div>
              </fieldset>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NumInput({ value, unit, onChange, digits = 1 }: { value: number; unit: string; onChange: (n: number) => void; digits?: number }) {
  const lang = useContext(LangContext);
  return (
    <span className="field-row">
      <input
        type="text"
        inputMode="decimal"
        value={fmtNum(value, lang, digits)}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(",", "."));
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      <em>{unit}</em>
    </span>
  );
}
