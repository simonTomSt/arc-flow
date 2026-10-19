import type { Operation } from "@arcflow/core";
import { useStore } from "../state/store";
import { useT } from "../i18n";

const roleColor: Record<string, string> = { outer: "var(--cam-cut)", hole: "var(--cam-cut)", island: "var(--cam-cut)", open: "var(--cam-open)" };

/** Left panel: sheet → parts → contours, with type colour, order number and manual-override dot (spec §6.2). */
export function Browser({ ops }: { ops: Operation[] }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const parts = new Map<string, Operation[]>();
  for (const o of ops) (parts.get(o.partId) ?? parts.set(o.partId, []).get(o.partId)!).push(o);

  return (
    <aside className="panel left">
      <h3>{t("browser.title")}</h3>
      <div className="tree-row">▼ {t("browser.sheet")} 1 <span className="meta">{state.project.sheet.widthMm}×{state.project.sheet.heightMm}</span></div>
      {[...parts.entries()].map(([pid, list]) => (
        <div key={pid}>
          <div className="tree-row" style={{ paddingLeft: 24 }}>▼ {pid}</div>
          {list.map((o) => {
            const manual = Object.keys(state.project.overrides[o.contourId] ?? {}).length > 0;
            return (
              <div
                key={o.id}
                className="tree-row"
                style={{ paddingLeft: 44 }}
                aria-selected={state.selectedContourId === o.contourId}
                onClick={() => dispatch({ type: "select", id: o.contourId })}
              >
                <span className="dot" style={{ background: o.action.value === "mark" ? "var(--cam-mark)" : roleColor[o.role] }} />
                {t(`role.${o.role}` as const)} {o.role === "hole" ? `Ø${o.sizeMm}` : ""}
                {manual && <span className="manual-dot" title="ręcznie" />}
                {o.needsReview && <span style={{ color: "var(--warn)" }}>•</span>}
                <span className="meta">#{o.order}</span>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
