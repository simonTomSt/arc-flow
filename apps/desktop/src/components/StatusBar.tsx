import type { Issue, MachineProfile } from "@arcflow/core";
import { blocksExport } from "@arcflow/core";
import { useT } from "../i18n";

export function StatusBar({ issues, machine, chartWarning }: { issues: Issue[]; machine: MachineProfile; chartWarning?: string | undefined }) {
  const t = useT();
  const blocked = blocksExport(issues);
  return (
    <div className="statusbar">
      <span style={{ color: blocked ? "var(--error)" : "var(--ok)" }}>● {blocked ? t("status.blocked") : t("status.ok")}</span>
      <span>{machine.name} · {machine.controller}</span>
      {chartWarning && <span style={{ color: "var(--warn)" }}>{chartWarning}</span>}
      <div className="spacer" style={{ flex: 1 }} />
      <span>mm</span>
    </div>
  );
}
