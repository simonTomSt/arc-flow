import { useRef, useState, type DragEvent } from "react";
import { machines, projectFromArcflow, useStore, type Lang, type Theme } from "../state/store";
import { useT } from "../i18n";
import { openTextFile, openTextFiles } from "../platform/save";
import type { Mode } from "@arcflow/core";

/**
 * Design screen A — Start. Big drop zone, machine cards, defaults, language.
 * The actual DXF import is staged on the store (`stageDxf`) so the next
 * screen is the Import report, not CAM.
 */
export function StartScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modes: Mode[] = ["synergic", "assisted", "manual"];
  const langs: Lang[] = ["pl", "en"];
  const themes: Theme[] = ["dark", "light", "ultra-dark"];

  async function stageFiles(files: File[]) {
    for (const f of files) {
      if (!/\.dxf$/i.test(f.name)) continue;
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
        <section className="start-card drop" data-dragging={dragging} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => fileInput.current?.click()}>
          <h2>{t("start.title")}</h2>
          <p>{t("start.drop")}</p>
          <input ref={fileInput} type="file" accept=".dxf" multiple hidden onChange={async (e) => { await stageFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </section>

        <section className="start-card">
          <h3>{t("start.recent")}</h3>
          <RecentProjects />
        </section>

        <section className="start-card">
          <h3>{t("start.machines")}</h3>
          <div className="machine-cards">
            {machines.map((m) => (
              <button key={m.id} className="machine-card" aria-pressed={state.project.machineId === m.id} onClick={() => dispatch({ type: "setMachine", id: m.id })}>
                <b>{m.name}</b>
                <span>{m.hasTHC ? "THC" : "bez THC"} · {m.swirl}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="start-card">
          <h3>{t("start.material")}</h3>
          <div className="chip" style={{ display: "flex" }}>
            <b>{state.project.preset.material}</b> · <b>{state.project.preset.thicknessMm} mm</b> · <b>{state.project.preset.currentA} A</b> · dysza {state.project.preset.nozzle}
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
        </section>
      </div>
    </div>
  );
}

function RecentProjects() {
  const { dispatch } = useStore();
  const t = useT();

  // Recent-project memory lives in localStorage; the Start screen only exposes "open" for now.
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button className="btn" onClick={async () => {
        const picked = await openTextFile([{ name: "ArcFlow project", extensions: ["arcflow", "json"] }]);
        if (!picked) return;
        try {
          dispatch({ type: "loadProject", project: projectFromArcflow(picked.text) });
        } catch (err) {
          console.error("Failed to open project", err);
        }
      }}>{t("action.openProject")}</button>
      <button className="btn" onClick={async () => {
        const files = await openTextFiles([{ name: "DXF", extensions: ["dxf"] }]);
        for (const f of files) {
          dispatch({ type: "stageDxf", text: f.text, name: f.name });
          break;
        }
      }}>{t("action.importDxf")}</button>
      <span className="auto" style={{ color: "var(--text-3)" }}>{t("start.recentEmpty")}</span>
    </div>
  );
}
