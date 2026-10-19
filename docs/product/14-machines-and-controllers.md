# 14 · Machines and controllers

ArcFlow writes G-code files only; it does not connect to the machine (design L2/I). GRBL streaming is post-MVP.

## Toploong 1325 · Fangling F2100K v5.0
Equipment: THC from the controller (ARC VOL-DIV), IHS microswitch, CUT80CNC source (design also shows Hypertherm Powermax 45 XP in the cut chart), optional punch/marker with offset X 62 mm. Known firmware bug: **Pierce Up Time**. Program zero in the design: top-left of the sheet, X+ right, Y+ down → negative Y in the program. File for USB: max 8 characters (`KOLN_DN1.NC`).

Profile: `toploong1325` in `packages/core/src/project/machine.ts`. Post: `packages/post/posts/f2100k.post.json`.

### Code table (status)
| Event | ArcFlow emits | Source | Verified |
|---|---|---|---|
| Program start | `(ArcFlow - S235 4mm 45A)` / `G21 G90` | design I, L3 | ❌ |
| Rapid to pierce | `G00 X… Y…` | design L3 | ❌ |
| Pierce height | `G00 Z3.80` (only with "Wysokości w programie") | design L2 | ❌ |
| Arc on | `M07` | design I, L2, L3 | ❌ |
| Pierce delay | `G04 P0.5` (seconds?) | design L3 | ❌ unit |
| Cut height | `G01 Z1.50 F300` | design L3 | ❌ |
| THC on | `M50` | design L2 ("M50 (THC wł.)") | ❌ |
| THC off / lock (small holes) | *nothing yet* | — | ❌ **unknown code** |
| Compensation | `G41`/`G42` on the first lead move, `G40` after arc off | design I, L3 | ❌ |
| Arcs | `G02/G03 X Y I J`, I/J relative to arc start | design L3 | ❌ |
| Arc off | `M08` | design L3 | ❌ |
| Program end | `G00 X0 Y0` / `M30` | design L3 | ❌ |
| Newline / extension | CRLF / `.nc` upper-case 8.3 | design I | ❌ |
| Full circles | split into two half arcs | safety choice | ❌ |

### How to verify (use `/verify-post`)
1. Put the existing SheetCAM → Fusion `.cps` (and a G-code file it produced that ran well) into `docs/source/`.
2. Compare block by block; record the reference line next to each row above.
3. Cut the calibration sample (design F: 50×50 with Ø20) in scrap, check: arc on/off, pierce delay unit, THC on/off behaviour on the Ø5 holes, G41 side.
4. Remove verified blocks from `unverified` in the JSON, `pnpm golden:update`, review the diff.

## GRBL 1.1 table (MK2 / MKS DLC32)
Arc via relay on `M03`/`M05` (alternative `M08`/`M09` — configurable post variant TODO). **Laser mode must be off (`$32=0`)** or M3 only fires during moves. No THC, no IHS (fixed height or touch-off). Pierce delay `G04 P<seconds>`. **GRBL has no G41/G42**, so ArcFlow offsets the geometry by kerf/2 itself (`controllerCompensation: false`). Future: external THC (Arduino THCUD), grblHAL.

## Adding a controller
New `MachineProfile` template + new post JSON + golden test. Candidates: LinuxCNC/QtPlasmaC, Mach3/4 + THC, grblHAL. Core must only use profile capabilities (`hasTHC`, `controllerCompensation`, `heightsInProgram`, `ihs`, `origin`), never controller names.

## Open questions
- Exact F2100K codes: THC lock/off, IHS trigger, arc on/off confirmation, pierce delay unit, file format and newline.
- Does F2100K accept full circles with I/J? (we split for now)
- GRBL relay: `M3` vs `M8` on the owner's table.
- Workaround for the Pierce Up Time firmware bug (extra `G04`? separate Z move?).
