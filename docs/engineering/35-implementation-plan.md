# 35 · Implementation plan

Work milestone by milestone (`/next-milestone`). Each item: tests first for core logic, docs updated, `pnpm test` + `pnpm typecheck` green. Tick `[x]` when done and add discoveries.

## M0 · Starter (this kit) ✅
- [x] pnpm workspace, strict TS, Vitest, Vite + React UI, Tauri 2 shell
- [x] Geometry: lines/arcs, exact area, containment, offset with arcs, rotateStart, corners
- [x] DXF import: LINE/ARC/CIRCLE/LWPOLYLINE(bulge)/POLYLINE, dedupe, gap join, report data
- [x] Classification part/hole/island; Synergy: direction, side, leads, small holes, THC, order; reasons PL/EN
- [x] Override model `Param<T>` + overrides + restore auto; modes Synergic/Assisted/Manual (logic)
- [x] Toolpath with tagged moves; estimate; validation (9 rules)
- [x] Posts F2100K (unverified) + GRBL, golden tests
- [x] CAM screen: browser, canvas, properties + Dlaczego?, order bar, export dialog with live G-code

## M1 · Import that never surprises (spec §4.1, screen A)
- [x] Start screen A: drop DXF/SVG, recent projects, machine cards, default material, mode, language, touch toggle
- [x] Import report screen: counts + highlighted repairs, open contours red, accept → CAM
- [x] SPLINE + ELLIPSE → biarc fitting with tolerance (tests: max deviation ≤ tol)
- [x] Overlapping collinear lines/arcs merge; zero-length segment removal
- [x] Units/scale sanity warning (part > sheet, part < 1 mm)
- [x] Layer mapping CUT / MARK / PUNKT / IGNORE (+ UI)
- [x] Several DXFs onto one sheet; `.arcflow` save/open (Tauri dialogs)
**Accept:** customer DXF with splines, gaps and duplicates imports with a report; G-code has only G01/G02/G03.

Discoveries during M1:
- Start screen only remembers one recent entry so far — `localStorage` + thumbnails come with the project browser (M2/M8).
- `.arcflow` save/open uses the Tauri plugin APIs when available, with a browser fallback via `<input type=file>`/download — no new project format needed for M1.
- Multi-DXF import stages one file at a time through the Import report screen; the second DXF appended through the same report lands next to the first on the sheet (sheet-fill nesting is M8).
- Biarc fitting lives in `packages/core/src/import/{biarc,curves}.ts`; it covers DXF SPLINE (non-rational B-spline from control points + knots) and ELLIPSE. Weighted/periodic NURBS and ELLIPSE's major-axis extrusion will come back as a real case appears.

## M2 · Cut charts & machines (screens F, L1, L2)
- [ ] Library storage (app data dir, JSON per item, backup export)
- [x] Cut chart manager UI (screen F) with source badges; interpolation already warns in `lookupCutChart`
- [x] Kerf calibration wizard (3 steps) writing to the chart (`applyCalibration` + screen F)
- [ ] Chart import/export; out-of-range warnings surfaced in the F table
- [ ] Nozzle library (L1); machine profiles editor (L2) with "Co z tego wynika" G-code preview
- [ ] Rules overrides per chart row (small-hole k, lead k…)
**Accept:** change thickness → speeds/kerf/leads follow; interpolated rows warn.

Discoveries during M2 (screen F):
- The chart is held mutably on the UI store (`state.chart`, seeded from `powermax45S235`); core stays pure via `editCutChartRow` / `applyCalibration`.
- `applyCalibration` rounds to 3 decimals and stamps `calibratedAt` with the day the dispatch runs (user-local date).
- Screen F opens as a modal from the top menu bar ("Tabele cięcia"). It is deliberately not a workspace tab — the design treats it as a library view, outside the project workspaces.
- Wizard warns when outer-vs-hole spread > 0,1 mm, matching the design's "sprawdź pomiary" hint.

## M3 · Verified output (screens L3, I)
- [ ] `/verify-post` against the owner's `.cps`; resolve every F2100K open question; empty `unverified`
- [ ] THC off/lock code for small holes; IHS; Pierce Up Time workaround
- [ ] GRBL relay variant M8/M9; laser-mode warning in profile
- [ ] Post editor UI with block list, variable chips, number format, preview highlighting (`sources`)
- [ ] Export: folder memory (E:\), 8.3 file names, "Napraw wszystko", conscious override of errors
**Accept:** a sample sheet cut on the Toploong matches the drawing ±0,2 mm, no dross drops at lead-ins.

## M4 · Editing & assisted mode (screens C, AS, M, T)
- [ ] Tool strip + tool cards; Lead-in tool with draggable start point along the contour (live)
- [ ] Problems panel with proposals, Zalecane, apply to similar, Zastosuj zalecane (N)
- [ ] Lead-in must not cross other contours; torch-off before closing holes
- [ ] Project- and part-level overrides (hierarchy complete)
- [ ] Extended tooltips (T) with diagrams and project values
- [ ] Order list in the bottom panel (drag to reorder → override)
**Accept:** the AS and M scenarios from the design work end to end.

## M5 · Simulation & safety (screen S)
- [ ] Playback with speeds, kerf trail, speed heatmap, pierce points, jump to cut
- [ ] Check rapids over cut parts; avoid/raise (also X4)
- [ ] Time estimate with acceleration
**Accept:** design S checks reproduce on the demo sheet.

## M6 · Part position & corners (screens R, K)
- [ ] Parts with transforms; rotate/mirror; operations recompute; manual overrides travel with the part
- [ ] Sheet zero point + offset; grain direction constraint
- [ ] Corner strategies: sharp / rounded / loop with fallback and impact line

## M7 · Sketcher (screen E)
- [ ] planegcs WASM integration (licence note), tools, constraints, dimensions, sketch state, parameters, shape library, text → contours (stencil)

## M8 · Nesting & production (screens N, X1–X8, P)
- [ ] Rectangular nesting → true shape (NFP), 3 proposals, small parts in holes
- [ ] Remnants store; common line; micro-bridges; chain cutting; thermal order
- [ ] Marking/punch (P) with tool offset; quick quote (X7); operator report PDF (X8)

## M9 · Beyond
- [ ] GRBL streaming (serial/WebSerial), jog/home/zero
- [ ] More posts (QtPlasmaC, Mach3/4, grblHAL); touch/tablet polish; English UI review
