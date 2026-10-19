import { type Contour } from "../geometry/contour";
import { arc, line } from "../geometry/segment";
import type { Vec2 } from "../geometry/vec";
import type { Project } from "./project";

/** Rounded rectangle, CCW, starting mid-left edge. */
export function roundedRect(id: string, x: number, y: number, w: number, h: number, r: number): Contour {
  const p = (px: number, py: number): Vec2 => ({ x: px, y: py });
  const segs = [
    line(p(x, y + h - r), p(x, y + r)),
    arc(p(x, y + r), p(x + r, y), p(x + r, y + r), true),
    line(p(x + r, y), p(x + w - r, y)),
    arc(p(x + w - r, y), p(x + w, y + r), p(x + w - r, y + r), true),
    line(p(x + w, y + r), p(x + w, y + h - r)),
    arc(p(x + w, y + h - r), p(x + w - r, y + h), p(x + w - r, y + h - r), true),
    line(p(x + w - r, y + h), p(x + r, y + h)),
    arc(p(x + r, y + h), p(x, y + h - r), p(x + r, y + h - r), true),
  ];
  return { id, segments: r > 0 ? segs : segs.filter((s) => s.kind === "line"), closed: true, layer: "CUT" };
}

export function circle(id: string, cx: number, cy: number, d: number): Contour {
  const p = { x: cx + d / 2, y: cy };
  return { id, segments: [arc(p, p, { x: cx, y: cy }, true, true)], closed: true, layer: "CUT" };
}

/** "Wspornik WS-02" from the design: 160×110 R10, 6× Ø5, Ø30 centre hole. */
export function wspornikWS02(prefix: string, x: number, y: number): Contour[] {
  const holes = [
    [14, 14],
    [80, 14],
    [146, 14],
    [146, 96],
    [80, 96],
    [14, 96],
  ].map(([dx, dy], i) => circle(`${prefix}h${i + 1}`, x + dx!, y + dy!, 5));
  return [...holes, circle(`${prefix}h30`, x + 80, y + 55, 30), roundedRect(`${prefix}outer`, x, y, 160, 110, 10)];
}

export function demoProject(): Project {
  return {
    format: "arcflow",
    version: 1,
    name: "Wspornik_WS-02",
    sheet: { widthMm: 600, heightMm: 400 },
    machineId: "toploong-1325",
    chartId: "pmx45-s235-1.1",
    preset: { material: "S235", thicknessMm: 4, currentA: 45, nozzle: "1.1" },
    mode: "synergic",
    // y-up internal coordinates: y = 270 puts the parts near the top-left program zero
    contours: [...wspornikWS02("a-", 20, 270), ...wspornikWS02("b-", 200, 270)],
    overrides: {},
  };
}
