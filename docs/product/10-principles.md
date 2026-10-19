# 10 · Product principles

From spec §2, with how each maps to code.

1. **Idiot-proof by default, control on demand.** The default path needs no CAM knowledge; every automatic decision is visible, explained and editable. → `generateOperations()` always computes `auto` for every field.
2. **Never a black box.** Each contour shows *why* it got its lead-in, direction, compensation ("Ø6 < 1,5× grubość → wejście ze środka, prędkość 60 %"). → `Operation.reasons: Reason[]`, texts in `cam/reasons.ts`, shown in the "Dlaczego?" block of the properties panel.
3. **Override hierarchy:** machine profile → cut chart (material/thickness/current/nozzle) → project → part → contour. Lower wins. An override is marked visually (dot / "ręcznie") with **przywróć auto**. → `Param<T> { value, auto, source }`; overrides stored in `project.overrides[contourId]`. *Starter implements machine/chart/contour levels; project and part levels are milestone M4.*
4. **Modes**
   - **Synergic (Auto):** value = override ?? auto.
   - **Assisted:** same values, but each operation is `needsReview` until accepted (`overrides.accepted = true`). UI: Problems panel with proposals (design AS).
   - **Manual:** automation off — value = override ?? neutral manual default; auto is still computed and shown as a hint. Validation still warns (design M).
5. **Nie zepsuj blachy (don't ruin the sheet).** Mandatory validation + simulation before export; critical errors block export, with a conscious override. → `validate()`, `blocksExport()`.
6. **Speed:** DXF → G-code in < 30 s for a typical part. Every core function must stay fast enough to recompute on each edit (the UI recomputes the whole pipeline in `useDerived`).
