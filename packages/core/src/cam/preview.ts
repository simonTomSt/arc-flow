import type { CutBlock, Toolpath } from "./types";

/**
 * Synthetic toolpath for the design-L2 "Co z tego wynika" preview: one pierce
 * at the sheet's top-left, a 10 mm cut east, and a cutOff. Enough to exercise
 * programStart → pierce → cut → cutEnd → programEnd in every post, so toggles
 * on the machine profile (THC, heights, IHS, post) immediately show up in
 * G-code. The toolpath carries no leads or compensation on purpose — the
 * preview answers "what does my machine profile add to the file?", not "what
 * does my CAM strategy look like?".
 */
export function machinePreviewToolpath(): Toolpath {
  const block: CutBlock = {
    opId: "preview",
    order: 1,
    pierce: { x: 10, y: 10 },
    moves: [
      { type: "rapid", to: { x: 10, y: 10 } },
      { type: "pierce", at: { x: 10, y: 10 } },
      { type: "thc", on: true },
      { type: "line", to: { x: 20, y: 10 }, feed: 2000, tag: "contour" },
      { type: "thc", on: false },
      { type: "cutOff" },
    ],
  };
  return { blocks: [block] };
}
