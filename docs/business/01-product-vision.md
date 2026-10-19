# 01 · Product vision

## One sentence
A desktop CAD/CAM for plasma that **looks like Fusion/Onshape, has the CAM power of SheetCAM and behaves like a synergic welder**: drop a DXF or sketch → choose material and thickness → **Generuj** → correct G-code, with full manual control of every parameter or the automation switched off entirely.

## The problem
Small fabrication shops and hobby tables with Chinese controllers (Fangling F2100 series on Toploong, Start, Jiaxin…; GRBL boards like MKS DLC32) cut with a patchwork:

- **SheetCAM** is powerful but dated and assumes CAM knowledge (lead-ins, kerf side, pierce delays, THC rules).
- **Fusion 360** can do it, but the plasma workflow is heavy, cloud-bound and needs a custom post (the owner already maintains a SheetCAM → Fusion `.cps` for the F2100K).
- **FastCAM / controller-bundled tools** are crude, often Chinese-only, and produce G-code that burns small holes and leaves dross.
- Operators learn by scrapping sheet: wrong kerf side, lead-in crater on the part, small holes cut too fast with THC diving, parts tipping up and hitting the torch.

## The idea: synergy
A synergic MIG welder asks for material and thickness and sets everything else. ArcFlow does the same for plasma:

- kerf compensation side and cut direction from the torch swirl,
- lead-in/out type, length and position from geometry and thickness,
- small-hole strategy (centre pierce, 60 % speed, THC off),
- cutting order (holes before outlines, nearest neighbour, no rapids over cut parts),
- heights, delays, speeds and arc voltage from a calibrated cut chart.

And unlike a black box, **every decision is shown with its reason** and can be changed with one click, then restored to auto.

## Principles in brief
Idiot-proof by default, control on demand · never a black box · override hierarchy · three modes (Synergic / Assisted / Manual) · "don't ruin the sheet" (validation blocks bad exports) · under 30 s from DXF to G-code. Details: `../product/10-principles.md`.

## What success looks like (first year)
1. The owner's shop cuts all production on the Toploong from ArcFlow, not SheetCAM.
2. A new operator produces a correct program for a typical part without CAM training.
3. Scrap from wrong kerf side, crater on part, burnt small holes → effectively zero.
4. Adding a new controller is a JSON post + golden test, no core changes.
