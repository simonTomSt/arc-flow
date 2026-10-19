# 04 · Roadmap

MVP order follows spec §8. Engineering milestones with acceptance criteria: `../engineering/35-implementation-plan.md`.

| Phase | Scope | Design screens |
|---|---|---|
| **MVP-1 Import + Synergy** | DXF import + cleanup report, classification, compensation, direction, lead-in/out, small holes, order | A, C |
| **MVP-2 Data** | cut charts (manual presets), kerf calibration wizard, machine profiles | F, L1, L2 |
| **MVP-3 Output** | F2100K post verified against the existing `.cps`, GRBL post, post editor with live preview | L3, I |
| **MVP-4 Editing** | path preview, per-contour edit (drag start point), "Dlaczego?", Assisted/Manual with Problems panel | C, AS, M, T |
| **MVP-5 Safety** | 2D simulation, full validation, export | S, I |
| **MVP-6 Sketch** | basic tools + constraints (planegcs), parameters | E |
| **Post-MVP** | corners (loop/round), part rotation & zero point, nesting, common line, micro-bridges, remnants store, rapids avoidance, thermal order, chain cutting, quick quote, operator report, marking/punch, GRBL streaming, touch/tablet | K, R, N, X1–X8, P |

Starter status (this kit): MVP-1 partially (no import report UI, no spline/ellipse), MVP-3 F2100K/GRBL posts unverified, MVP-4 properties panel + reasons, MVP-5 validation + export dialog.
