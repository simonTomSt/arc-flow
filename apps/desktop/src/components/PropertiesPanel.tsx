import { reasonText, type CutChartRow, type LeadIn, type LeadOut, type LeadType, type Operation, type OperationOverrides, type Param, type Side } from "@arcflow/core";
import { useStore } from "../state/store";
import { useT, fmtNum, LangContext, type MessageKey } from "../i18n";
import { useContext, type ReactNode } from "react";

/**
 * Right panel (design screen C). Section headers in CAPS, auto values grey,
 * manual values white with a dot and a "zmienione ręcznie z X · przywróć auto"
 * sub-line. The "Dlaczego?" block lists the automation's reasons.
 */
export function PropertiesPanel({ op, row }: { op: Operation | undefined; row: CutChartRow }) {
  const { dispatch } = useStore();
  const t = useT();
  const lang = useContext(LangContext);
  if (!op) return <aside className="panel right"><p className="placeholder">{t("props.nothing")}</p></aside>;

  const set = (patch: OperationOverrides) => dispatch({ type: "override", contourId: op.contourId, patch });
  const restore = (key: keyof OperationOverrides) => dispatch({ type: "restoreAuto", contourId: op.contourId, key });
  const leadInTypes: LeadType[] = ["line", "arc", "lineArc", "center", "none"];
  const leadOutTypes: LeadOut["type"][] = ["none", "line"];
  const sides: Side[] = ["left", "right", "none"];
  const feedMmMin = Math.round((row.feedMmMin * op.speedPct.value) / 100);

  return (
    <aside className="panel right">
      <h3>{t("props.title")}</h3>
      <div className="prop-head">
        {t(`role.${op.role}` as const)} {op.role === "hole" ? `Ø${op.sizeMm}` : ""}
        <span className="order">#{op.order}</span>
      </div>

      <Section label={t("props.section.leadIn")}>
        <Field label={t("props.leadIn")} param={op.leadIn} fmt={(v) => t(`lead.${v.type}` as const)} onRestore={() => restore("leadIn")}>
          <div className="seg">
            {leadInTypes.map((lt) => (
              <button key={lt} aria-pressed={op.leadIn.value.type === lt} onClick={() => set({ leadIn: { ...op.leadIn.value, type: lt } })}>
                {t(`lead.${lt}` as const)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("props.length")} param={op.leadIn} fmt={(v) => `${fmtNum(v.lengthMm, lang)} mm`} onRestore={() => restore("leadIn")}>
          <NumberInput value={op.leadIn.value.lengthMm} unit="mm" onChange={(v) => set({ leadIn: { ...op.leadIn.value, lengthMm: v } })} />
        </Field>
        <Field label={t("props.overcut")} param={op.overcutMm} fmt={(v) => `${fmtNum(v, lang)} mm`} onRestore={() => restore("overcutMm")}>
          <NumberInput value={op.overcutMm.value} unit="mm" onChange={(v) => set({ overcutMm: v })} />
        </Field>
      </Section>

      <Section label={t("props.section.leadOut")}>
        <Field label={t("props.leadOut")} param={op.leadOut} fmt={(v) => t(`lead.${v.type}` as const)} onRestore={() => restore("leadOut")}>
          <div className="seg">
            {leadOutTypes.map((lt) => (
              <button key={lt} aria-pressed={op.leadOut.value.type === lt} onClick={() => set({ leadOut: { ...op.leadOut.value, type: lt } })}>
                {t(`lead.${lt}` as const)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("props.length")} param={op.leadOut} fmt={(v) => `${fmtNum(v.lengthMm, lang)} mm`} onRestore={() => restore("leadOut")}>
          <NumberInput value={op.leadOut.value.lengthMm} unit="mm" onChange={(v) => set({ leadOut: { ...op.leadOut.value, lengthMm: v } })} />
        </Field>
      </Section>

      <Section label={t("props.section.compensation")}>
        <Field label={t("props.side")} param={op.side} fmt={(v) => t(`side.${v}` as const)} onRestore={() => restore("side")}>
          <div className="seg">
            {sides.map((s) => (
              <button key={s} aria-pressed={op.side.value === s} onClick={() => set({ side: s })}>{t(`side.${s}` as const)}</button>
            ))}
          </div>
        </Field>
        <div className="prop"><label className="tip">{t("props.kerf")}</label><span className="auto">{fmtNum(row.kerfMm, lang)} mm</span></div>
      </Section>

      <Section label={t("props.section.direction")}>
        <Field label={t("props.direction")} param={op.direction} fmt={(v) => v} onRestore={() => restore("direction")}>
          <div className="seg">
            {(["CW", "CCW"] as const).map((d) => (
              <button key={d} aria-pressed={op.direction.value === d} onClick={() => set({ direction: d })}>{d}</button>
            ))}
          </div>
        </Field>
      </Section>

      <Section label={t("props.section.speed")}>
        <Field label={t("props.speed")} param={op.speedPct} fmt={(v) => `${v} %`} onRestore={() => restore("speedPct")}>
          <span>
            <button className="btn" onClick={() => set({ speedPct: Math.max(10, op.speedPct.value - 5) })}>−</button>{" "}
            {op.speedPct.value} %{" "}
            <button className="btn" onClick={() => set({ speedPct: Math.min(150, op.speedPct.value + 5) })}>+</button>
            <div className="auto" style={{ fontSize: 12, textAlign: "right" }}>{feedMmMin} mm/min</div>
          </span>
        </Field>
      </Section>

      <Section label={t("props.section.thc")}>
        <Field label={t("props.thc")} param={op.thc} fmt={(v) => (v ? "on" : "off")} onRestore={() => restore("thc")}>
          <input type="checkbox" checked={op.thc.value} onChange={(e) => set({ thc: e.target.checked })} />
        </Field>
      </Section>

      <h3>{t("props.why")}</h3>
      <div className="why">
        <ol>{op.reasons.map((r, i) => <li key={i}>{reasonText(r, lang)}</li>)}</ol>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="prop-section">{label}</div>
      {children}
    </>
  );
}

function Field<T>({ label, param, fmt, onRestore, children }: { label: string; param: Param<T>; fmt: (v: T) => string; onRestore: () => void; children: ReactNode }) {
  const t = useT();
  const manual = param.source === "manual";
  return (
    <div className="prop">
      <label className="tip">{label}{manual && <span className="manual-dot" />}</label>
      <div className={manual ? "manual" : "auto"} style={{ textAlign: "right" }}>
        {children}
        {manual && (
          <div className="prop-sub">
            {t("props.changedFrom", { from: fmt(param.auto) })} · <button className="restore" onClick={onRestore}>{t("action.restoreAuto")}</button>
          </div>
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
