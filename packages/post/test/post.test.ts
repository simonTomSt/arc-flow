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
  it("matches golden file", () => golden("demo.f2100k.nc", r.text));
  it("starts like the design preview", () => {
    expect(r.lines.slice(0, 2)).toEqual(["(ArcFlow - S235 4mm 45A)", "G21 G90"]);
  });
  it("every M07 has its M08 and comp is G41 on the first lead move", () => {
    expect(r.warnings.filter((w) => w.includes("≠"))).toEqual([]);
    const i = r.lines.findIndex((l) => l.startsWith("G41"));
    expect(r.lines[i]).toMatch(/^G41 G0[123] /);
  });
  it("top-left zero → negative Y", () => {
    expect(r.lines.find((l) => l.startsWith("G00 X"))).toMatch(/Y-\d/);
  });
  it("flags unverified codes", () => {
    expect(r.warnings.some((w) => w.includes("unverified"))).toBe(true);
  });
  it("file name ≤ 8 chars, upper case", () => {
    expect(fileName(getPost("f2100k"), "Kołnierze_DN150")).toBe("KOLNIERZ.NC");
  });
});

describe("GRBL post", () => {
  const r = gcode(grblTable);
  it("matches golden file", () => golden("demo.grbl.nc", r.text));
  it("no G41/G42, relay M03/M05 paired", () => {
    expect(r.text).not.toMatch(/G4[12]/);
    expect(r.warnings.filter((w) => w.includes("≠"))).toEqual([]);
  });
});
