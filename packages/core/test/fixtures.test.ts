import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importDxf } from "../src/import/dxf";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "fixtures", name), "utf8");

describe("plate-100x60.dxf fixture", () => {
  it("imports as 3 closed contours in millimetres", () => {
    const r = importDxf(fixture("plate-100x60.dxf"));
    expect(r.report.units).toBe("mm");
    expect(r.report.closedContours).toBe(3);
    expect(r.report.openContours).toBe(0);
    expect(r.contours).toHaveLength(3);
    for (const c of r.contours) expect(c.closed).toBe(true);
  });
});
