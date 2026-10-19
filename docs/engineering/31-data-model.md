# 31 · Data model

TypeScript is the schema; these are summaries. Files are JSON, UTF-8, versioned.

## Project — `.arcflow` (`packages/core/src/project/project.ts`)
```jsonc
{
  "format": "arcflow", "version": 1,
  "name": "Kołnierze_DN150",
  "sheet": { "widthMm": 2500, "heightMm": 1250 },
  "machineId": "toploong-1325",
  "chartId": "pmx45-s235-1.1",
  "preset": { "material": "S235", "thicknessMm": 4, "currentA": 45, "nozzle": "1.1" },
  "mode": "synergic",                       // synergic | assisted | manual
  "contours": [ { "id": "c1", "closed": true, "layer": "CUT", "segments": [ /* line | arc */ ] } ],
  "overrides": { "c7": { "overcutMm": 0.8, "leadIn": { "type": "line", "lengthMm": 25.5, "angleDeg": 90 } } }
}
```
Planned (M4–M8): `parts[]` with source DXF + transform (position, rotation, mirror), quantities, project parameters, part-level overrides, nesting result, remnant reference.

## Segment
`{ kind: "line", a, b }` · `{ kind: "arc", a, b, c, ccw, full? }`. Points `{ x, y }` in mm, Y up.

## Operation (computed, never saved) — `cam/types.ts`
`{ id, contourId, partId, role, order, sizeMm, action, direction, side, startAt, leadIn, leadOut, overcutMm, speedPct, thc, reasons[], needsReview }` where each parameter is `Param<T> = { value, auto, source }`.

## Cut chart — separate files, importable/exportable
`CutChart { id, name, source (plasma unit), rows: CutChartRow[] }`, row key = material + thicknessMm + currentA + nozzle → kerfMm, feedMmMin, pierceHeightMm, pierceDelayS, cutHeightMm, arcVoltageV?, source (factory | calibrated | manual | interpolated), calibratedAt?, note?. Starter preset: `cutchart/presets.ts` (values from design F, marked for calibration).

## Machine profile — `project/machine.ts`
`{ id, name, description, controller, postId, workAreaMm, swirl, hasTHC, heightsInProgram, travelHeightMm, ihs, controllerCompensation, rapidMmMin, origin, originOffsetMm, marker? }`.

## Postprocessor — `packages/post/posts/*.post.json`
See `32-postprocessors.md`.

## Libraries (design L1–L3)
Nozzles, machines, posts, cut charts and materials are shared across projects in a user library folder (Tauri app data dir) with "Eksportuj kopię zapasową". Not implemented; keep each library a folder of JSON files so they diff and back up easily.

## Versioning
Every file has `version`. Add a migration function per bump in `project/migrations.ts` (create when first needed) and a test that loads the previous version.
