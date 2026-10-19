# 30 · Architecture

## Decision: Tauri 2 + React + TypeScript (spec §9 left Tauri vs Electron open)
Chosen **Tauri**: small installer (~10 MB vs ~100 MB), native save dialogs, Rust available for heavy geometry later, and the whole CAM core stays in TypeScript so it runs identically in tests, the browser dev build and the desktop app. Revisit only if a needed native integration is Electron-only.

## Layers
```
apps/desktop  (React UI, Canvas renderer, i18n, Tauri shell)
   │  reads derived data via useDerived(); writes only project + overrides
   ▼
packages/post (declarative posts + G-code engine)       ← JSON posts, golden tests
   │
packages/core (pure TS, no DOM/Node)
   geometry/  vec, segment (line/arc), contour, offset
   import/    DXF → contours + report
   cutchart/  types, lookup + interpolation, kerf calibration, presets
   cam/       classify → synergy (auto + overrides) → order → toolpath → estimate, reasons
   validate/  issues, blocksExport
   project/   Project (.arcflow), MachineProfile, demo
```

Rules: `core` has no UI or I/O; `post` knows controllers, `core` knows only capabilities; UI state is the `Project` plus view state, everything else is recomputed (cheap enough for interactive editing at shop-part sizes; memoised per project change).

## Geometry
- Segments are **lines and circular arcs** (centre, endpoints, direction, `full` for circles). Arcs survive end to end so G-code uses G02/G03.
- Internal units mm, Y up. Screen flip in the canvas transform; machine origin in the post engine.
- Offsetting (`geometry/offset.ts`) is analytic: lines shift, arcs change radius, outside corners get round joins, inside corners are trimmed by curve intersection. Throws `OffsetUnsupportedError` when segments collapse → planned fallback: **Clipper2** on the tessellated polygon + arc refit.
- SPLINE/ELLIPSE → biarc fitting (TODO, M1).
- Constraint solver for the sketcher: **planegcs** (FreeCAD) as WASM (LGPL, see business/03).

## Rendering
Canvas 2D in the starter (`apps/desktop/src/canvas/CamCanvas.tsx`), Path2D per contour, Y-flip transform, pan (middle/right/Alt drag), wheel zoom about the cursor, click-select by distance. Move to WebGL (regl or PixiJS) when part counts make Canvas 2D slow; keep the component API.

## Data flow in the UI
`StoreProvider` (useReducer) holds `UiState { project, workspace, selection, theme, … }`. `useDerived(state)` runs: cut chart lookup → `generateOperations` → `buildToolpath` → `validate` → `estimate`. Components never mutate operations; they dispatch `override` / `restoreAuto` on the project.

## Machine communication
F2100K: write the file (USB). GRBL: write the file now; serial/WebSerial streaming with buffer, jog, home, zero is post-MVP and would live in a separate package with its own Tauri plugin.

## Performance budget
Full recompute for a 20-part sheet < 50 ms in the browser. If exceeded: memoise per contour, move offset/nesting to a Web Worker, then consider Rust/WASM.
