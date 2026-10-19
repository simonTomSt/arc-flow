import { formatDuration, type Estimate, type Issue } from "@arcflow/core";
import { useContext } from "react";
import { useT, fmtNum, LangContext } from "../i18n";

/** Bottom bar: "{n} cięć · {time} · {length} · 1 błąd · 2 uwagi" (design C/AS/M). */
export function OrderBar({ est, issues }: { est: Estimate; issues: Issue[] }) {
  const t = useT();
  const lang = useContext(LangContext);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warning").length;
  return (
    <div className="orderbar">
      <span>{t("order.title")}</span>
      <span><b>{est.pierces}</b> {t("order.cuts")}</span>
      <span><b>{formatDuration(est.totalTimeS)}</b></span>
      <span><b>{fmtNum(est.cutLengthMm / 1000, lang)} m</b></span>
      <div className="spacer" />
      {errors > 0 && <span className="issues-chip" style={{ color: "var(--error)" }}>● {errors} {t("order.errors")}</span>}
      {warns > 0 && <span className="issues-chip" style={{ color: "var(--warn)" }}>▲ {warns} {t("order.issues")}</span>}
    </div>
  );
}
