import { useContext, useMemo, useState } from "react";
import { machinePreviewToolpath, lookupCutChart, type MachineProfile } from "@arcflow/core";
import { getPost, runPost } from "@arcflow/post";
import { allPosts, machineTemplates, useStore } from "../state/store";
import { LangContext, fmtNum, useT } from "../i18n";

/**
 * Design screen L2 — Machine profiles. Overlay modal. Three columns:
 *  1. Libraries rail (Maszyny selected; Tabele cięcia opens F; others disabled).
 *  2. "Moje maszyny" list + "Szablony" + "Nowa z szablonu".
 *  3. Editor for the selected machine + "Co z tego wynika" G-code preview run
 *     through the real post so toggles update it live.
 * ArcFlow never talks to the machine — the subtitle in the header says so.
 */
export function MachinesScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const [selectedId, setSelectedId] = useState<string>(() => state.project.machineId);

  const selected = state.machines.find((m) => m.id === selectedId) ?? state.machines[0]!;
  const inUse = state.project.machineId === selected.id;

  function close() {
    dispatch({ type: "showMachines", show: false });
  }
  function openCharts() {
    dispatch({ type: "showMachines", show: false });
    dispatch({ type: "showCharts", show: true });
  }
  function openNozzles() {
    dispatch({ type: "showMachines", show: false });
    dispatch({ type: "showNozzles", show: true });
  }
  function update(patch: Partial<MachineProfile>) {
    dispatch({ type: "upsertMachine", machine: { ...selected, ...patch } });
  }
  function nextIdFor(baseId: string): string {
    const taken = new Set(state.machines.map((m) => m.id));
    if (!taken.has(baseId)) return baseId;
    for (let i = 2; i < 999; i++) {
      const id = `${baseId}-${i}`;
      if (!taken.has(id)) return id;
    }
    return `${baseId}-${Date.now()}`;
  }
  function duplicate() {
    const name = `${selected.name} ${t("machines.newNameSuffix")}`;
    dispatch({ type: "newMachineFromTemplate", template: selected, name });
    setSelectedId(nextIdFor(selected.id));
  }
  function removeSelected() {
    if (state.machines.length <= 1) return;
    if (inUse) return;
    if (!confirm(t("machines.deleteConfirm", { name: selected.name }))) return;
    dispatch({ type: "deleteMachine", id: selected.id });
    setSelectedId(state.machines.find((m) => m.id !== selected.id)!.id);
  }
  function newFromTemplate(tpl: MachineProfile) {
    const name = `${tpl.name} ${t("machines.newNameSuffix")}`;
    dispatch({ type: "newMachineFromTemplate", template: tpl, name });
    setSelectedId(nextIdFor(tpl.id));
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={t("machines.title")}>
      <div className="machines-shell">
        <header className="charts-header">
          <strong>{t("machines.title")}</strong>
          <span className="charts-sub">{t("machines.subtitle")}</span>
          <div className="spacer" />
          <button className="btn" onClick={close}>{t("charts.close")}</button>
        </header>
        <div className="machines-body">
          <aside className="library-rail">
            <h3>{t("library.nav")}</h3>
            <button className="tree-row" onClick={openNozzles}>
              <span>{t("nozzles.open")}</span>
            </button>
            <button className="tree-row" aria-selected onClick={() => undefined}>
              <span>{t("machines.open")}</span>
            </button>
            <button className="tree-row" onClick={openCharts}>
              <span>{t("charts.open")}</span>
            </button>
            <button className="tree-row" onClick={() => { dispatch({ type: "showMachines", show: false }); dispatch({ type: "showPosts", show: true }); }}>
              <span>{t("posts.open")}</span>
            </button>
          </aside>
          <aside className="machines-list">
            <div className="list-section-head">{t("machines.myMachines")}</div>
            {state.machines.map((m) => (
              <button
                key={m.id}
                className="machine-row"
                aria-selected={m.id === selected.id}
                onClick={() => setSelectedId(m.id)}
              >
                <b>{m.name}</b>
                <span>{m.controller}{m.hasTHC ? " · THC" : ""}{state.project.machineId === m.id ? " · " + t("machines.active") : ""}</span>
              </button>
            ))}
            <div className="list-section-head">{t("machines.templates")}</div>
            {machineTemplates.map((tpl) => (
              <button key={`tpl-${tpl.id}`} className="machine-row template" onClick={() => newFromTemplate(tpl)}>
                <b>{tpl.name}</b>
                <span>{tpl.controller}{tpl.hasTHC ? " · THC" : ""}</span>
              </button>
            ))}
          </aside>
          <section className="machine-editor">
            <div className="editor-head">
              <div>
                <strong>{selected.name}</strong>
                <div className="charts-sub">
                  {selected.controller}
                  {selected.hasTHC ? " · THC" : ""}
                  {selected.marker ? " · " + t("machines.field.marker") : ""}
                </div>
              </div>
              <div className="spacer" />
              <button className="btn" onClick={duplicate}>{t("machines.duplicate")}</button>
              <button
                className="btn danger"
                onClick={removeSelected}
                disabled={inUse || state.machines.length <= 1}
                title={inUse ? t("machines.cannotDeleteInUse") : state.machines.length <= 1 ? t("machines.lastOne") : ""}
              >
                {t("machines.delete")}
              </button>
            </div>
            <div className="editor-grid">
              <GeneralSection machine={selected} onChange={update} />
              <EquipmentSection machine={selected} onChange={update} />
              <GcodeSection machine={selected} onChange={update} />
              <PreviewSection machine={selected} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  machine: MachineProfile;
  onChange: (p: Partial<MachineProfile>) => void;
}

