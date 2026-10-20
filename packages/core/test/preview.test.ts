import { describe, it, expect } from "vitest";
import { machinePreviewToolpath } from "../src/cam/preview";

describe("machinePreviewToolpath", () => {
  it("has one block with pierce → thc on → cut → thc off → cutOff", () => {
    const tp = machinePreviewToolpath();
    expect(tp.blocks).toHaveLength(1);
    const kinds = tp.blocks[0]!.moves.map((m) => m.type);
    expect(kinds).toEqual(["rapid", "pierce", "thc", "line", "thc", "cutOff"]);
  });

  it("block.order is 1 so cutNo substitutions produce a valid number", () => {
    const tp = machinePreviewToolpath();
    expect(tp.blocks[0]!.order).toBe(1);
  });
});
