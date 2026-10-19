# 02 · Users and jobs to be done

## Personas

**Właściciel warsztatu (shop owner / technologist)** — owns the Toploong 1325, knows CAM, maintains the cut charts and the F2100K post. Wants: fast quoting, repeatable quality, operators who do not need him for every program. Uses: cut charts, kerf calibration, machine profiles, postprocessor editor, quick quote (X7).

**Operator** — loads sheets, runs programs, measures parts. Not a CAM person. Wants: drop DXF → Generuj → USB stick; a clear operator sheet (X8); confidence that the program will not crash the torch. Uses: Synergic mode, validation, simulation, operator report.

**Hobbyist / small table (GRBL)** — DIY or MK2-class table, MKS DLC32, arc on a relay, no THC, no IHS. Wants: something simpler than SheetCAM that understands "no THC" and produces safe GRBL code. Uses: GRBL machine profile, fixed-height or touch-off workflow.

## Jobs
| When… | I want to… | So that… |
|---|---|---|
| a customer sends a DXF | import it, see what was fixed, get G-code in seconds | I can quote and cut today |
| a part has many small holes | have them handled automatically or turned into marking points | holes are round, not tapered, and THC does not dive |
| I change material or thickness | have speeds, kerf and leads follow | I do not re-check 20 parameters |
| a contour needs special treatment | override just that contour and see it marked "ręcznie" | the rest stays automatic |
| I hand a job to an operator | print a sheet with order, settings, part list | he runs it without asking |
| I calibrate a new consumable | cut a sample, type 3 measurements | the kerf in the chart is real |

## Key metrics
DXF→G-code time (target < 30 s typical part) · % programs exported without manual edits · validation errors caught before export · scrap rate from CAM mistakes.
