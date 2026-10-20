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
`CutChart { id, name, source (plasma unit), rows: CutChartRow[] }`, row key = material + thicknessMm + currentA + nozzle → kerfMm, feedMmMin, pierceHeightMm, pierceDelayS, cutHeightMm, arcVoltageV?, source (factory | calibrated | manual | interpolated), calibratedAt?, note?, rules? (Partial<SynergyRules>). Starter preset: `cutchart/presets.ts` (values from design F, marked for calibration). On-disk envelope: `{ format: "arcflow-cutchart", version: 1, chart }` (`cutchart/io.ts`, `serializeCutChart` / `parseCutChart`). Row-level quality checks live in `cutChartIssues(chart, { hasTHC?, rapidMmMin? })` and the F table renders them inline. Row-level `rules` tune Synergy thresholds for just that row and are merged `defaults ⟵ row.rules ⟵ input.rules` inside `generateOperations` / `validate` — so a project override still wins.

## Machine profile — `project/machine.ts`
`{ id, name, description, controller, postId, workAreaMm, swirl, hasTHC, heightsInProgram, travelHeightMm, ihs, controllerCompensation, rapidMmMin, origin, originOffsetMm, marker? }`. The library is held on the UI store (`state.machines`), persisted in localStorage, and edited through design screen L2. `machineTemplates` in `apps/desktop/src/state/store.tsx` lists the two starter profiles used by "Nowa z szablonu"; they clone on use and are never edited in place. The "Co z tego wynika" preview in L2 runs the real post engine against `machinePreviewToolpath` (`cam/preview.ts`), so the shown G-code is produced the same way as export.

## Postprocessor — `packages/post/posts/*.post.json`
See `32-postprocessors.md`.

## Libraries (design L1–L3)
Nozzles, machines, posts, cut charts and materials are shared across projects. Under Tauri they live in `<appDataDir>/arcflow/library/{chart,machines,nozzles}.json` (`apps/desktop/src/platform/library.ts`); in the browser they fall back to localStorage. Loading happens on mount, saving happens on change. "Kopia zapasowa bibliotek" (TopBar) exports chart + machines + nozzles in a single `arcflow-library-backup` envelope. Nozzle library: `Nozzle { id, label, diameterMm, defaultKerfMm, currentBand?, note? }`; chart rows still join nozzles by `label` so externally-sourced charts work without translation.

## Versioning
Every file has `version`. Add a migration function per bump in `project/migrations.ts` (create when first needed) and a test that loads the previous version.
