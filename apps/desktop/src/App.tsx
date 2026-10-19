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
import { CamCanvas } from "./canvas/CamCanvas";
import { useT } from "./i18n";

export function App() {
  const { state, dispatch } = useStore();
  const d = useDerived(state);
  const t = useT();
  const op = d.ops.find((o) => o.contourId === state.selectedContourId);

  // The pending-import screen takes over the whole workspace until the operator decides.
  const screen = state.pendingImport ? "import" : state.workspace;

  return (
    <div className="app" data-theme={state.theme} data-touch={state.touch}>
      <TopBar blocked={blocksExport(d.issues)} />
      {screen === "import" ? (
        <ImportReportScreen />
      ) : screen === "start" ? (
        <StartScreen />
      ) : screen === "cam" ? (
        <div className="main">
          <Browser ops={d.ops} />
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
          </div>
          <PropertiesPanel op={op} row={d.row} />
        </div>
      ) : (
        <div className="placeholder" style={{ background: "var(--bg-panel)" }}>{t("placeholder.notYet")}</div>
      )}
      <OrderBar est={d.est} issues={d.issues} />
      <StatusBar issues={d.issues} machine={d.machine} chartWarning={d.chartWarning} />
      {state.showExport && <ExportDialog issues={d.issues} toolpath={d.toolpath} row={d.row} machine={d.machine} />}
    </div>
  );
}
