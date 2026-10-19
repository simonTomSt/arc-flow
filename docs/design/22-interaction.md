# 22 · Interaction, shortcuts and copy

## Keyboard (Fusion-like)
| Key | Action | Screen |
|---|---|---|
| L / C / R / D / T | line / circle / rectangle / dimension / trim (sketch) | E |
| L | Lead-in tool (CAM) | C |
| K | Corners | K |
| P | Marking (punktowanie) | P |
| W | Common line | X1 |
| B | Micro-bridges | X2 |
| J | Rapids | X4 |
| O | Thermal order | X5 |
| H | Chain | X6 |
| R / Shift+R | rotate part ±90° | R |
| Esc / ↵ | cancel / confirm tool card | all |
| Tab | preview proposal · ↵ apply | AS/M |
| Space, ←/→, Shift+←/→, 1–4 | play/pause, prev/next cut, frame step, speed | S |
| F1 | "Więcej" in tooltips | T |

## Patterns
- **Tool card:** title with shortcut, one-sentence hint, fields, `Esc Anuluj` / `OK ↵`. Live recompute while dragging.
- **Auto vs manual:** grey = automatic, white + blue dot = manual; caption "Zmienione ręcznie z 0,00 mm · przywróć auto".
- **Dlaczego?:** numbered list, each line "condition → consequence" with real numbers from the project.
- **Problems panel:** severity icon, title, object (`Otwór Ø30 · #21 · Wspornik A`), one-line cause with numbers, 2–3 proposals (one **Zalecane**), *Zastosuj / Pokaż / Zostaw*, bulk "Też w N podobnych".
- **Impact line** after a change: "Wpływ: +4 pętle · +75 mm cięcia · +1,2 s" or "−1 przebicie · −200 mm · −7 s".

## Tooltip rules (design T)
1. Title = parameter name, one sentence: what it does and why.
2. 2–4 diagrams in CAM colours: path, lead, pierce.
3. Variant descriptions only when names are not enough.
4. Footer: value in this project and its source (auto, chart, manual).
5. A label with a tooltip has a dotted underline.

## Polish copy style
Short, concrete, second person singular ("Kliknij środek, potem przeciągnij albo wpisz średnicę. Enter kończy."). Numbers with decimal comma and unit (`1,52 mm`, `60 %`, `2600 mm/min`). Arrows for cause → effect in reasons. No exclamation marks; errors say what happens on the metal ("Przebicie wypada 10 mm poza otworem, na części.").
