# 12 · Synergy rules

All thresholds are **defaults** in `SynergyRules` (`packages/core/src/cam/rules.ts`), overridable by cut chart / machine / project. Never hard-code them in logic.

## Contour classification and direction (spec §5.1)
| Type | Compensation | Default direction (CW swirl) | Reason code |
|---|---|---|---|
| Closed outer (part outline) | outward by kerf/2 | **CW** | `ROLE_OUTER` |
| Closed inner (hole) | inward by kerf/2 | **CCW** | `ROLE_HOLE` |
| Island in a hole | like outer | CW | `ROLE_ISLAND` |
| Open | none (centre line) | drawing order | `ROLE_OPEN` |

With CW swirl the good side is on the right of the torch, so the waste is always on the **left** → G41 for both outlines (CW) and holes (CCW). Design T confirms: "Otwór CCW + lewa = kerf w odpadzie". Swirl CCW in the machine profile inverts everything. Code: `buildOp()` in `cam/synergy.ts`.

## Lead-in / lead-out (spec §5.2)
| Rule | Default | Field |
|---|---|---|
| Types | none, line, arc, line+arc, from centre | `LeadType` |
| Outline | line+arc, length `max(leadInMinMm, leadInK × t)` | `leadInMinMm = 3`, `leadInK = 2` |
| Hole | line+arc, same length, clamped to `Ø − kerf − 2 × craterMarginMm` → reason `LEAD_CLAMPED` | `craterMarginMm = 1.5` |
| Start point, outline | sharpest corner ≥ 60°, else middle of the longest straight | `autoStart()` |
| Start point, hole | middle of the longest straight; circles at the top | `autoStart()` |
| Arc lead angle | 90° | `arcLeadAngleDeg` |
| Lead-out | none (0–2 mm line optional) | `leadOut` |
| Overcut | 0 auto; 0.5–1 mm typical for 3–6 mm steel (design T) | `defaultOvercutMm` |

> ⚠️ Lead length: the spec says ~1.0–1.5 × thickness, the design shows 8 mm at 4 mm (2×). The starter follows the design (`leadInK = 2`). Calibrate on the machine and record the decision here.

Geometry (`cam/toolpath.ts`): arc leads are tangent to the contour at the start point and lie on the waste side; line+arc = straight half + quarter-arc half; from-centre = pierce at the circle centre, radial line to the edge.

Not yet: lead must not cross another contour (only hole wall clearance is checked), torch-off distance before closing holes, "Też w 3 podobnych otworach" bulk apply.

## Small holes (spec §5.3, design C/P)
| Condition (t = thickness) | Action | Reason |
|---|---|---|
| hole size < max(`smallHoleK` × t, `smallHoleMinMm`) (2.5 × t) | lead from centre (circles) or short line; speed `smallHoleSpeedPct` (60 %); THC off | `SMALL_HOLE_CENTER`, `SMALL_HOLE_SPEED`, `THC_OFF_SMALL` |
| size < `drillSuggestK` × t (1.5 × t) | suggest marking + drilling (design P) | `DRILL_SUGGESTED` |
| size < max(`uncuttableK` × t, 2 × kerf) | "not cuttable by plasma"; action → mark if the machine has a marker | `TOO_SMALL_TO_CUT` |
| contour length < `thcOffBelowLengthMm` (50 mm) | THC off | `THC_OFF_SHORT` |

Size = diameter for circles; for other shapes the smaller bbox side (**TODO**: true inscribed-circle diameter for slots and tight shapes).

## Cutting order (spec §5.4) — `cam/order.ts`
1. Deeper parts first (an island must be cut before the hole that frees it).
2. Inside a part: holes small → large, outline last.
3. Between parts: nearest neighbour from program zero.
4. Open contours last.
TODO: anti tip-up (no rapids over cut parts, or raise Z), "all holes on the sheet first" option, thermal strategies (design X5: shortest, from centre, zones, rows, min jump 150 mm).

## Corners (design K, post-MVP)
Sharp / rounded / loop. Loop only on outlines, in the waste, for corners sharper than 135°, loop Ø = 4 × kerf; fallback when the loop does not fit: sharp + slowdown 70 %. Reasons: "Kontur zewnętrzny → pętla mieści się w odpadzie", "Narożniki 90° < 135°", "Odstęp do sąsiedniej części 12 mm > pętla 6 mm".

## Adding a rule
Use `/add-synergy-rule` (Claude command) or: threshold in `SynergyRules` → logic in `buildOp()` → `ReasonCode` + PL/EN text → unit test → this table.
