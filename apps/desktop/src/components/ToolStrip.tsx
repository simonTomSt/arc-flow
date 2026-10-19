import { useT } from "../i18n";

export type Tool = "select" | "leadIn" | "corners" | "position" | "bridge";

/** Design C: left-side tool strip with icons + keyboard shortcuts. Opening a tool shows a ToolCard on the canvas. */
export function ToolStrip({ active, onPick }: { active: Tool; onPick: (t: Tool) => void }) {
  const t = useT();
  const tools: { id: Tool; icon: string; key: string }[] = [
    { id: "select", icon: "↖", key: "V" },
    { id: "leadIn", icon: "➘", key: "L" },
    { id: "corners", icon: "◠", key: "K" },
    { id: "position", icon: "⟳", key: "R" },
    { id: "bridge", icon: "⫽", key: "B" },
  ];
  return (
    <nav className="tool-strip" aria-label="Narzędzia">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className="tool"
          aria-pressed={active === tool.id}
          onClick={() => onPick(tool.id)}
          title={`${t(`tool.${tool.id}` as const)}  (${tool.key})`}
        >
          <span className="icon" aria-hidden>{tool.icon}</span>
          <span className="key">{tool.key}</span>
        </button>
      ))}
    </nav>
  );
}
