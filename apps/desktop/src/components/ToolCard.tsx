import { useEffect, type ReactNode } from "react";
import { useT } from "../i18n";

/**
 * Floating card over the canvas when a tool is active (design C). Esc cancels,
 * Enter confirms. Positioned top-left; the canvas remains interactive underneath.
 */
export function ToolCard({ title, shortcut, hint, children, onCancel, onConfirm }: {
  title: string;
  shortcut: string;
  hint: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancel(); }
      else if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) { onConfirm(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel, onConfirm]);

  return (
    <div className="tool-card" role="dialog" aria-label={title}>
      <div className="tool-card-head">
        <b>{title}</b>
        <span className="shortcut">({shortcut})</span>
      </div>
      <p className="hint">{hint}</p>
      <div className="tool-card-body">{children}</div>
      <div className="tool-card-foot">
        <button className="btn" onClick={onCancel}>Esc · {t("action.cancel")}</button>
        <button className="btn primary" onClick={onConfirm}>{t("action.ok")} ↵</button>
      </div>
    </div>
  );
}
