import { describe, expect, it } from "vitest";
import { applyLayerRoles, defaultLayerMap, detectLayerRole } from "../src/import/layers";
import { roundedRect } from "../src/project/demo";

describe("layer role detection", () => {
  it("maps common layer names", () => {
    expect(detectLayerRole("CUT")).toBe("cut");
    expect(detectLayerRole("Ciecie")).toBe("cut");
    expect(detectLayerRole("MARK")).toBe("mark");
    expect(detectLayerRole("engraving")).toBe("mark");
    expect(detectLayerRole("PUNKT")).toBe("punch");
    expect(detectLayerRole("IGNORE")).toBe("ignore");
    expect(detectLayerRole("DEFPOINTS")).toBe("ignore");
  });

  it("defaults unknown names to cut", () => {
    expect(detectLayerRole("Layer_1")).toBe("cut");
    expect(detectLayerRole("0")).toBe("cut");
  });

  it("builds a default map covering every layer", () => {
    const contours = [
      { ...roundedRect("a", 0, 0, 10, 10, 0), layer: "CUT" },
      { ...roundedRect("b", 20, 0, 10, 10, 0), layer: "MARK" },
      { ...roundedRect("c", 40, 0, 10, 10, 0), layer: "IGNORE" },
    ];
    const map = defaultLayerMap(contours);
    expect(map).toEqual({ CUT: "cut", MARK: "mark", IGNORE: "ignore" });
  });

  it("drops IGNORE contours and forces action=mark on MARK contours", () => {
    const contours = [
      { ...roundedRect("a", 0, 0, 10, 10, 0), id: "a", layer: "CUT" },
      { ...roundedRect("b", 20, 0, 10, 10, 0), id: "b", layer: "MARK" },
      { ...roundedRect("c", 40, 0, 10, 10, 0), id: "c", layer: "IGNORE" },
    ];
    const map = defaultLayerMap(contours);
    const { contours: kept, overrides } = applyLayerRoles(contours, map);
    expect(kept.map((c) => c.id)).toEqual(["a", "b"]);
    expect(overrides).toEqual({ b: { action: "mark" } });
  });
});
