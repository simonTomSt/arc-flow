import type { ControllerKind } from "@arcflow/core";

/** Condition flags a template line can depend on. Prefix "!" negates. */
export type Flag = "thc" | "heights" | "ihs" | "!thc" | "!heights" | "!ihs";

/** A template line: plain string, or emitted only when a flag holds. */
export type TemplateLine = string | { when: Flag; line: string };

/**
 * Declarative postprocessor (spec §7, design screen L3 "Bloki zdarzeń ze zmiennymi").
 * Event blocks hold template lines with {VARIABLES}; see docs/engineering/32-postprocessors.md.
 */
export interface PostDefinition {
  id: string;
  name: string;
  controller: ControllerKind;
  description: string;
  /** Built-in post this one was derived from (design: "na bazie F2100K v2.3"). */
  base?: string;
  /**
   * Blocks whose codes have NOT been confirmed on a real controller.
   * The UI shows a warning badge and export shows an info issue until this is empty.
   */
  unverified: string[];
  format: {
    decimals: number;
    lineNumbers: false | { prefix: string; start: number; step: number };
    extension: string;
    newline: "\n" | "\r\n";
    maxFileNameLength?: number;
    upperCaseFileName?: boolean;
    /** Emit F only when it changes. */
    modalFeed: boolean;
    /** Strip non-ASCII characters from comments (older controllers choke on UTF-8). */
    asciiOnly: boolean;
    /** Emit a full circle as two half arcs (not every controller accepts start == end with I/J). */
    splitFullCircles: boolean;
    /** Separator between words in a block. Default " ". F2100K uses "" (G01X+1.0000Y-2.0000). */
    wordSeparator?: string;
    /** Prefix non-negative numbers with "+". F2100K/SheetCAM style. */
    forceSign?: boolean;
  };
  capabilities: {
    /** Controller does G41/G42. Must match MachineProfile.controllerCompensation. */
    compensation: boolean;
    /** Arc output style. */
    arcs: "IJ-relative";
  };
  blocks: {
    programStart: TemplateLine[];
    pierce: TemplateLine[];
    thcOn: TemplateLine[];
    thcOff: TemplateLine[];
    /** Word placed in front of the first motion after compensation starts, e.g. "G41". */
    compLeftPrefix: string;
    compRightPrefix: string;
    compOff: TemplateLine[];
    cut: TemplateLine[];
    arcCW: TemplateLine[];
    arcCCW: TemplateLine[];
    cutEnd: TemplateLine[];
    afterCut: TemplateLine[];
    programEnd: TemplateLine[];
  };
  /** Sanity checks run on the generated program (design L3 · SPRAWDZENIE). */
  checks: { pairs: { open: string; close: string }[] };
  /** Reminders surfaced in the export dialog whenever this post runs (e.g. "GRBL: $32=0 required"). */
  reminders?: string[];
}
