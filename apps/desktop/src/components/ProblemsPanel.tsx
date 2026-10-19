import { type Issue, type Mode } from "@arcflow/core";
import { useStore } from "../state/store";
import { useT, type MessageKey } from "../i18n";

/**
 * Design AS/M: Fusion-style problems panel. Groups issues by `code` so the
 * operator sees "Lead-in wychodzi poza otwór" once with "też w 3 podobnych",
 * and can apply the recommended fix to the whole group. In Synergic mode
 * automation already resolved everything — the panel stays hidden.
 */
export function ProblemsPanel({ issues, mode }: { issues: Issue[]; mode: Mode }) {
  const { dispatch } = useStore();
  const t = useT();
  if (mode === "synergic") return null;

  const groups = groupByCode(issues);
  const fixable = issues.filter((i) => isSupported(i));

  return (
    <aside className={`problems-panel${issues.length === 0 ? " ok" : ""}`} aria-label={t("problems.title")}>
      <header>
        <b>{t("problems.title")}</b>
        {fixable.length > 0 && (
          <button className="btn primary small" onClick={() => dispatch({ type: "applyFixes", issues: fixable })}>
            {t("problems.applyAll", { n: fixable.length })}
          </button>
        )}
      </header>
      {issues.length === 0 && <p className="empty">{t("problems.empty")}</p>}
      {groups.map((g, i) => <Group key={i} first={g.first} rest={g.rest} mode={mode} />)}
    </aside>
  );
}

function Group({ first, rest, mode }: { first: Issue; rest: Issue[]; mode: Mode }) {
  const { dispatch } = useStore();
  const t = useT();
  const all = [first, ...rest];
  const proposals = buildProposals(first, mode, t);

  return (
    <div className={`issue-row sev-${first.severity}`}>
      <button className="issue-main" onClick={() => first.contourId && dispatch({ type: "select", id: first.contourId })}>
        <span className="dot" />
        <span className="msg">{t(`issue.${first.code}` as MessageKey, first.params)}</span>
        {rest.length > 0 && <span className="also">{t("problems.alsoInN", { n: rest.length })}</span>}
      </button>
      {proposals.length > 0 && (
        <ul className="proposals">
          {proposals.map((p, i) => (
            <li key={i}>
              <button
                className={`btn small ${p.recommended ? "primary" : ""}`}
                disabled={!p.supported}
                title={p.supported ? "" : t("export.fixAllNone")}
                onClick={() => dispatch({ type: "applyFixes", issues: all })}
              >
                {p.label}
              </button>
              {p.recommended && <span className="chip-s rec">{t("problems.recommended")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Proposal {
  label: string;
  recommended: boolean;
  supported: boolean;
}

function buildProposals(i: Issue, mode: Mode, t: ReturnType<typeof useT>): Proposal[] {
  if (!i.fix) return [];
  const supported = isSupported(i);
  const safe: Proposal = { label: t(`problems.fix.${i.fix.code}` as MessageKey, i.fix.params), recommended: mode === "manual", supported };
  const asAuto: Proposal = { label: t("problems.fix.AS_AUTO"), recommended: mode === "assisted", supported };
  // Design AS lists "Jak automat (Zalecane)" first, then alternatives; design M
  // reverses the order so the operator sees the longest-safe option on top
  // and marks it recommended instead.
  return mode === "assisted" ? [asAuto, safe] : [safe, asAuto];
}

function isSupported(i: Issue): boolean {
  return !!i.fix && (i.fix.code === "MARK_INSTEAD" || i.fix.code === "SHORTEN_LEAD");
}

function groupByCode(issues: Issue[]): { first: Issue; rest: Issue[] }[] {
  const buckets = new Map<string, Issue[]>();
  for (const i of issues) {
    const list = buckets.get(i.code) ?? [];
    list.push(i);
    buckets.set(i.code, list);
  }
  return Array.from(buckets.values()).map((list) => ({ first: list[0]!, rest: list.slice(1) }));
}
