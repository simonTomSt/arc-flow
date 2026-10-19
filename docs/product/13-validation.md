# 13 · Validation

Runs in every mode. **Errors block export** (the user may consciously override — UI TODO), warnings and infos never block. Code: `packages/core/src/validate/validate.ts`. UI: export dialog (design I) and Problems panel (design AS/M).

| Code | Severity | Rule | Suggested fix | Status |
|---|---|---|---|---|
| `OPEN_CONTOUR_GAP` | error | open contour whose ends are < `suspectGapMm` (2 mm) apart — a broken outline ("przerwa 0,32 mm") | join gap | ✅ (fix action TODO) |
| `OPEN_CONTOUR` | info | other open contours, cut on the centre line ("Linia resztki bez wejścia") | accept | ✅ |
| `LEAD_OUTSIDE_HOLE` | error | hole pierce outside the hole or closer than crater margin + kerf/2 to the wall; message gives max = Ø − kerf − 2 × 1.5 mm (design: 40 mm in Ø30 → max 25,5 mm) | shorten / "jak automat" | ✅ |
| `HOLE_TOO_SMALL` | warning | hole < max(1 × t, 2 × kerf) | mark instead | ✅ |
| `OUTSIDE_SHEET` | error | contour bbox outside the sheet | — | ✅ |
| `OUTSIDE_WORK_AREA` | error | outside machine travel | — | ✅ |
| `NO_COMPENSATION` | warning in Manual, error otherwise | closed contour cut without compensation | set side | ✅ |
| `BRIDGE_TOO_SMALL` | warning | two outlines closer than 2 × t after kerf ("Za mały mostek · 4,8 mm") | move apart | ✅ (sampled distance) |
| `NEEDS_REVIEW` | info | Assisted proposal not yet accepted | accept | ✅ |
| rapid over a cut part without raising Z | warning | design S "2 przejazdy nad wyciętymi częściami" | avoid / raise | ❌ M5 |
| lead-in crossing another contour | error | | | ❌ M4 |
| post has unverified blocks | warning (from post engine) | | verify post | ✅ |
| `M07`/`M08` (or `M03`/`M05`) pairing | warning (post engine) | design L3 "Każde M07 ma swoje M08" | | ✅ |

Problems panel behaviour (design AS/M): alerts grouped by severity, expanding an alert shows 2–3 proposals with one marked **Zalecane**, actions *Zastosuj / Pokaż / Zostaw*, checkbox "Też w N podobnych otworach", footer "Zastosuj zalecane (N)", keys *Tab: podgląd · ↵ zastosuj*.
