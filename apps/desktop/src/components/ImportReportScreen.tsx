import { useMemo } from "react";
import { bbox, type Contour, type Segment, type LayerRole, layersUsed } from "@arcflow/core";
import { useStore } from "../state/store";
import { useT } from "../i18n";

/**
 * Screen "Import report" (plan M1): counts, open contours highlighted in red,
 * layer → operation mapping, Accept replaces or appends to the current sheet.
 */
export function ImportReportScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const pending = state.pendingImport;
  if (!pending) return null;

  const r = pending.report;
  const layers = layersUsed(pending.rawContours);
  const roles: LayerRole[] = ["cut", "mark", "punch", "ignore"];

  return (
    <div className="import-wrap">
      <div className="import-grid">
        <section className="import-card">
          <h2>{t("import.title")}</h2>
          <div className="auto" style={{ color: "var(--text-3)" }}>{t("import.subtitle", { file: pending.fileName })}</div>

          <div className="counts">
            <div><b>{r.closedContours}</b> {t("import.closed")}</div>
            <div className={r.openContours > 0 ? "warn" : ""}><b>{r.openContours}</b> {t("import.open")}</div>
            <div><b>{r.gapsFixed}</b> {t("import.gapsFixed")}</div>
            <div><b>{r.duplicatesRemoved}</b> {t("import.duplicates")}</div>
          </div>

          <h3>{t("import.units")}</h3>
          <div className="auto">{r.units}</div>

          {r.warnings.length > 0 && (
            <>
              <h3>{t("import.warnings")}</h3>
              <div className="warnings-list">
                {r.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            </>
          )}

          <h3>{t("import.layers")}</h3>
          <div>
            {layers.map((name) => (
              <div key={name} className="layer-row">
                <span>{name}</span>
                <select value={pending.layerMap[name] ?? "cut"} onChange={(e) => dispatch({ type: "setLayerRole", layer: name, role: e.target.value as LayerRole })}>
                  {roles.map((r0) => (
                    <option key={r0} value={r0}>{t(`layer.role.${r0}` as const)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="import-footer">
            <button className="btn" onClick={() => dispatch({ type: "cancelImport" })}>{t("action.cancel")}</button>
            <button className="btn" onClick={() => dispatch({ type: "acceptImport", mode: "append" })}>{t("action.append")}</button>
            <button className="btn primary" onClick={() => dispatch({ type: "acceptImport", mode: "replace" })}>{t("action.replace")}</button>
          </div>
        </section>

        <section className="import-card">
          <h3>{t("export.preview")}</h3>
          <SvgPreview contours={pending.rawContours} layerMap={pending.layerMap} />
        </section>
      </div>
    </div>
  );
}

function SvgPreview({ contours, layerMap }: { contours: Contour[]; layerMap: Record<string, LayerRole> }) {
  const { pathD, viewBox } = useMemo(() => buildPreview(contours), [contours]);
  return (
    <svg className="import-preview" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      {/* Flip Y so math up → screen up */}
      <g transform={`matrix(1 0 0 -1 0 ${viewBox.split(" ")[1]!} )`}>
        {contours.map((c, i) => {
          const role = layerMap[c.layer ?? "0"] ?? "cut";
          const colour =
            role === "ignore" ? "var(--text-disabled)" :
            role === "mark" || role === "punch" ? "var(--cam-mark)" :
            !c.closed ? "var(--cam-open)" :
            "var(--cam-cut)";
          return <path key={c.id || i} d={pathD(c)} fill="none" stroke={colour} strokeWidth={viewBoxStroke(viewBox)} opacity={role === "ignore" ? 0.4 : 1} />;
        })}
      </g>
    </svg>
  );
}

function viewBoxStroke(vb: string): number {
  const parts = vb.split(" ").map(Number);
  return Math.max(0.3, Math.min(parts[2]!, parts[3]!) / 400);
}

function buildPreview(contours: Contour[]): { pathD: (c: Contour) => string; viewBox: string } {
  if (contours.length === 0) return { pathD: () => "", viewBox: "0 0 100 100" };
  const bs = contours.map(bbox);
  const minX = Math.min(...bs.map((b) => b.minX));
  const minY = Math.min(...bs.map((b) => b.minY));
  const maxX = Math.max(...bs.map((b) => b.maxX));
  const maxY = Math.max(...bs.map((b) => b.maxY));
  const pad = Math.max((maxX - minX) * 0.05, 1);
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  const pathD = (c: Contour): string => {
    const parts: string[] = [];
    const first = c.segments[0];
    if (!first) return "";
    parts.push(`M ${first.a.x} ${first.a.y}`);
    for (const s of c.segments) parts.push(segToSvg(s));
    if (c.closed) parts.push("Z");
    return parts.join(" ");
  };
  return { pathD, viewBox: vb };
}

function segToSvg(s: Segment): string {
  if (s.kind === "line") return `L ${s.b.x} ${s.b.y}`;
  const r = Math.hypot(s.a.x - s.c.x, s.a.y - s.c.y);
  if (s.full) {
    // Two half-arcs: SVG can't do a full arc in one command.
    const opp = { x: 2 * s.c.x - s.a.x, y: 2 * s.c.y - s.a.y };
    const sweep = s.ccw ? 1 : 0;
    return `A ${r} ${r} 0 0 ${sweep} ${opp.x} ${opp.y} A ${r} ${r} 0 0 ${sweep} ${s.b.x} ${s.b.y}`;
  }
  const sweep = s.ccw ? 1 : 0;
  // large-arc flag: 1 if the swept angle is > 180°
  const a0 = Math.atan2(s.a.y - s.c.y, s.a.x - s.c.x);
  const a1 = Math.atan2(s.b.y - s.c.y, s.b.x - s.c.x);
  let d = a1 - a0;
  if (s.ccw) {
    while (d <= 0) d += 2 * Math.PI;
  } else {
    while (d >= 0) d -= 2 * Math.PI;
  }
  const large = Math.abs(d) > Math.PI ? 1 : 0;
  return `A ${r} ${r} 0 ${large} ${sweep} ${s.b.x} ${s.b.y}`;
}
