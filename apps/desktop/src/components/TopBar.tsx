import { useRef } from "react";
import { useStore, machines, projectFromArcflow, projectToArcflow, type Workspace, type Theme } from "../state/store";
import { useT } from "../i18n";
import { openTextFile, saveTextFile } from "../platform/save";
import type { Mode } from "@arcflow/core";

/** Row 1: logo, project, menus, Export. Row 2: workspaces, preset chip, mode switch, Generuj (design: every screen). */
export function TopBar({ blocked }: { blocked: boolean }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const file = useRef<HTMLInputElement>(null);
  const p = state.project;
  const workspaces: Workspace[] = ["start", "sketch", "cam", "nesting", "sim", "export"];
  const modes: Mode[] = ["synergic", "assisted", "manual"];
  const themes: Theme[] = ["dark", "light", "ultra-dark"];

  return (
    <>
      <div className="menubar">
        <div className="logo"><i /></div>
        <span style={{ margin: "0 12px 0 8px" }}>{p.name}</span>
        {(["menu.file", "menu.edit", "menu.view", "menu.help"] as const).map((k) => (
          <button key={k} className="menu-item">{t(k)}</button>
        ))}
        <button className="menu-item" onClick={() => file.current?.click()}>{t("action.importDxf")}</button>
        <input
          ref={file}
          type="file"
          accept=".dxf"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              dispatch({ type: "stageDxf", text: await f.text(), name: f.name });
              e.target.value = "";
            }
          }}
        />
        <button
          className="menu-item"
          onClick={async () => {
            const picked = await openTextFile([{ name: "ArcFlow project", extensions: ["arcflow", "json"] }]);
            if (!picked) return;
            try {
              dispatch({ type: "loadProject", project: projectFromArcflow(picked.text) });
            } catch (err) {
              console.error("Failed to open project", err);
            }
          }}
        >
          {t("action.openProject")}
        </button>
        <button
          className="menu-item"
          onClick={() => saveTextFile(`${p.name}.arcflow`, projectToArcflow(p), [{ name: "ArcFlow project", extensions: ["arcflow"] }])}
        >
          {t("action.saveProject")}
        </button>
        <button className="menu-item" onClick={() => dispatch({ type: "showCharts", show: true })}>
          {t("charts.open")}
        </button>
        <div className="spacer" />
        <select value={state.theme} onChange={(e) => dispatch({ type: "setTheme", theme: e.target.value as Theme })} aria-label="Theme">
          {themes.map((th) => <option key={th} value={th}>{th}</option>)}
        </select>
        <button className="btn primary" onClick={() => dispatch({ type: "showExport", show: true })} title={blocked ? t("status.blocked") : ""}>
          {t("action.export")}
        </button>
      </div>
      <div className="toolbar">
        <div className="seg" role="tablist">
          {workspaces.map((w) => (
            <button key={w} aria-pressed={state.workspace === w} onClick={() => dispatch({ type: "setWorkspace", ws: w })}>
              {t(`ws.${w}` as const)}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className="chip">
          <select value={p.machineId} onChange={(e) => dispatch({ type: "setMachine", id: e.target.value })} style={{ border: 0, background: "none", padding: 0 }}>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          · <b>{p.preset.material}</b> · <b>{p.preset.thicknessMm} mm</b> · <b>{p.preset.currentA} A</b>
        </span>
        <div className="seg" style={{ marginLeft: 8 }}>
          {modes.map((m) => (
            <button key={m} aria-pressed={p.mode === m} onClick={() => dispatch({ type: "setMode", mode: m })}>
              {t(`mode.${m}` as const)}
            </button>
          ))}
        </div>
        <button className="btn primary" style={{ marginLeft: 8 }} onClick={() => dispatch({ type: "generate" })}>
          {t("action.generate")}
        </button>
      </div>
    </>
  );
}
