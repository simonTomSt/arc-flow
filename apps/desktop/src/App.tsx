import { useEffect, useState } from "react";
import { blocksExport } from "@arcflow/core";
import { useStore, useDerived } from "./state/store";
import { TopBar } from "./components/TopBar";
import { Browser } from "./components/Browser";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { OrderBar } from "./components/OrderBar";
import { StatusBar } from "./components/StatusBar";
import { ExportDialog } from "./components/ExportDialog";
import { StartScreen } from "./components/StartScreen";
import { ImportReportScreen } from "./components/ImportReportScreen";
import { ToolStrip, type Tool } from "./components/ToolStrip";
import { ToolCard } from "./components/ToolCard";
import { ProblemsPanel } from "./components/ProblemsPanel";
import { ChartsScreen } from "./components/ChartsScreen";
import { MachinesScreen } from "./components/MachinesScreen";
import { NozzlesScreen } from "./components/NozzlesScreen";
import { CamCanvas } from "./canvas/CamCanvas";
import { useT } from "./i18n";

export function App() {
  const { state, dispatch } = useStore();
  const d = useDerived(state);
  const t = useT();
  const op = d.ops.find((o) => o.contourId === state.selectedContourId);
  const [tool, setTool] = useState<Tool>("select");

  // The pending-import screen takes over the whole workspace until the operator decides.
  const screen = state.pendingImport ? "import" : state.workspace;

  // Global shortcuts for the CAM tool strip. Modifier-free, ignored when typing in inputs.
  useEffect(() => {
    if (screen !== "cam") return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "v": setTool("select"); break;
        case "l": setTool("leadIn"); break;
        case "k": setTool("corners"); break;
        case "r": setTool("position"); break;
        case "b": setTool("bridge"); break;
        case "escape": setTool("select"); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen]);

  return (
    <div className="app" data-theme={state.theme} data-touch={state.touch}>
      <TopBar blocked={blocksExport(d.issues)} />
      {screen === "import" ? (
        <ImportReportScreen />
      ) : screen === "start" ? (
        <StartScreen />
      ) : screen === "cam" ? (
        <div className="main cam">
          <Browser ops={d.ops} />
          <ToolStrip active={tool} onPick={setTool} />
          <div className="canvas-wrap">
            <CamCanvas
              contours={state.project.contours}
              ops={d.ops}
              toolpath={d.toolpath}
              sheet={state.project.sheet}
              selectedId={state.selectedContourId}
              showOrder
              onSelect={(id) => dispatch({ type: "select", id })}
            />
            {tool === "leadIn" && op && (
              <ToolCard
                title={t("tool.leadIn")}
                shortcut="L"
                hint={t("toolCard.leadIn.hint")}
                onCancel={() => setTool("select")}
                onConfirm={() => setTool("select")}
              >
                <div className="prop">
                  <label className="tip">{t("props.length")}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={op.leadIn.value.lengthMm}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value.replace(",", "."));
                      if (!Number.isNaN(v)) dispatch({ type: "override", contourId: op.contourId, patch: { leadIn: { ...op.leadIn.value, lengthMm: v } } });
                    }}
                    style={{ width: 80, textAlign: "right" }}
                  /> mm
                </div>
              </ToolCard>
            )}
          </div>
          <PropertiesPanel op={op} row={d.row} />
          <ProblemsPanel issues={d.issues} mode={state.project.mode} />
        </div>
      ) : (
        <div className="placeholder" style={{ background: "var(--bg-panel)" }}>{t("placeholder.notYet")}</div>
      )}
      <OrderBar est={d.est} issues={d.issues} />
      <StatusBar issues={d.issues} machine={d.machine} chartWarning={d.chartWarning} />
      {state.showExport && <ExportDialog issues={d.issues} toolpath={d.toolpath} row={d.row} machine={d.machine} />}
      {state.showCharts && <ChartsScreen />}
      {state.showMachines && <MachinesScreen />}
      {state.showNozzles && <NozzlesScreen />}
    </div>
  );
}
