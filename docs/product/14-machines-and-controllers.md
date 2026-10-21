# 14 · Machines and controllers

ArcFlow writes G-code files only; it does not connect to the machine (design L2/I). GRBL streaming is post-MVP.

## Toploong 1325 · Fangling F2100K v5.0
Equipment: THC from the controller (ARC VOL-DIV), IHS microswitch, CUT80CNC source (design also shows Hypertherm Powermax 45 XP in the cut chart), optional punch/marker with offset X 62 mm. Known firmware bug: **Pierce Up Time**. Program zero in the design: top-left of the sheet, X+ right, Y+ down → negative Y in the program. File for USB: max 8 characters (`KOLN_DN1.TXT`).

Profile: `toploong1325` in `packages/core/src/project/machine.ts`. Post: `packages/post/posts/f2100k.post.json`.

Output matches the format cut daily on the owner's machine, verified against two reference flows in `docs/reference/`:
- **Autodesk Fusion** FangLing post (`fangling-f2100k.cps`, FORKID `652161EC-F5A5-405D-816F-2749CA555654`)
- **SheetCAM** "Toploong Koike simple" post (`Toploong_F2100K.scpost`)

Both emit the same wire format and both have produced known-good G-code (`plytka_A.txt`, `scianka_A.txt`).

### Code table (status)
| Event | ArcFlow emits | Verified against |
|---|---|---|
| Program start | `G21` / `G90` / `G40` (3 lines, no comment — F2100K rejects `()`) | ✅ both posts, both samples |
| Rapid | `G00X+…Y-…` (no spaces, forced `+`/`-`, 4 decimals) | ✅ |
| Arc on | `M07` | ✅ |
| Pierce dwell | **nothing** (controller handles timing via Pierce Time setting) | ✅ SheetCAM & samples |
| Cut (linear) | `G01X+…Y-…` | ✅ |
| Arcs | `G02`/`G03 X Y I J`, I/J relative to arc start | ✅ |
| Full circles | split into two half arcs (F2100K rejects start == end with I/J) | ✅ per Autodesk post comment |
| Arc off | `M08` emitted **twice** on consecutive lines | ✅ both samples |
| Compensation (G41/G42) | **not emitted** — kerf comp applied to geometry in `core` | ✅ neither reference post emits it |
| Z height moves | **not emitted** — THC owns height on this controller | ✅ no Z in any sample |
| Feedrate `F` | **not emitted** — speed is on the cut chart in the controller | ✅ no F in any sample |
| Program end | `G00X+0.0000Y+0.0000` / `M02` (not `M30`) | ✅ |
| Newline / extension | CRLF / `.txt` upper-case 8.3 | ✅ `extension = "txt"` in both posts |
| THC on | `M50` | ❌ design L2 only; not in reference samples |
| THC off / lock (small holes) | *nothing yet* | ❌ **unknown code** — needs real-world test |
| Pierce dwell (alt form) | if ever enabled: `G04 F<hundredths-of-a-second>` (not `G04 P<seconds>`) | ✅ per Autodesk `hundredthsecFormat` |
| Punch / marker | `G00` → `M07` → optional `G04 F<hundredths>` → `M08` (no Z, no separate code) | ✅ Autodesk `onCyclePoint` |

### How to verify remaining items (use `/verify-post`)
1. Cut the calibration sample (design F: 50×50 with Ø20) in scrap, check: THC on/off behaviour on the Ø5 holes.
2. Confirm whether `M50` is really the THC-on code on this specific controller (it's design-sourced, not reference-sourced).
3. Find the "THC lock" or "THC off" code for small holes — Fangling manual, or ask the installer.
4. Remove verified blocks from `unverified` in the JSON, `pnpm golden:update`, review the diff.

## GRBL 1.1 table (MK2 / MKS DLC32)
Arc via relay on `M03`/`M05` (alternative `M08`/`M09` — configurable post variant TODO). **Laser mode must be off (`$32=0`)** or M3 only fires during moves. No THC, no IHS (fixed height or touch-off). Pierce delay `G04 P<seconds>`. **GRBL has no G41/G42**, so ArcFlow offsets the geometry by kerf/2 itself (`controllerCompensation: false`). Future: external THC (Arduino THCUD), grblHAL.

## Adding a controller
New `MachineProfile` template + new post JSON + golden test. Candidates: LinuxCNC/QtPlasmaC, Mach3/4 + THC, grblHAL. Core must only use profile capabilities (`hasTHC`, `controllerCompensation`, `heightsInProgram`, `ihs`, `origin`), never controller names.

## Open questions
- F2100K THC lock / THC off code for small holes (M50 is only design-sourced; the counterpart is unknown).
- F2100K IHS trigger code (if any — IHS may be fully handled by the controller before `M07`).
- Workaround for the Pierce Up Time firmware bug (extra dwell? separate Z move?). The reference posts don't address it, so this stays open.
- GRBL relay: `M3` vs `M8` on the owner's table.
