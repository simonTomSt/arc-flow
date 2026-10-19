# 05 · Glossary (PL ↔ EN)

UI is Polish first. Use these terms consistently in code (EN) and UI (PL).

| PL (UI) | EN (code/docs) | Meaning |
|---|---|---|
| Arkusz | Sheet | the plate being cut |
| Część | Part | a closed outline with its holes |
| Obrys | Outline / outer contour | the part's outside boundary |
| Otwór | Hole | closed contour inside a part |
| Wyspa | Island | closed contour inside a hole (a separate part) |
| Kontur otwarty | Open contour | not closed; cut on centre line |
| Kerf / szczelina | Kerf | width of metal removed by the arc |
| Kompensacja (lewa/prawa) | Compensation (left/right, G41/G42) | torch offset by kerf/2 to the waste side |
| Kierunek CW/CCW | Direction | travel direction around a contour |
| Wejście / Lead-in | Lead-in | path from pierce point to the contour |
| Wyjście / Lead-out | Lead-out | path leaving the contour |
| Overcut | Overcut | cutting past the start point to close the contour |
| Przebicie | Pierce | burning through the sheet before moving |
| Wysokość przebicia / cięcia | Pierce / cut height | torch Z at pierce / during cut |
| Czas przebicia (opóźnienie) | Pierce delay | dwell after arc on |
| THC (kontrola wysokości) | Torch height control | keeps arc voltage constant |
| IHS (czujnik wysokości) | Initial height sensing | touch-off before pierce |
| Tabela cięcia | Cut chart | parameters per material/thickness/current/nozzle |
| Dysza | Nozzle (consumable) | defines kerf and current range |
| Kalibracja kerfu | Kerf calibration | measure a test cut to get real kerf |
| Profil maszyny | Machine profile | controller, equipment, post, zero point |
| Postprocesor | Postprocessor (post) | converts toolpath to controller G-code |
| Punkt zerowy | Program zero | machine origin on the sheet |
| Przejazd jałowy | Rapid | non-cutting move |
| Mostek / mikromostek | Bridge / tab | uncut link holding a part |
| Wspólne cięcie / wspólna linia | Common-line cutting | one cut shared by two parts |
| Resztka | Remnant | leftover sheet saved for later |
| Punktowanie | Marking / punch marking | marking points (e.g. drill centres) |
| Narożnik: ostry / zaokrąglony / pętla | Corner: sharp / rounded / loop | corner strategy |
| Łańcuch | Chain cutting | several parts with one pierce |
| Wycena | Quick quote | time × rates + material |
| Synergic / Assisted / Manual | modes | auto · auto proposes, user approves · automation off |
| Dlaczego? | Why? (reasons panel) | explanation of an automatic decision |
| przywróć auto | restore auto | remove a manual override |
