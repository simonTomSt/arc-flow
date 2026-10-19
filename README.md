# ArcFlow

Synergic CAD/CAM for CNC plasma: **DXF → materiał i grubość → Generuj → G-code**, with every automatic decision visible and editable.

Targets: Toploong 1325 (Fangling F2100K v5.0, THC, IHS) and GRBL 1.1 tables.

```bash
pnpm install
pnpm test        # 30 tests: geometry, DXF chaining, Synergy rules, validation, golden G-code
pnpm dev         # UI in the browser → http://localhost:1420
pnpm tauri dev   # desktop app (Rust + Tauri prerequisites)
```

What works in this starter: demo part from the design (Wspornik WS-02), DXF import with gap/duplicate cleanup, part/hole/island classification, Synergy rules (direction, compensation, lead-ins, small holes, THC, order), override + "przywróć auto", "Dlaczego?" panel, validation, F2100K and GRBL G-code export with live preview.

Start here: [`CLAUDE.md`](CLAUDE.md) → [`docs/README.md`](docs/README.md) → [`docs/engineering/35-implementation-plan.md`](docs/engineering/35-implementation-plan.md).

> ⚠️ F2100K codes are taken from the design and are **not yet verified** on the controller. Do not cut production parts before completing the checklist in `docs/product/14-machines-and-controllers.md`.
