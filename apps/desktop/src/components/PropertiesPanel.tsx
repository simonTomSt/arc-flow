import { reasonText, type CutChartRow, type LeadType, type Operation, type OperationOverrides, type Param, type Side } from "@arcflow/core";
import { useStore } from "../state/store";
import { useT, fmtNum, LangContext } from "../i18n";
import { useContext, type ReactNode } from "react";

/**
 * Right panel (design screen C). Auto values grey, manual values white + "przywróć auto".
 * The "Dlaczego?" block lists the automation's reasons for this contour.
 */
export function PropertiesPanel({ op, row }: { op: Operation | undefined; row: CutChartRow }) {
  const { dispatch } = useStore();
  const t = useT();
  const lang = useContext(LangContext);
  if (!op) return <aside className="panel right"><p className="placeholder">{t("props.nothing")}</p></aside>;

  const set = (patch: OperationOverrides) => dispatch({ type: "override", contourId: op.contourId, patch });
  const restore = (key: keyof OperationOverrides) => dispatch({ type: "restoreAuto", contourId: op.contourId, key });
  const leadTypes: LeadType[] = ["line", "arc", "lineArc", "center", "none"];
  const sides: Side[] = ["left", "right", "none"];

  return (
    <aside className="panel right">
      <h3>{t("props.title")}</h3>
      <div style={{ padding: "0 14px 8px", fontSize: 17, fontWeight: 600 }}>
        {t(`role.${op.role}` as const)} {op.role === "hole" ? `Ø${op.sizeMm}` : ""} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>#{op.order}</span>
      </div>

      <Field label={t("props.leadIn")} param={op.leadIn} onRestore={() => restore("leadIn")}>
        <div className="seg">
          {leadTypes.map((lt) => (
            <button key={lt} aria-pressed={op.leadIn.value.type === lt} onClick={() => set({ leadIn: { ...op.leadIn.value, type: lt } })}>
              {t(`lead.${lt}` as const)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("props.length")} param={op.leadIn} onRestore={() => restore("leadIn")}>
        <NumberInput value={op.leadIn.value.lengthMm} unit="mm" onChange={(v) => set({ leadIn: { ...op.leadIn.value, lengthMm: v } })} />
      </Field>
      <Field label={t("props.overcut")} param={op.overcutMm} onRestore={() => restore("overcutMm")}>
        <NumberInput value={op.overcutMm.value} unit="mm" onChange={(v) => set({ overcutMm: v })} />
      </Field>
      <Field label={t("props.side")} param={op.side} onRestore={() => restore("side")}>
        <div className="seg">
          {sides.map((s) => (
            <button key={s} aria-pressed={op.side.value === s} onClick={() => set({ side: s })}>{t(`side.${s}` as const)}</button>
          ))}
        </div>
      </Field>
      <div className="prop"><label className="tip">{t("props.kerf")}</label><span className="auto">{fmtNum(row.kerfMm, lang)} mm</span></div>
      <Field label={t("props.direction")} param={op.direction} onRestore={() => restore("direction")}>
        <div className="seg">
          {(["CW", "CCW"] as const).map((d) => (
            <button key={d} aria-pressed={op.direction.value === d} onClick={() => set({ direction: d })}>{d}</button>
          ))}
        </div>
      </Field>
      <Field label={t("props.speed")} param={op.speedPct} onRestore={() => restore("speedPct")}>
        <span>
          <button className="btn" onClick={() => set({ speedPct: Math.max(10, op.speedPct.value - 5) })}>−</button>{" "}
          {op.speedPct.value} %{" "}
          <button className="btn" onClick={() => set({ speedPct: Math.min(150, op.speedPct.value + 5) })}>+</button>
          <div className="auto" style={{ fontSize: 12, textAlign: "right" }}>{Math.round((row.feedMmMin * op.speedPct.value) / 100)} mm/min</div>
        </span>
      </Field>
      <Field label={t("props.thc")} param={op.thc} onRestore={() => restore("thc")}>
        <input type="checkbox" checked={op.thc.value} onChange={(e) => set({ thc: e.target.checked })} />
      </Field>

      <h3>{t("props.why")}</h3>
      <div className="why">
        <ol>{op.reasons.map((r, i) => <li key={i}>{reasonText(r, lang)}</li>)}</ol>
      </div>
    </aside>
  );
}

function Field<T>({ label, param, onRestore, children }: { label: string; param: Param<T>; onRestore: () => void; children: ReactNode }) {
  const t = useT();
  const manual = param.source === "manual";
  return (
    <div className="prop">
      <label className="tip">{label}{manual && <span className="manual-dot" />}</label>
      <div className={manual ? "manual" : "auto"} style={{ textAlign: "right" }}>
        {children}
        {manual && (
          <div><button className="restore" onClick={onRestore}>{t("action.restoreAuto")}</button></div>
        )}
      </div>
    </div>
  );
}

function NumberInput({ value, unit, onChange }: { value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <span>
      <input
        type="number"
        step="0.1"
        value={value}
        style={{ width: 80, textAlign: "right" }}
        onChange={(e) => {
          const v = parseFloat(e.target.value.replace(",", "."));
          if (!Number.isNaN(v)) onChange(v);
        }}
      />{" "}
      {unit}
    </span>
  );
}
