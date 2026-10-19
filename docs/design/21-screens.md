# 21 · Screens

The design canvas has 17 frames (1600 × 1000, dark). Ids are used in code comments. "Starter" = state in this kit.

## Shared shell (all project screens)
- **Menu bar:** logo · project name ▾ · Plik / Edycja / Widok / Pomoc · undo/redo · spacer · **Eksportuj** (accent).
- **Workspace bar:** `Szkic | CAM | Nesting | Symulacja | Eksport` · preset chip *Toploong · S235 · 4 mm · 45 A ▾* · mode switch **Synergic / Assisted / Manual** · **Generuj**.
- **Left:** "Elementy" browser (sheet → parts → contours, icons by type, `#order`, manual dot, warning mark), "+ Dodaj DXF".
- **Left tool strip** in CAM/Sketch: tools with shortcuts; active tool opens a **tool card** on the canvas: title "Lead-in (L)", one-line hint, fields, `Esc Anuluj` / `OK ↵`.
- **Right:** "Właściwości" with sections in caps (LEAD-IN, WYJŚCIE, KOMPENSACJA, KIERUNEK, PRĘDKOŚĆ…), auto values grey, manual white + dot + "Zmienione ręcznie z X · przywróć auto", and **DLACZEGO?** numbered reasons.
- **Bottom:** "Kolejność cięcia · N cięć · time · length · 1 błąd · 2 uwagi" (expands to a draggable order list).
- **Problems panel** (AS/M): Fusion-style list of alerts with proposals.

## Inventory
| Id | Name | What it shows | Starter |
|---|---|---|---|
| **A** | Ekran startowy | Drop DXF/SVG (several files → one sheet), new sketch, ready shapes, recent projects with thumbnails and status (Wyeksportowano / 2 uwagi), machine cards (Toploong 1325 · F2100K · THC; Stół warsztatowy · GRBL 1.1 · bez THC; Dodaj maszynę), default material (Stal S235, 4 mm, 45 A, dysza 1.1, kerf 1,52, 2600 mm/min, skalibrowano 12.10), mode, touch mode, language, last export path | ❌ |
| **E** | Szkicownik | Circle tool in progress (typing Ø30), dimensions on canvas, sketch state panel "Niedookreślony · 2 stopnie swobody" with actions Wyśrodkuj / Zwymiaruj, history | ❌ |
| **C** | CAM po „Generuj" | Paths, lead-in tool on hole Ø5 #15 with draggable start point, properties with lead types, overcut changed manually 0 → 0,8 mm, kerf 1,52 from chart, CCW auto, speed 60 % = 1560 mm/min, THC, **Dlaczego?** 3 reasons | ✅ partial (no drag, no tool card) |
| **AS** | Assisted | Manual lead 40 mm in Ø30 → Problems panel: "Lead-in wychodzi poza otwór — maks. 25,5 mm", proposals *Jak automat: linia + łuk 8 mm (Zalecane)* / *Najdłuższy bezpieczny 25,5 mm*, "Też w 3 podobnych otworach", "Zastosuj zalecane (3)" | ✅ rule only |
| **M** | Manual | Same error with automation off; proposals reversed (longest safe first) | ✅ rule only |
| **K** | Narożniki | Sharp / rounded / loop, loop Ø auto 4 × kerf = 6 mm, threshold 135°, fallback, impact "+4 pętle · +75 mm · +1,2 s" | ❌ |
| **R** | Pozycja części | Rotate part (0/45/90/180/270, R / Shift+R ±90°, Ctrl-drag ring 15°), mirror, recalc operations, keep manual overrides, grain direction, sheet zero point + offset | ❌ |
| **X1–X8** | Funkcje zaawansowane | X1 common line (W), X2 micro-bridges (B), X3 remnants + store (R-014…), X4 rapids avoid/raise (J), X5 thermal order (O), X6 chain cutting (H), X7 quick quote (rates zł/h, zł/kg…), X8 operator report (A4, print/PDF) | ❌ |
| **S** | Symulacja | Torch mid-cut, kerf trail, speed heatmap, 1×/5×/20×/100×, Space play, ←/→ cut, Shift+←/→ frame, checks "2 przejazdy nad wyciętymi częściami" | ❌ |
| **T** | Podpowiedzi | Extended tooltips after 0,6 s (long-press on touch): title, one sentence, 2–4 CAM-coloured diagrams, variants, footer with current project value and its source | ❌ |
| **P** | Punktowanie | Marking points from holes ≤ Ø6, manual points, DXF layer "PUNKT", tool scriber/plasma pulse, offset X 62, strike time 0,20 s, mark before cutting | ❌ (rule + `mark` action exist) |
| **N** | Nesting | Quantities, sheet or remnant, 3 proposed layouts (density, remnant, rapids), spacing auto 2 × t, rotation none/90°/free, small parts in holes, rectangular remnant, common edges, 5 s / 2000 tries | ❌ |
| **F** | Tabele cięcia + kalibracja | Materials tree, chart table (t, A, nozzle, kerf, speed, pierce height/time, cut height, voltage, source), kerf wizard 3 steps, result 1,66 mm (+0,14), spread 0,015 | ✅ logic (`lookupCutChart`, `calibrateKerf`), ❌ UI |
| **I** | Walidacja i eksport | 1 error blocks saving, issues list, machine/post/nozzle, file name (F2100K max 8), folder E:\, extension, live preview, "Napraw wszystko", "Zapisz G-code" | ✅ simplified dialog |
| **L1** | Biblioteka narzędzi | Nozzles 0,8/1,0/1,1/1,2 with default kerf; chart kerf has priority; assigned machines; projects using it | ❌ |
| **L2** | Profile maszyn | Name, description, THC, heights in program, travel height, IHS, punch offset, post, nozzles, "Co z tego wynika" G-code preview | ✅ data model |
| **L3** | Postprocesory | Block editor (Początek, Przebicie, Ruch cięcia, Łuki, Koniec cięcia, Koniec programu) with clickable variables, number format, preview highlighting edited block, checks, export `.post`, "Test na sterowniku" | ✅ engine + JSON, ❌ editor |

For pixel detail open the live design; for a quick offline look use `docs/design-reference.html`.
