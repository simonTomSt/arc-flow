# 32 · Postprocessors

Design L3: "Zamiast skryptu: bloki zdarzeń ze zmiennymi do kliknięcia." A post is JSON (`packages/post/posts/*.post.json`, type `PostDefinition` in `packages/post/src/types.ts`) run by `runPost()` in `engine.ts`.

## Event blocks
| Block | Emitted | Typical F2100K |
|---|---|---|
| `programStart` | once | `(ArcFlow - …)`, `G21 G90` |
| `pierce` | per cut, at pierce point | `G00 X Y`, `G00 Z{PIERCE_HEIGHT}`, `M07`, `G04 P{PIERCE_DELAY}`, `G01 Z{CUT_HEIGHT} F{F_Z}` |
| `thcOn` / `thcOff` | when the operation uses THC | `M50` / ? |
| `compLeftPrefix` / `compRightPrefix` | word prefixed to the first motion after comp starts | `G41` / `G42` |
| `compOff` | after the cut | `G40` |
| `cut`, `arcCW`, `arcCCW` | each motion | `G01 X Y {F}`, `G02/G03 X Y I J {F}` |
| `cutEnd` | arc off | `M08` |
| `afterCut` | after each cut | `G00 Z{TRAVEL_HEIGHT}` |
| `programEnd` | once | `G00 X0 Y0`, `M30` |

A line is a string or `{ "when": "thc" | "heights" | "ihs" | "!…", "line": "…" }`. Flags come from the machine profile (`hasTHC`, `heightsInProgram`, `ihs`).

## Variables
`{X} {Y} {I} {J} {F}` (F is empty when unchanged and `modalFeed` is on) · `{PIERCE_HEIGHT} {PIERCE_DELAY} {CUT_HEIGHT} {TRAVEL_HEIGHT} {F_Z} {THC_VOLTAGE} {KERF}` · `{CUT_NO} {PROJECT} {MATERIAL} {THICKNESS} {CURRENT} {NOZZLE}`. The UI shows Polish labels for them (design: `{WYS_PRZEBICIA}`, `{CZAS_PRZEBICIA}`, `{NR_CIECIA}`…) mapped in i18n — keys stay English.

## Format options
`decimals`, `lineNumbers`, `extension`, `newline`, `maxFileNameLength`, `upperCaseFileName`, `modalFeed`, `asciiOnly` (strips Polish characters, `ł`→`l`), `splitFullCircles`.

## Coordinates
Toolpath is in sheet mm, Y up. `origin: "top-left"` → `X = x − offX`, `Y = y − sheetHeight − offY` (negative Y, as in design I). `bottom-left` → plain offset. I/J are relative to the arc start (a translation keeps them unchanged).

## Checks and warnings
`checks.pairs` (e.g. M07/M08) are counted on the output; `unverified` blocks and a compensation mismatch between post and machine profile produce warnings shown in the export dialog.

## Golden tests
`packages/post/test/post.test.ts` runs the demo project through each post and compares with `test/golden/*.nc`. Change G-code deliberately → `pnpm golden:update` → review the diff → explain it in the commit.

## Roadmap
- Post editor UI (L3) with live preview highlighting lines from the edited block (`PostResult.sources` already tracks the block per line).
- "Skrypt (eksperci)" tab: optional JS hooks per event, sandboxed.
- Posts: LinuxCNC/QtPlasmaC, Mach3 + THC, grblHAL; GRBL variant with `M08/M09` relay.
- Import of the owner's Fusion `.cps` as reference (see `/verify-post`).
