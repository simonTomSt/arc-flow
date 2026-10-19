# 03 · Business model and licensing

**Status: open decision.** The spec lists "own tool vs product for sale" as an open question. Until the owner decides, build so that both stay possible.

## Options
| Option | What it means | Implications |
|---|---|---|
| A. In-house tool | Used in the owner's shop only | Any OSS licence is fine; no installer polish, no licensing system |
| B. Commercial product | Sold to shops with F2100/GRBL machines (PL first, then EU) | Licences must allow closed distribution; needs installer, updates, i18n, support, controller coverage |
| C. Open core | Core + GRBL free/open, F2100K/advanced features (nesting, quoting, remnants) paid | Clear module boundaries (already: core / post / app) |

## Pricing ideas (if B/C)
One-time licence per machine with a year of updates, or subscription; a free tier for GRBL hobby tables is a strong acquisition channel. Competitive anchors: SheetCAM (~USD 150–400 one-off), Fusion (subscription), ProNest (enterprise).

## Dependency licence watch-list
| Library | Use | Licence | Note |
|---|---|---|---|
| dxf-parser | DXF reading | MIT | in use |
| Clipper2 (WASM/JS port) | offset fallback, nesting | Boost | safe |
| planegcs (FreeCAD solver → WASM) | sketch constraints | **LGPL-2.1** | OK for in-house; for a closed product ship it as a separately loaded, replaceable module and publish its source/changes |
| @tarikjabiri/dxf | DXF export | MIT | planned |
| Tauri, React, Vite | app | MIT/Apache | safe |

Rule for contributors (and Claude): **check the licence before adding a dependency** and add it to this table.

## Differentiators to protect
Synergy rules with reasons · calibrated cut charts + kerf wizard · F2100K post quality (the market is underserved) · Polish-first UX.