function GeneralSection({ machine, onChange }: SectionProps) {
  const t = useT();
  return (
    <fieldset className="editor-section">
      <legend>{t("machines.section.general")}</legend>
      <label>
        <span>{t("machines.field.name")}</span>
        <input type="text" value={machine.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label>
        <span>{t("machines.field.description")}</span>
        <input type="text" value={machine.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
    </fieldset>
  );
}

function EquipmentSection({ machine, onChange }: SectionProps) {
  const t = useT();
  return (
    <fieldset className="editor-section">
      <legend>{t("machines.section.equipment")}</legend>
      <Toggle
        label={t("machines.field.thc")}
        hint={t("machines.field.thc.hint")}
        value={machine.hasTHC}
        onChange={(v) => onChange({ hasTHC: v })}
      />
      <Toggle
        label={t("machines.field.heightsInProgram")}
        hint={t("machines.field.heightsInProgram.hint")}
        value={machine.heightsInProgram}
        onChange={(v) => onChange({ heightsInProgram: v })}
      />
      <label>
        <span>{t("machines.field.travelHeight")}</span>
        <NumInput value={machine.travelHeightMm} unit="mm" onChange={(v) => onChange({ travelHeightMm: v })} />
      </label>
      <label>
        <span>{t("machines.field.ihs")}</span>
        <select value={machine.ihs} onChange={(e) => onChange({ ihs: e.target.value as MachineProfile["ihs"] })}>
          <option value="none">{t("machines.field.ihs.none")}</option>
          <option value="beforePierce">{t("machines.field.ihs.beforePierce")}</option>
          <option value="everyN">{t("machines.field.ihs.everyN")}</option>
        </select>
      </label>
      <Toggle
        label={t("machines.field.marker")}
        hint={t("machines.field.marker.hint")}
        value={machine.marker !== undefined}
        onChange={(v) => onChange({ marker: v ? (machine.marker ?? { offsetXMm: 0, offsetYMm: 0 }) : undefined })}
      />
      {machine.marker && (
        <label>
          <span>{t("machines.field.markerOffset")}</span>
          <span className="pair">
            <NumInput value={machine.marker.offsetXMm} unit="mm" onChange={(v) => onChange({ marker: { ...machine.marker!, offsetXMm: v } })} />
            <NumInput value={machine.marker.offsetYMm} unit="mm" onChange={(v) => onChange({ marker: { ...machine.marker!, offsetYMm: v } })} />
          </span>
        </label>
      )}
      <label>
        <span>{t("machines.field.workArea")}</span>
        <span className="pair">
          <NumInput value={machine.workAreaMm.x} unit="mm" onChange={(v) => onChange({ workAreaMm: { ...machine.workAreaMm, x: v } })} />
          <NumInput value={machine.workAreaMm.y} unit="mm" onChange={(v) => onChange({ workAreaMm: { ...machine.workAreaMm, y: v } })} />
        </span>
      </label>
      <label>
        <span>{t("machines.field.rapid")}</span>
        <NumInput value={machine.rapidMmMin} unit="mm/min" onChange={(v) => onChange({ rapidMmMin: v })} digits={0} />
      </label>
      <label>
        <span>{t("machines.field.swirl")}</span>
        <select value={machine.swirl} onChange={(e) => onChange({ swirl: e.target.value as "CW" | "CCW" })}>
          <option value="CW">{t("machines.field.swirl.cw")}</option>
          <option value="CCW">{t("machines.field.swirl.ccw")}</option>
        </select>
      </label>
      <label>
        <span>{t("machines.field.origin")}</span>
        <select value={machine.origin} onChange={(e) => onChange({ origin: e.target.value as MachineProfile["origin"] })}>
          <option value="top-left">{t("machines.field.origin.topLeft")}</option>
          <option value="bottom-left">{t("machines.field.origin.bottomLeft")}</option>
        </select>
      </label>
      <Toggle
        label={t("machines.field.compensation")}
        value={machine.controllerCompensation}
        onChange={(v) => onChange({ controllerCompensation: v })}
      />
    </fieldset>
  );
}

function GcodeSection({ machine, onChange }: SectionProps) {
  const t = useT();
  const { state, dispatch } = useStore();
  const posts = allPosts(state);
  return (
    <fieldset className="editor-section">
      <legend>{t("machines.section.gcode")}</legend>
      <label>
        <span>{t("machines.field.post")}</span>
        <span className="pair">
          <select value={machine.postId} onChange={(e) => onChange({ postId: e.target.value, controller: controllerForPost(e.target.value, posts) })}>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn" onClick={() => { dispatch({ type: "showMachines", show: false }); dispatch({ type: "showPosts", show: true }); }}>
            {t("posts.open")}
          </button>
        </span>
      </label>
    </fieldset>
  );
}

function controllerForPost(postId: string, posts: ReturnType<typeof allPosts>): MachineProfile["controller"] {
  const p = posts.find((x) => x.id === postId);
  return p?.controller ?? "F2100K";
}

function PreviewSection({ machine }: { machine: MachineProfile }) {
  const { state } = useStore();
  const t = useT();
  const result = useMemo(() => {
    try {
      const post = getPost(machine.postId, state.posts);
      const look = lookupCutChart(state.chart, state.project.preset);
      if (!look) return null;
      const tp = machinePreviewToolpath();
      return runPost(post, tp, {
        projectName: "preview",
        preset: state.project.preset,
        row: look.row,
        machine,
        sheet: state.project.sheet,
      });
    } catch {
      return null;
    }
  }, [machine, state.chart, state.project.preset, state.project.sheet]);

  if (!result) {
    return (
      <fieldset className="editor-section preview">
        <legend>{t("machines.section.preview")}</legend>
        <div className="charts-sub">{t("machines.preview.empty")}</div>
      </fieldset>
    );
  }

  return (
    <fieldset className="editor-section preview">
      <legend>{t("machines.section.preview")}</legend>
      <div className="preview-label">{t("machines.preview.header")}</div>
      <pre className="preview-code">
        {result.lines.map((l, i) => (
          <div key={i} className={`preview-line src-${result.sources[i]}`}>{l}</div>
        ))}
      </pre>
      <div className="preview-explain">
        {!machine.hasTHC && <div>{t("machines.preview.explain.thc")}</div>}
        {!machine.heightsInProgram && <div>{t("machines.preview.explain.heights")}</div>}
      </div>
      {result.warnings.length > 0 && (
        <div className="preview-warn">
          <b>{t("machines.warnings")}</b>
          <ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
    </fieldset>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-copy">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
    </label>
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

