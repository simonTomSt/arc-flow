# CLAUDE.md — ArcFlow

ArcFlow is a desktop CAD/CAM for CNC plasma cutters that works like a **synergic welder**: drop a DXF (or sketch), pick material + thickness, press **Generuj**, get correct G-code. Every automatic decision is visible, explained ("Dlaczego?") and editable. First targets: **Toploong 1325 with Fangling F2100K v5.0** and **GRBL 1.1** tables.

Read this file fully before any change. It is short on purpose; the details live in `docs/`.

## Sources of truth (read before working on an area)

| Area | File |
|---|---|
| Product spec (Polish original, authoritative) | `docs/source/plasma-cam-spec.pl.md` |
| Visual design (17 screens) | `docs/design/21-screens.md`, `docs/design-reference.html`, live design: https://claude.ai/artifact/UfHut5G4ZC6xxEBJCpacM1 |
| Design tokens, colours, CAM colour semantics | `docs/design/20-design-system.md`, `apps/desktop/src/styles/tokens.css` |
| Synergy rules (the automation) | `docs/product/12-synergy-rules.md` |
| Validation rules | `docs/product/13-validation.md` |
| Controllers, G-code codes and what is unverified | `docs/product/14-machines-and-controllers.md` |
| Architecture / data model / posts | `docs/engineering/30-…`, `31-…`, `32-…` |
| What to build next | `docs/engineering/35-implementation-plan.md` |
| Business context, users, roadmap, glossary PL↔EN | `docs/business/` |

When code and docs disagree, the spec wins, then the docs, then the code. If you make a product or design decision, write it into the matching doc in the same change.

## Stack

- **pnpm workspace**, Node 22, TypeScript 5 (strict), Vitest.
- `packages/core` — pure TS: geometry, DXF import, cut charts, Synergy, toolpath, validation. **No UI, no DOM, no Node APIs.**
- `packages/post` — declarative postprocessors (JSON event blocks + `{VARIABLES}`) and the G-code engine.
- `apps/desktop` — React 19 + Vite UI, Canvas 2D renderer (WebGL later), wrapped by **Tauri 2** (`src-tauri/`). ArcFlow only **writes G-code files**; it never talks to the machine (design L2/I). GRBL streaming is post-MVP.

## Commands

```bash
pnpm install
pnpm test              # all unit + golden G-code tests (must stay green)
pnpm typecheck         # tsc across all packages
pnpm dev               # UI in the browser at http://localhost:1420 (no Tauri needed)
pnpm tauri dev         # desktop app (needs Rust + Tauri system deps, see docs/engineering/34-build-and-run.md)
pnpm golden:update     # rewrite golden G-code files — ONLY when the change to G-code is intended; review the diff
```

## Non-negotiable rules

1. **Never invent controller codes.** F2100K codes come from the design and must be checked against the user's existing SheetCAM/Fusion `.cps` post and the Fangling manual. Anything not confirmed stays listed in the post's `unverified` array and in `docs/product/14-machines-and-controllers.md`. Export shows a warning while that list is non-empty.
2. **"Nie zepsuj blachy."** Validation runs in every mode (Manual turns automation off, never checks). Errors block export unless the user consciously overrides.
3. **Every automatic decision carries a `Reason`** (`packages/core/src/cam/types.ts`, codes in `reasons.ts`). If you add a rule, add its reason code, PL + EN text and a test.
4. **Thresholds are data, not constants.** Put defaults in `SynergyRules` (`cam/rules.ts`) so cut chart / machine / project can override them. Never hard-code mm values in rule logic.
5. **Auto vs manual is explicit.** Every operation field is a `Param<T>` = `{ value, auto, source }`. User changes go to `project.overrides[contourId]`; "przywróć auto" deletes the key. Override hierarchy: machine → cut chart → project → part → contour.
6. **G-code changes are reviewed through golden files** in `packages/post/test/golden/`. A diff there is a behaviour change; explain it in the commit.
7. **Units:** internal geometry is millimetres, math orientation (X right, **Y up**). Arcs stay arcs (G02/G03) end to end; never tessellate for output. Machine origin/Y flip happens only in the post engine.
8. **i18n from day one:** Polish primary, English second. No literal UI strings in components; add keys to `apps/desktop/src/i18n/pl.ts` and `en.ts`. Polish numbers use a decimal comma in the UI, G-code always uses a dot.
9. **Design fidelity:** use tokens from `tokens.css`; do not add colours. CAM colours have fixed meaning (cut blue `#5B9BFF`, open purple `#BF7BFF`, pierce/error red `#FF5A4E`, warning orange `#F2A93B`, ok/marking green `#30B860`, accent `#3478F6`).
10. **Licences:** check before adding a dependency (planegcs is LGPL, see `docs/business/03-business-model.md`). Prefer MIT/BSD/Boost.

## Conventions

- Code, identifiers, commits, docs: English. UI copy: Polish first (style rules in `docs/design/22-interaction.md`).
- Small pure functions in `core`, each with a unit test. UI components stay thin and read derived data from `useDerived()` (`apps/desktop/src/state/store.tsx`).
- New controller = new JSON in `packages/post/posts/` + golden test; core must not know controller names except via `MachineProfile` capabilities.
- Keep `docs/engineering/35-implementation-plan.md` current: tick what you finished, add what you discovered.

## Definition of done (every change)

`pnpm test` and `pnpm typecheck` green · new logic has tests · docs updated where behaviour or decisions changed · no new colours/strings outside tokens/i18n · G-code diffs explained.

## Open questions (do not silently decide; ask the owner or record the choice in docs)

F2100K exact codes (arc on/off, THC lock, IHS, file format/newline) · GRBL arc relay M3 vs M8 · business model (own tool vs product → licences) · when to move geometry to Rust/WASM. Current list: `docs/product/14-machines-and-controllers.md#open-questions` and `docs/business/03-business-model.md`.
