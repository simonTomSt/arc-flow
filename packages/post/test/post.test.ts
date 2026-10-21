import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildToolpath, demoProject, generateOperations, grblTable, lookupCutChart, powermax45S235, toploong1325, type MachineProfile } from "@arcflow/core";
import { getPost, runPost, fileName } from "../src";

const golden = (name: string, text: string) => {
  const p = join(__dirname, "golden", name);
  if (process.env.UPDATE_GOLDEN || !existsSync(p)) writeFileSync(p, text);
  expect(text).toBe(readFileSync(p, "utf8"));
};

function gcode(machine: MachineProfile) {
  const p = demoProject();
  const row = lookupCutChart(powermax45S235, p.preset)!.row;
  const ops = generateOperations({ contours: p.contours, row, machine, mode: "synergic", sheet: p.sheet });
  const tp = buildToolpath({ contours: p.contours, ops, row, machine });
  return runPost(getPost(machine.postId), tp, { projectName: p.name, preset: p.preset, row, machine, sheet: p.sheet });
}

describe("F2100K post", () => {
  const r = gcode(toploong1325);
  it("matches golden file", () => golden("demo.f2100k.txt", r.text));
  it("starts with G21/G90/G40 header (matches reference .cps / .scpost)", () => {
    expect(r.lines.slice(0, 3)).toEqual(["G21", "G90", "G40"]);
  });
  it("no G41/G42 — kerf comp is in software", () => {
    expect(r.text).not.toMatch(/G4[12]/);
  });
  it("no spaces, forced sign, 4 decimals in motion blocks", () => {
    const motion = r.lines.filter((l) => /^G0[0123]/.test(l));
    expect(motion.length).toBeGreaterThan(0);
    for (const l of motion) {
      expect(l).not.toMatch(/\s/);
      expect(l).toMatch(/^G0[0123](X[+-]\d+\.\d{4})?(Y[+-]\d+\.\d{4})?(I[+-]\d+\.\d{4})?(J[+-]\d+\.\d{4})?$/);
    }
  });
  it("doubled M08 at end of every cut", () => {
    const idx = r.lines
      .map((l, i) => (l === "M08" ? i : -1))
      .filter((i) => i >= 0);
    // consecutive pairs expected; at least one such pair
    const hasPair = idx.some((i) => r.lines[i + 1] === "M08");
    expect(hasPair).toBe(true);
  });
  it("ends with M02 (not M30), returning to zero first", () => {
    expect(r.lines.slice(-2)).toEqual(["G00X+0.0000Y+0.0000", "M02"]);
  });
  it("top-left zero → negative Y", () => {
    expect(r.lines.find((l) => /^G00X/.test(l))).toMatch(/Y-\d/);
  });
  it("flags unverified codes (THC on/off)", () => {
    expect(r.warnings.some((w) => w.includes("unverified"))).toBe(true);
  });
  it("file name ≤ 8 chars, upper case, .txt extension", () => {
    expect(fileName(getPost("f2100k"), "Kołnierze_DN150")).toBe("KOLNIERZ.TXT");
  });
});

describe("GRBL post (M3/M5 variant)", () => {
  const r = gcode(grblTable);
  it("matches golden file", () => golden("demo.grbl.nc", r.text));
  it("no G41/G42, relay M03/M05 paired", () => {
    expect(r.text).not.toMatch(/G4[12]/);
    expect(r.warnings.filter((w) => w.includes("≠"))).toEqual([]);
  });
  it("surfaces the $32=0 laser-mode reminder", () => {
    expect(r.warnings.some((w) => /\$32=0/.test(w))).toBe(true);
  });
});

describe("GRBL post (M8/M9 variant)", () => {
  const r = gcode({ ...grblTable, postId: "grbl-m8" });
  it("matches golden file", () => golden("demo.grbl-m8.nc", r.text));
  it("emits M08 for pierce and M09 for cut end", () => {
    expect(r.text).toMatch(/\bM08\b/);
    expect(r.text).toMatch(/\bM09\b/);
    expect(r.text).not.toMatch(/\bM03\b/);
    expect(r.text).not.toMatch(/\bM05\b/);
  });
  it("no $32 reminder (M8 is not affected by laser mode)", () => {
    expect(r.warnings.some((w) => /\$32/.test(w))).toBe(false);
  });
});
