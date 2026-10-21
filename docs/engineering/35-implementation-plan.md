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

## M2 · Cut charts & machines (screens F, L1, L2) ✅
- [x] Library storage (app data dir, JSON per item, backup export)
- [x] Cut chart manager UI (screen F) with source badges; interpolation already warns in `lookupCutChart`
- [x] Kerf calibration wizard (3 steps) writing to the chart (`applyCalibration` + screen F)
- [x] Chart import/export; out-of-range warnings surfaced in the F table
- [x] Nozzle library (L1)
- [x] Machine profiles editor (L2) with "Co z tego wynika" G-code preview
- [x] Rules overrides per chart row (small-hole k, lead k…)
**Accept:** change thickness → speeds/kerf/leads follow; interpolated rows warn.

Discoveries during M2 (screen F):
- The chart is held mutably on the UI store (`state.chart`, seeded from `powermax45S235`); core stays pure via `editCutChartRow` / `applyCalibration`.
- `applyCalibration` rounds to 3 decimals and stamps `calibratedAt` with the day the dispatch runs (user-local date).
- Screen F opens as a modal from the top menu bar ("Tabele cięcia"). It is deliberately not a workspace tab — the design treats it as a library view, outside the project workspaces.
- Wizard warns when outer-vs-hole spread > 0,1 mm, matching the design's "sprawdź pomiary" hint.
- Chart import/export uses an envelope `{ format: "arcflow-cutchart", version: 1, chart }` (`packages/core/src/cutchart/io.ts`). Import is guarded: if the file lacks a row that matches the project's current preset, the import is rejected with an inline error so CAM never crashes on `lookupCutChart`.
- Per-row warnings (`cutChartIssues`) use the active machine profile for THC-presence and rapid-speed checks; machine-independent checks catch non-positive kerf, pierce-below-cut (with the "pierce = 0 means start-from-edge" exception the preset uses at 16 mm), zero feed without a note, and duplicate keys.

Discoveries during M2 (screen L2):
- Machines are now UI state (`state.machines`), persisted to localStorage alongside recent/export/lang. Templates (`machineTemplates` = the two starter profiles) stay as module constants and feed "Nowa z szablonu" — editing starts from a clone, not the template itself.
- "Co z tego wynika" runs the real post engine against a synthetic 1-pierce / 1-line toolpath (`machinePreviewToolpath` in core). This way the preview is produced the same way export is — toggling `hasTHC` / `heightsInProgram` in the editor instantly changes which lines appear, and swapping the postId swaps the whole dialect without any mock copy.
- `deleteMachine` keeps at least one profile and refuses to delete the one the project points at — the UI disables the button and shows "Zmień projektową maszynę przed usunięciem"; swapping the project machine is one dropdown away in the top bar.
- "Używana w projektach" from the design is deliberately deferred: there is only one project in memory today, so faking the list would mislead. It becomes real once multi-project / recent-projects integration lands (M8).

Discoveries during M2 (row-level rules):
- `CutChartRow.rules?: Partial<SynergyRules>` carries per-row overrides. Merge order inside `generateOperations` and `validate`: `defaultRules ⟵ row.rules ⟵ input.rules`. A project-level override still wins because `input.rules` is applied last.
- Screen F shows a chevron on each row; expanding reveals the editable subset (`smallHoleK`, `smallHoleMinMm`, `smallHoleSpeedPct`, `leadInK`, `leadInMinMm`, `craterMarginMm`, `thcOffBelowLengthMm`, `defaultOvercutMm`) with "domyślnie X" placeholders and a ↺ restore button. Clearing a field drops the key — no stored zeros.
- `parseCutChart` filters `row.rules` to numeric keys only; a hand-edited JSON with a stray string or `NaN` loads cleanly instead of throwing.

Discoveries during M2 (screen L1 + library storage):
- Nozzles live in core (`packages/core/src/nozzle/`): `Nozzle`, `NozzleLibrary`, starter set (0,8 / 1,0 / 1,1 / 1,2) and `serializeNozzles` / `parseNozzles` with the `arcflow-nozzles` envelope. Chart rows still key by the nozzle `label` string — joining on `id` would break imported charts that didn't come from this app.
- Screen L1 is a modal with the shared libraries rail; "Używana w tabelach" is derived live from `state.chart.rows[].nozzle`, so edits propagate instantly. Machine-level allow-list is deferred (there's no UI yet to assign nozzles to a machine profile) and the panel explicitly says so.
- Library storage: `apps/desktop/src/platform/library.ts` writes one JSON per item to `<appDataDir>/arcflow/library/{chart,machines,nozzles}.json` under Tauri, and is a no-op in the browser (localStorage still covers that path). Startup loads whatever exists; machines/chart/nozzles effects save on every change — simple, no debouncing yet.
- "Kopia zapasowa bibliotek" in the top menu bundles chart + machines + nozzles into one `arcflow-library-YYYY-MM-DD.json` using the shared `saveTextFile` dialog. Importing a backup is deferred to M3; today the per-item import buttons (F / L1) cover the common case.
- Tauri capabilities grew `fs:allow-mkdir`, `fs:allow-exists`, `fs:allow-app-{write,read}-recursive`, and `core:path:default` so `appDataDir()` + `mkdir` work.

## M3 · Verified output (screens L3, I)
- [ ] `/verify-post` against the owner's `.cps`; resolve every F2100K open question; empty `unverified`
- [ ] THC off/lock code for small holes; IHS; Pierce Up Time workaround
- [x] GRBL relay variant M8/M9 (`grbl-m8` post); laser-mode `$32=0` reminder surfaced from the `grbl` post
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
