import type { CutChartRow, MachineProfile, Toolpath, Vec2, CutPreset } from "@arcflow/core";
import type { Flag, PostDefinition, TemplateLine } from "./types";

export interface PostContext {
  projectName: string;
  preset: CutPreset;
  row: CutChartRow;
  machine: MachineProfile;
  sheet: { widthMm: number; heightMm: number };
  /** Z feed for pierce → cut height move, mm/min. */
  zFeedMmMin?: number;
}

export interface PostResult {
  text: string;
  lines: string[];
  /** For the live preview: which block produced each line (design L3 highlights edited block lines). */
  sources: string[];
  fileName: string;
  warnings: string[];
}

/**
 * Turn a machine-independent toolpath into G-code text.
 * Coordinates: internal Y-up sheet mm → machine coords per MachineProfile.origin.
 */
export function runPost(post: PostDefinition, tp: Toolpath, ctx: PostContext): PostResult {
  const { machine, row, preset } = ctx;
  const lines: string[] = [];
  const sources: string[] = [];
  const warnings: string[] = [];
  const fmt = (x: number) => {
    const s = x.toFixed(post.format.decimals);
    return s === `-${(0).toFixed(post.format.decimals)}` ? s.slice(1) : s;
  };
  const toMachine = (p: Vec2): Vec2 =>
    machine.origin === "top-left"
      ? { x: p.x - machine.originOffsetMm.x, y: p.y - ctx.sheet.heightMm - machine.originOffsetMm.y }
      : { x: p.x - machine.originOffsetMm.x, y: p.y - machine.originOffsetMm.y };

  const flags: Record<string, boolean> = {
    thc: machine.hasTHC,
    heights: machine.heightsInProgram,
    ihs: machine.ihs !== "none",
  };
  const holds = (f: Flag) => (f.startsWith("!") ? !flags[f.slice(1)] : Boolean(flags[f]));

  const globals: Record<string, string> = {
    PROJECT: ctx.projectName,
    MATERIAL: preset.material,
    THICKNESS: String(preset.thicknessMm),
    CURRENT: String(preset.currentA),
    NOZZLE: preset.nozzle,
    KERF: fmt(row.kerfMm),
    PIERCE_HEIGHT: fmt(row.pierceHeightMm),
    PIERCE_DELAY: String(row.pierceDelayS),
    CUT_HEIGHT: fmt(row.cutHeightMm),
    TRAVEL_HEIGHT: fmt(machine.travelHeightMm),
    F_Z: String(ctx.zFeedMmMin ?? 300),
    THC_VOLTAGE: row.arcVoltageV !== undefined ? String(row.arcVoltageV) : "",
  };

  let lastF: number | null = null;
  let prefix = "";

  const emit = (block: string, tpl: TemplateLine[], vars: Record<string, string> = {}) => {
    for (const t of tpl) {
      if (typeof t !== "string" && !holds(t.when)) continue;
      const raw = typeof t === "string" ? t : t.line;
      let out = raw.replace(/\{([A-Z_]+)(\?)?\}/g, (_m, k: string) => vars[k] ?? globals[k] ?? `{${k}}`);
      if (prefix && /^G0?[123]\b/.test(out)) {
        out = `${prefix} ${out}`;
        prefix = "";
      }
      out = out.replace(/\s+/g, " ").trim();
      if (post.format.asciiOnly) out = toAscii(out);
      if (!out) continue;
      lines.push(out);
      sources.push(block);
    }
  };
  const feedWord = (f: number) => {
    if (post.format.modalFeed && f === lastF) return "";
    lastF = f;
    return `F${f}`;
  };

  emit("programStart", post.blocks.programStart);
  let pos: Vec2 = { x: 0, y: 0 };
  tp.blocks.forEach((b) => {
    const cutNo = String(b.order);
    for (const m of b.moves) {
      switch (m.type) {
        case "rapid":
          pos = m.to;
          break;
        case "pierce": {
          const p = toMachine(m.at);
          emit("pierce", post.blocks.pierce, { X: fmt(p.x), Y: fmt(p.y), CUT_NO: cutNo });
          lastF = null;
          break;
        }
        case "thc":
          emit(m.on ? "thcOn" : "thcOff", m.on ? post.blocks.thcOn : post.blocks.thcOff, { CUT_NO: cutNo });
          break;
        case "comp":
          if (m.side === "none") emit("compOff", post.blocks.compOff);
          else prefix = m.side === "left" ? post.blocks.compLeftPrefix : post.blocks.compRightPrefix;
          break;
        case "line": {
          const p = toMachine(m.to);
          emit("cut", post.blocks.cut, { X: fmt(p.x), Y: fmt(p.y), F: feedWord(m.feed) });
          pos = m.to;
          break;
        }
        case "arc": {
          const arcTo = (to: Vec2) => {
            const p = toMachine(to);
            // I/J relative to the arc start; the origin change is a pure translation, so offsets keep their sign.
            const I = m.center.x - pos.x;
            const J = m.center.y - pos.y;
            emit(m.ccw ? "arcCCW" : "arcCW", m.ccw ? post.blocks.arcCCW : post.blocks.arcCW, { X: fmt(p.x), Y: fmt(p.y), I: fmt(I), J: fmt(J), F: feedWord(m.feed) });
            pos = to;
          };
          if (m.full && post.format.splitFullCircles) {
            arcTo({ x: 2 * m.center.x - pos.x, y: 2 * m.center.y - pos.y });
          }
          arcTo(m.to);
          break;
        }
        case "cutOff":
          emit("cutEnd", post.blocks.cutEnd, { CUT_NO: cutNo });
          break;
      }
    }
    emit("afterCut", post.blocks.afterCut, { CUT_NO: cutNo });
  });
  emit("programEnd", post.blocks.programEnd);

  if (post.format.lineNumbers) {
    const ln = post.format.lineNumbers;
    lines.forEach((l, i) => (lines[i] = `${ln.prefix}${ln.start + i * ln.step} ${l}`));
  }
  for (const pair of post.checks.pairs) {
    const opens = lines.filter((l) => new RegExp(`\\b${pair.open}\\b`).test(l)).length;
    const closes = lines.filter((l) => new RegExp(`\\b${pair.close}\\b`).test(l)).length;
    if (opens !== closes) warnings.push(`${pair.open} count (${opens}) ≠ ${pair.close} count (${closes})`);
  }
  if (post.unverified.length) warnings.push(`Post "${post.name}" has unverified blocks: ${post.unverified.join(", ")}`);
  if (post.capabilities.compensation !== machine.controllerCompensation)
    warnings.push(`Post compensation (${String(post.capabilities.compensation)}) ≠ machine profile (${String(machine.controllerCompensation)})`);

  return { text: lines.join(post.format.newline) + post.format.newline, lines, sources, fileName: fileName(post, ctx.projectName), warnings };
}

/** F2100K: max 8 characters, upper case (design I: "KOLN_DN1.NC"). */
export function fileName(post: PostDefinition, project: string): string {
  let base = toAscii(project)
    .replace(/[^\w-]/g, "_")
    .replace(/_+/g, "_");
  if (post.format.maxFileNameLength) base = base.slice(0, post.format.maxFileNameLength);
  const name = `${base}${post.format.extension}`;
  return post.format.upperCaseFileName ? name.toUpperCase() : name;
}

/** Strip diacritics (ł/Ł do not decompose under NFD) and drop anything outside printable ASCII. */
export function toAscii(s: string): string {
  return s
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[^\x20-\x7E]/g, "");
}
