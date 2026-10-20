import { describe, it, expect } from "vitest";
import { defaultNozzles, parseNozzles, serializeNozzles, type NozzleLibrary } from "../src";

describe("nozzle library", () => {
  it("starter set covers 0.8 / 1.0 / 1.1 / 1.2", () => {
    const labels = defaultNozzles.nozzles.map((n) => n.label);
    expect(labels).toEqual(["0.8", "1.0", "1.1", "1.2"]);
  });

  it("round-trips via serialize/parse", () => {
    const back = parseNozzles(serializeNozzles(defaultNozzles));
    expect(back).toEqual(defaultNozzles);
  });

  it("rejects wrong format", () => {
    expect(() => parseNozzles(JSON.stringify({ format: "other", version: 1, library: {} }))).toThrow(/nozzle/);
  });

  it("rejects unsupported version", () => {
    expect(() => parseNozzles(JSON.stringify({ format: "arcflow-nozzles", version: 2, library: {} }))).toThrow(/version/);
  });

  it("rejects a nozzle with the wrong field type", () => {
    const bad = {
      format: "arcflow-nozzles",
      version: 1,
      library: { id: "x", nozzles: [{ id: "n", label: "1.1", diameterMm: "1.1", defaultKerfMm: 1.5 }] },
    };
    expect(() => parseNozzles(JSON.stringify(bad))).toThrow(/diameterMm/);
  });

  it("drops malformed currentBand but keeps the nozzle", () => {
    const good: NozzleLibrary = { id: "x", nozzles: [{ id: "n", label: "1.1", diameterMm: 1.1, defaultKerfMm: 1.5 }] };
    const back = parseNozzles(serializeNozzles(good));
    expect(back.nozzles[0]!.currentBand).toBeUndefined();
  });
});
