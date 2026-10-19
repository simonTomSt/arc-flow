# 20 · Design system

Extracted from the design (https://claude.ai/artifact/UfHut5G4ZC6xxEBJCpacM1). Implemented in `apps/desktop/src/styles/tokens.css`. Do not add colours; if something new is needed, add a token here and in the CSS together.

## Character
Dark, clean, engineering tool. Flat panels, subtle borders, generous spacing, iOS/macOS-like controls (segmented buttons, rounded 6–12 px). Inspirations: Fusion 360 (workspaces, browser, timeline), Onshape (sketcher, constraints, cleanliness), SheetCAM (operation list, tool tables), SolidCraft (simplicity).

## Colour tokens (Dark, default)
| Token | Hex | Use |
|---|---|---|
| `--bg-app` | `#111113` | window background |
| `--bg-canvas` | `#000000` | canvas, menu bar, status bar |
| `--bg-panel` | `#1E1E20` | side panels, toolbar |
| `--bg-panel-2` | `#232325` | nested blocks ("Dlaczego?") |
| `--bg-raised` | `#2C2C2E` | cards, buttons |
| `--bg-field` | `#323234` | inputs, segmented control track |
| `--bg-hover` | `#3A3A3C` | hover, touch buttons |
| `--bg-control` | `#444447` | selected segment |
| `--border` | `#333336` | panel borders |
| `--border-strong` / `--text-disabled` | `#545458` | dividers, disabled |
| `--text` | `#F2F2F7` | primary text, manual values |
| `--text-2` | `#D1D1D6` | secondary text, labels |
| `--text-3` | `#8E8E93` | captions, **auto values** |
| `--accent` | `#3478F6` | primary buttons, active tool, links, selection (`rgba(52,120,246,.22)`) |
| `--ok` | `#30B860` | valid, exported, marking points |
| `--warn` | `#F2A93B` | warnings ("hot metal" orange) |
| `--error` | `#FF5A4E` | errors, pierce points |

Light and Ultra dark are full remaps of the same tokens (values in `tokens.css`, taken from the design's theme switch).

## CAM canvas semantics
| Element | Colour | Style |
|---|---|---|
| Closed contour (outline/hole) | `#5B9BFF` | solid 1.5 px |
| Open contour | `#BF7BFF` | solid |
| Lead-in / lead-out | `#8FB8FF` | solid thin |
| Rapid | `#7C7C82` | dashed (3–5 px dashes) |
| Pierce point | `#FF5A4E` | filled dot, order number next to it (toggle "showOrder") |
| Direction arrow | contour colour | small chevron |
| Marking point | `#30B860` | |
| Selected | white | 2.4 px |
| Sheet / grid | `#1C1C1E` / `rgba(255,255,255,.035)` | grid 10 mm zoomed in, 50 mm zoomed out |
| Simulation kerf trail, speed heatmap | blue→orange ramp (design S) | |

## Typography
UI: `"SF Pro Text", "Segoe UI Variable", system-ui` 14 px base, tabular numbers everywhere. Captions 12 px, section headers 11 px uppercase +0.06em letter-spacing in `--text-3`. Panel titles 17 px semibold. Mono: `Source Code Pro` for G-code. Brand/logo: `SF Pro Rounded`/Nunito.

## Layout grid
Menu bar 40 px · tool/workspace bar 44 px · left browser 280 px · right properties 320 px · bottom order bar (collapsible) · status bar 26 px. Design frames are 1600 × 1000.

## Touch mode
Toggle on the start screen ("Tryb dotykowy"): hit targets 40 → 48 px, round tool buttons, labels next to icons, long-press shows tooltips.

## Icons
24 px grid, 1.5–1.8 px stroke, round caps/joins, no fill. Paths for the tool icons are in the design (line, arc, spline, rect, circle, ellipse, trim, constr, measure, profile, leadin, order, bridges, kerf, nest, validate, sim). Reuse them; keep one icon set.
