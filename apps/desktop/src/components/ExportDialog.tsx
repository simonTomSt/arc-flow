import { useMemo, useState } from "react";
import { blocksExport, type CutChartRow, type Issue, type MachineProfile, type Toolpath } from "@arcflow/core";
import { getPost, runPost } from "@arcflow/post";
import { useStore } from "../state/store";
import { useT, type MessageKey } from "../i18n";
import { saveTextFile } from "../platform/save";

/** Design screen I: validation list + post + file name + live G-code preview. Errors block saving. */
export function ExportDialog({ issues, toolpath, row, machine }: { issues: Issue[]; toolpath: Toolpath; row: CutChartRow; machine: MachineProfile }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const post = getPost(machine.postId);
  const res = useMemo(
    () => runPost(post, toolpath, { projectName: state.project.name, preset: state.project.preset, row, machine, sheet: state.project.sheet }),
    [post, toolpath, state.project, row, machine],
  );
  const [name, setName] = useState(res.fileName);
  const blocked = blocksExport(issues);
  const errors = issues.filter((i) => i.severity === "error").length;
  const color = { error: "var(--error)", warning: "var(--warn)", info: "var(--text-3)" } as const;

  return (
    <div className="modal-back" onClick={() => dispatch({ type: "showExport", show: false })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header><b>{t("export.title")}</b><span style={{ color: "var(--text-3)" }}>{post.name}</span></header>
        <div className="body">
          <div style={{ overflow: "auto", borderRight: "1px solid var(--border)" }}>
            {issues.length === 0 && <div className="issue"><span style={{ color: "var(--ok)" }}>●</span>{t("status.ok")}</div>}
            {issues.map((i, k) => (
              <div key={k} className="issue" onClick={() => i.contourId && dispatch({ type: "select", id: i.contourId })}>
                <span style={{ color: color[i.severity] }}>●</span>
                <span>{t(`issue.${i.code}` as MessageKey, i.params)}</span>
              </div>
            ))}
            {res.warnings.map((w, k) => (
              <div key={`w${k}`} className="issue"><span style={{ color: "var(--warn)" }}>▲</span><span>{w}</span></div>
            ))}
          </div>
          <pre className="gcode">{res.lines.slice(0, 400).map((l, k) => <span key={k}>{l}</span>)}</pre>
        </div>
        <footer>
          <label>{t("export.fileName")} <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="spacer" style={{ flex: 1 }} />
          {blocked && <span style={{ color: "var(--error)" }}>{t("export.blocked", { n: errors })}</span>}
          <button className="btn" onClick={() => dispatch({ type: "showExport", show: false })}>{t("action.cancel")}</button>
          <button className="btn primary" disabled={blocked} onClick={() => void saveTextFile(name, res.text)}>{t("action.save")}</button>
        </footer>
      </div>
    </div>
  );
}
