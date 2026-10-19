import { useMemo, useState } from "react";
import { blocksExport, type CutChartRow, type Issue, type MachineProfile, type Toolpath } from "@arcflow/core";
import { getPost, runPost } from "@arcflow/post";
import { useStore } from "../state/store";
import { useT, type MessageKey } from "../i18n";
import { saveTextFile } from "../platform/save";

/**
 * Design screen I: validation list + post + file name + folder + live G-code
 * preview. Errors block saving. "Napraw wszystko" applies every issue whose
 * `fix` recipe is supported by the store.
 */
export function ExportDialog({ issues, toolpath, row, machine }: { issues: Issue[]; toolpath: Toolpath; row: CutChartRow; machine: MachineProfile }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const post = getPost(machine.postId);
  const res = useMemo(
    () => runPost(post, toolpath, { projectName: state.project.name, preset: state.project.preset, row, machine, sheet: state.project.sheet }),
    [post, toolpath, state.project, row, machine],
  );
  const defaultBase = res.fileName.replace(new RegExp(`${escapeRegex(post.format.extension)}$`, "i"), "");
  const [base, setBase] = useState(defaultBase);
  const [ext, setExt] = useState(post.format.extension);
  const [folder, setFolder] = useState(state.lastExportPath ? dirOf(state.lastExportPath) : "");

  const blocked = blocksExport(issues);
  const errors = issues.filter((i) => i.severity === "error").length;
  const color = { error: "var(--error)", warning: "var(--warn)", info: "var(--text-3)" } as const;

  const maxLen = post.format.maxFileNameLength;
  const nameTooLong = maxLen != null && base.length > maxLen;
  const fileName = (post.format.upperCaseFileName ? base.toUpperCase() : base) + ext;

  const fixable = issues.filter((i) => i.fix && (i.fix.code === "MARK_INSTEAD" || i.fix.code === "SHORTEN_LEAD"));
  const kB = (new TextEncoder().encode(res.text).length / 1024).toFixed(1);

  return (
    <div className="modal-back" onClick={() => dispatch({ type: "showExport", show: false })}>
      <div className="modal export" onClick={(e) => e.stopPropagation()}>
        <header>
          <b>{t("export.title")}</b>
          <div className="chips">
            <span className="chip-s">{t("export.machine")}: {machine.name}</span>
            <span className="chip-s">{t("export.post")}: {post.name}</span>
            <span className="chip-s">{t("export.nozzle")}: {state.project.preset.nozzle}</span>
          </div>
        </header>
        <div className="body">
          <div className="issue-list">
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
          <div className="export-fields">
            <label>
              <span className="auto">{t("export.fileName")}</span>
              <input value={base} onChange={(e) => setBase(e.target.value)} aria-invalid={nameTooLong} />
            </label>
            <label>
              <span className="auto">{t("export.extension")}</span>
              <input value={ext} onChange={(e) => setExt(e.target.value)} style={{ width: 70 }} />
            </label>
            <label style={{ flex: 1 }}>
              <span className="auto">{t("export.folder")}</span>
              <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={t("export.folderPlaceholder")} />
            </label>
            <div className="auto summary">{t("export.summary", { n: res.lines.length, kb: kB })}</div>
          </div>
          <div className="export-actions">
            {nameTooLong && <span style={{ color: "var(--warn)" }}>▲ {t("export.nameTooLong", { n: maxLen!, post: post.name })}</span>}
            {blocked && <span style={{ color: "var(--error)" }}>● {t("export.blocked", { n: errors })}</span>}
            <div className="spacer" style={{ flex: 1 }} />
            <button
              className="btn"
              disabled={fixable.length === 0}
              title={fixable.length === 0 ? t("export.fixAllNone") : ""}
              onClick={() => dispatch({ type: "applyFixes", issues: fixable })}
            >
              {fixable.length === 0 ? t("export.fixAll") : t("export.fixAllSome", { n: fixable.length })}
            </button>
            <button className="btn" onClick={() => dispatch({ type: "showExport", show: false })}>{t("action.cancel")}</button>
            <button className="btn primary" disabled={blocked || nameTooLong} onClick={async () => {
              const saved = await saveTextFile(fileName, res.text);
              if (saved) dispatch({ type: "noteExport", path: saved });
            }}>{t("action.save")}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dirOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(0, i) : "";
}
