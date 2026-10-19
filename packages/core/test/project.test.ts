import { describe, expect, it } from "vitest";
import { demoProject, parseProject, serializeProject } from "../src/project";
import { translateContour } from "../src/geometry/contour";
import { roundedRect } from "../src/project/demo";

describe("project serialisation", () => {
  it("round-trips the demo project byte-for-byte", () => {
    const p = demoProject();
    const text = serializeProject(p);
    const roundTripped = parseProject(text);
    expect(serializeProject(roundTripped)).toEqual(text);
  });

  it("rejects unknown formats and versions", () => {
    expect(() => parseProject(JSON.stringify({ format: "nope", version: 1 }))).toThrow(/arcflow/);
    expect(() => parseProject(JSON.stringify({ format: "arcflow", version: 999 }))).toThrow(/version/);
  });
});

describe("translateContour", () => {
  it("shifts every endpoint and arc centre", () => {
    const r = roundedRect("r", 0, 0, 10, 10, 2);
    const shifted = translateContour(r, 100, 50);
    for (const s of shifted.segments) {
      expect(s.a.x).toBeGreaterThanOrEqual(100);
      expect(s.a.y).toBeGreaterThanOrEqual(50);
      if (s.kind === "arc") {
        expect(s.c.x).toBeGreaterThanOrEqual(100);
        expect(s.c.y).toBeGreaterThanOrEqual(50);
      }
    }
  });
});
