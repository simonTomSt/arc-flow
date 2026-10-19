import { dist, type Vec2 } from "../geometry/vec";
import { arc, segLength } from "../geometry/segment";
import type { CutChartRow } from "../cutchart/types";
import type { MachineProfile } from "../project/machine";
import type { Toolpath } from "./types";

export interface Estimate {
  pierces: number;
  cutLengthMm: number;
  rapidLengthMm: number;
  cutTimeS: number;
  rapidTimeS: number;
  pierceTimeS: number;
  totalTimeS: number;
}

/** Bottom bar numbers ("{{ pierceN }} cięć · {{ timeStr }} · {{ lenStr }}"). Ignores acceleration. */
export function estimate(tp: Toolpath, row: CutChartRow, machine: MachineProfile, start: Vec2 = { x: 0, y: 0 }): Estimate {
  let pos = start;
  let cutLen = 0;
  let cutTime = 0;
  let rapidLen = 0;
  for (const b of tp.blocks) {
    for (const m of b.moves) {
      if (m.type === "rapid") {
        rapidLen += dist(pos, m.to);
        pos = m.to;
      } else if (m.type === "line") {
        const l = dist(pos, m.to);
        cutLen += l;
        cutTime += (l / m.feed) * 60;
        pos = m.to;
      } else if (m.type === "arc") {
        const l = segLength(arc(pos, m.to, m.center, m.ccw, m.full));
        cutLen += l;
        cutTime += (l / m.feed) * 60;
        pos = m.to;
      }
    }
  }
  const pierces = tp.blocks.length;
  const pierceTimeS = pierces * row.pierceDelayS;
  const rapidTimeS = (rapidLen / machine.rapidMmMin) * 60;
  return {
    pierces,
    cutLengthMm: cutLen,
    rapidLengthMm: rapidLen,
    cutTimeS: cutTime,
    rapidTimeS,
    pierceTimeS,
    totalTimeS: cutTime + rapidTimeS + pierceTimeS,
  };
}

export const formatDuration = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
