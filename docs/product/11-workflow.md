# 11 · Main workflow

```
[Nowy projekt] → [Import DXF / Szkic] → [Materiał + grubość + prąd + dysza]
   → [GENERUJ (Synergia)] → [Podgląd ścieżek + powody] → [Korekty] → [Symulacja] → [Walidacja] → [Eksport G-code]
```

Code pipeline (all pure, in `packages/core`, recomputed on every change):

```
importDxf(text)            → contours + ImportReport          import/dxf.ts
lookupCutChart(chart, preset) → CutChartRow (exact or interpolated) cutchart/lookup.ts
generateOperations(...)    → Operation[] (auto + overrides, ordered) cam/synergy.ts, cam/order.ts
buildToolpath(...)         → Toolpath (moves, machine-independent) cam/toolpath.ts
validate(...)              → Issue[]                          validate/validate.ts
estimate(...)              → pierces, length, time            cam/estimate.ts
runPost(post, toolpath, ctx) → G-code text + warnings         packages/post/src/engine.ts
```

## DXF import and automatic cleanup (spec §4.1)
| Step | Status in starter |
|---|---|
| LINE, ARC, CIRCLE, LWPOLYLINE/POLYLINE with bulges → lines/arcs | ✅ |
| Merge duplicate entities | ✅ (exact duplicates within tolerance) |
| Join endpoints within tolerance (default 0.01 mm) and count fixed gaps | ✅ |
| Closed vs open contours; part → hole → island hierarchy | ✅ `classify()` |
| Units from `$INSUNITS`, inch → mm; warn when unknown | ✅ (suspicious-scale heuristics: TODO) |
| SPLINE / ELLIPSE → arcs by biarc fitting with tolerance | ❌ reported as unsupported (M1) |
| Overlapping (not identical) entity merge | ❌ (M1) |
| Layer → operation mapping (`CUT`, `MARK`, `IGNORE`, `PUNKT`) | ❌ (layer is stored on each contour) |
| Import report screen ("Naprawiono 12 przerw, 3 duplikaty…") with open contours in red | ❌ UI (M1); data is in `ImportReport` |

## Sketcher (spec §4.2, design E)
Not started. Plan: planegcs (WASM) solver, tools line/arc/circle/rect/polygon/slot/spline/offset/fillet/chamfer/trim/mirror/patterns/text, constraints + driving dimensions, sketch state colouring (under/fully/over-constrained), project parameters (`grubosc = 4`, `otwor = grubosc * 2`), parametric shape library. See M7 in the implementation plan.
