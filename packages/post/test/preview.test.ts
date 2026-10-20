import { describe, expect, it } from "vitest";
import {
  lookupCutChart,
  machinePreviewToolpath,
  powermax45S235,
  toploong1325,
  type MachineProfile,
} from "@arcflow/core";
import { getPost, runPost } from "../src";

/**
 * Design L2 "Co z tego wynika": the preview must swap codes in and out of the
 * G-code as the operator toggles THC / Heights in program. These tests pin
 * that promise against the real F2100K post, not the content of the mock-up.
 */
function render(machine: MachineProfile) {
  const look = lookupCutChart(powermax45S235, {
    material: "S235",
    thicknessMm: 4,
    currentA: 45,
    nozzle: "1.1",
  })!;
  return runPost(getPost(machine.postId), machinePreviewToolpath(), {
    projectName: "preview",
    preset: { material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1" },
    row: look.row,
    machine,
    sheet: { widthMm: 1500, heightMm: 3000 },
  });
}

describe("machine preview", () => {
  it("Toploong-stock (THC + heights) emits Z-moves and THC-on", () => {
    const r = render(toploong1325);
    expect(r.lines.some((l) => /Z\d/.test(l))).toBe(true);
    expect(r.lines.some((l) => /\bM50\b/.test(l))).toBe(true);
  });

  it("hasTHC=false removes M50 but keeps the pierce / cut moves", () => {
    const r = render({ ...toploong1325, hasTHC: false });
    expect(r.lines.some((l) => /\bM50\b/.test(l))).toBe(false);
    // Pierce still happens — only THC codes drop out.
    expect(r.lines.some((l) => /\bM07\b/.test(l))).toBe(true);
  });

  it("heightsInProgram=false drops Z-lines from the pierce block", () => {
    const r = render({ ...toploong1325, heightsInProgram: false });
    expect(r.lines.some((l) => /\bZ\d/.test(l))).toBe(false);
  });

  it("both toggles off = a minimal pierce/cut block", () => {
    const r = render({ ...toploong1325, heightsInProgram: false, hasTHC: false });
    expect(r.lines.some((l) => /\bZ\d/.test(l))).toBe(false);
    expect(r.lines.some((l) => /\bM50\b/.test(l))).toBe(false);
    expect(r.lines.some((l) => /\bM07\b/.test(l))).toBe(true);
    expect(r.lines.some((l) => /\bM08\b/.test(l))).toBe(true);
  });
});
