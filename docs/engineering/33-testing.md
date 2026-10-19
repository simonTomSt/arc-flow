# 33 · Testing

`pnpm test` runs Vitest across `packages/*/test`. Keep it fast (< 2 s) and green on every change.

| Layer | What to test | Where |
|---|---|---|
| Geometry | areas (exact with arcs), orientation, offsets keep arcs, rotateStart, bulge → arc, chaining with gaps/duplicates | `core/test/geometry.test.ts` |
| Synergy | each rule with real numbers from the design (Ø5 → centre/60 %/THC off; Ø30 → line+arc 8 mm), overrides keep `auto`, Assisted review flag, ordering | `core/test/synergy.test.ts` |
| Toolpath | pierce inside holes and clear of walls, outside outlines; GRBL path offset by kerf/2 | same |
| Validation | design scenarios (40 mm lead in Ø30 → error, max 25,5), demo project clean | same |
| Cut chart | interpolation, kerf calibration (design F → 1,66) | same |
| Posts | golden files per post, pairing checks, compensation word placement, Y sign, file name rules | `post/test/post.test.ts` |
| UI | (to add) Playwright smoke: app loads, select contour, override + restore, export dialog shows G-code | `apps/desktop/e2e/` |

Golden rules: never update golden files to make a test pass without understanding the diff. Add a new golden case when you add a post or a G-code-affecting feature (e.g. overcut, lead-out, marking).

Property tests worth adding: random polygons → offset then area relation; random DXF chains shuffled/reversed → same contours.
