import { describe, expect, it } from "vitest";
import { scaleWarnings } from "../src/import/dxf";
import { roundedRect } from "../src/project/demo";

describe("scaleWarnings", () => {
  it("flags contours larger than the sheet", () => {
    const c = roundedRect("r", 0, 0, 5000, 300, 0);
    const w = scaleWarnings([c], { widthMm: 1500, heightMm: 3000 });
    expect(w.join(" ")).toMatch(/larger than the sheet/);
  });

  it("falls back to the 3 m default when no sheet is given", () => {
    const c = roundedRect("r", 0, 0, 4000, 100, 0);
    const w = scaleWarnings([c]);
    expect(w.join(" ")).toMatch(/3 m/);
  });

  it("flags sub-millimetre contours as a scale problem", () => {
    const c = roundedRect("r", 0, 0, 0.5, 0.3, 0);
    const w = scaleWarnings([c], { widthMm: 1500, heightMm: 3000 });
    expect(w.join(" ")).toMatch(/smaller than 1 mm/);
  });

  it("stays quiet for a normal plate", () => {
    const c = roundedRect("r", 0, 0, 200, 100, 10);
    expect(scaleWarnings([c], { widthMm: 1500, heightMm: 3000 })).toEqual([]);
  });
});
