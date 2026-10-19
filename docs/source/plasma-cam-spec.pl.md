# ArcFlow — specyfikacja produktu (CAD/CAM do cięcia plazmą CNC)

> Robocza nazwa: **ArcFlow** (do zmiany). Dokument jest źródłem prawdy dla projektu: wizja, zasady działania „Synergii”, UX, architektura, zakres MVP. Przy każdej decyzji projektowej/kodowej odwołuj się do tego pliku, a zmiany wprowadzaj tutaj.

---

## 1. Wizja w jednym zdaniu

Desktopowy CAD/CAM do plazmy, który wygląda jak Fusion/Onshape, ma moc CAM jak SheetCAM, a działa jak spawarka synergiczna: **wrzucasz DXF albo rysujesz szkic → wybierasz materiał i grubość → klikasz „Generuj” → dostajesz poprawny G-code** — z pełną możliwością ręcznej korekty każdego parametru lub całkowitego wyłączenia automatyki.

## 2. Zasady nadrzędne (product principles)

1. **Idiotoodporność domyślnie, kontrola na żądanie.** Domyślna ścieżka nie wymaga wiedzy CAM. Każda decyzja automatu jest widoczna, wyjaśniona i edytowalna.
2. **Automat nigdy nie jest „czarną skrzynką”.** Przy każdym konturze widać *dlaczego* dostał dany lead-in, kierunek, kompensację (tooltip/panel „Powód”: np. „Otwór Ø6 < 1,5× grubość → wejście ze środka, prędkość 60%”).
3. **Hierarchia nadpisań:** Profil maszyny → Tabela cięcia (materiał/grubość/prąd/dysza) → Ustawienia projektu → Część → Kontur. Niższy poziom nadpisuje wyższy, nadpisanie oznaczone jest wizualnie (kropka/ikona „ręcznie”) z przyciskiem „przywróć auto”.
4. **Tryby pracy:**
   - **Synergic (Auto)** — wszystko dobierane automatycznie, użytkownik tylko akceptuje.
   - **Assisted** — automat proponuje, użytkownik zatwierdza/koryguje kontur po konturze.
   - **Manual** — automat wyłączony; użytkownik sam ustawia operacje jak w SheetCAM. Walidacja (kolizje, brak kompensacji, lead-in w część) nadal ostrzega, ale nie blokuje.
5. **Nie zepsuj blachy.** Przed eksportem obowiązkowa walidacja + symulacja; błędy krytyczne blokują eksport (z możliwością świadomego obejścia).
6. **Szybkość:** od otwarcia DXF do G-code w < 30 s dla typowej części.

## 3. Obsługiwane maszyny (MVP)

| Maszyna | Sterownik | Uwagi |
|---|---|---|
| Toploong 1325 | Fangling **F2100K v5.0** | THC sterownikowy (ARC VOL-DIV), IHS microswitch, źródło CUT80CNC. Istniejący post SheetCAM → Fusion `.cps` jest **referencją** dla postprocesora (kody łuku, pierce, THC — zweryfikować względem niego, nie zgadywać). Znany bug firmware: Pierce Up Time. |
| MK2 / mini plazma | **GRBL** (np. MKS DLC32) | Zajarzenie łuku przez przekaźnik (M3/M5 lub M8/M9 — konfigurowalne). Brak THC na start; przyszłościowo zewnętrzny THC (Arduino THCUD). Pierce delay przez `G4 P`. Brak IHS → stała wysokość lub touch-off. |

Postprocesory muszą być **pluginami** (konfigurowalny szablon + JS hooki), żeby dodać kolejne sterowniki (LinuxCNC/QtPlasmaC, Mach3/4, grblHAL) bez ruszania rdzenia.

## 4. Główny workflow

```
[Nowy projekt] → [Import DXF / Szkic] → [Materiał + grubość + prąd + dysza]
      → [GENERUJ (Synergia)] → [Podgląd ścieżek + powody decyzji]
      → [Korekty (opcjonalnie)] → [Symulacja] → [Walidacja] → [Eksport G-code / wyślij]
```

### 4.1 Import DXF — „Cleanup” automatyczny
- Scalanie zduplikowanych/nakładających się encji, łączenie końców w tolerancji (domyślnie 0,01 mm, edytowalna).
- Konwersja splajnów i elips na łuki (biarc fitting) z tolerancją — G-code ma mieć G02/G03, nie tysiące G01.
- Wykrywanie konturów zamkniętych vs otwartych, hierarchii (część → otwory → wyspy w otworach).
- Wykrywanie jednostek (mm/cal) i skali; ostrzeżenie gdy wymiary podejrzane.
- Warstwy DXF → możliwość mapowania warstw na operacje (np. warstwa `MARK` = znakowanie, `CUT` = cięcie, `IGNORE`).
- Raport z importu: „Naprawiono 12 przerw, 3 duplikaty, 2 kontury otwarte (pokazane na czerwono)”.

### 4.2 Szkicownik (CAD 2D)
- Narzędzia: linia, łuk (3 typy), okrąg, prostokąt, wielokąt, slot, splajn, offset, fillet, chamfer, trim/extend, mirror, szyk liniowy/kołowy, tekst (fonty TTF → kontury, opcja stencil/bridge dla wysp liter).
- **Więzy parametryczne** (jak Onshape/Fusion): coincident, tangent, parallel, perpendicular, equal, symmetric, horizontal/vertical, fix + wymiary sterujące. Kolorowanie stanu szkicu (niedookreślony/w pełni określony/przewymiarowany).
- Zmienne/parametry projektu (`grubosc = 4`, `otwor = grubosc * 2`).
- Biblioteka kształtów parametrycznych (kołnierz, flansza z otworami, płaskownik z otworami, uchwyt, „ucho” do spawania).

## 5. „Synergia” — reguły automatyki CAM

Wszystkie progi są parametrami tabeli cięcia/profilu — poniższe wartości to **domyślne punkty startowe**, nie stałe w kodzie.

### 5.1 Klasyfikacja konturów
| Typ | Kompensacja | Kierunek (domyślnie, palnik z wirem CW) |
|---|---|---|
| Zamknięty zewnętrzny (obrys części) | na zewnątrz o kerf/2 | **CW** (zgodnie z ruchem wskazówek) |
| Zamknięty wewnętrzny (otwór) | do wewnątrz o kerf/2 | **CCW** |
| Wyspa w otworze | jak zewnętrzny | CW |
| Otwarty | brak (po osi) lub wybór strony | wg kolejności rysowania / najkrótszy dojazd |

Kierunek wiru ustawiany w profilu maszyny — jego zmiana odwraca reguły (dobra strona cięcia zawsze po prawej stronie palnika).

### 5.2 Lead-in / lead-out
- **Typy:** liniowy, łukowy, linia+łuk, „ze środka” (radialny), brak.
- **Zewnętrzne:** łukowy lub linia+łuk; punkt wejścia preferencyjnie **w narożniku** (ślad niewidoczny) albo na najdłuższym prostym odcinku; nigdy na małym łuku/detalu.
- **Wewnętrzne:** wejście z wnętrza otworu; dla prostokątnych otworów – w narożniku lub środku dłuższego boku.
- **Długość lead-in:** f(grubość, kerf) — domyślnie ~ max(3 mm, 1,0–1,5× grubość), ograniczona geometrią (lead nie może wyjść poza otwór ani przeciąć innego konturu — automat skraca/zmienia typ i oznacza „dopasowano”).
- **Lead-out:** krótki (domyślnie 0–2 mm) lub **overcut** 0,5–1 mm; dla otworów opcja wyłączenia łuku przed końcem (torch-off distance), żeby nie było „kropli”.
- **Kąt** lead-in łukowego: domyślnie 90°, edytowalny.

### 5.3 Małe otwory i kształty wewnętrzne
- Próg „mały otwór”: **Ø < k × grubość** (domyślnie k = 2,5) **lub Ø < X mm z tabeli dyszy** — bierzemy większy z warunków.
- Dla małych otworów automatycznie:
  - lead-in **ze środka** (przebicie w środku, radialny dojazd),
  - prędkość obniżona (domyślnie 60%),
  - **THC wyłączony** na tym konturze (F2100K – kod blokady THC; GRBL – n/d),
  - opcjonalnie torch-off przed domknięciem.
- Próg minimalny: Ø < ~1× grubość (lub < 2× kerf) → **ostrzeżenie „nie do wycięcia plazmą”** + propozycje: oznacz punktakiem (marking), zostaw do wiercenia, wytnij mimo to.
- Ta sama logika dla małych slotów i ciasnych kształtów (kryterium: promień wpisany / najmniejszy wymiar).

### 5.4 Kolejność cięcia
1. Najpierw wszystkie kontury wewnętrzne części, potem obrys (część musi trzymać się arkusza do końca).
2. Wewnątrz części: od najmniejszych do największych lub nearest-neighbour — konfigurowalne.
3. Między częściami: nearest-neighbour z uwzględnieniem kierunku (np. od strony operatora / lewy-dolny róg), **bez przejazdów nad już wyciętymi częściami** (heurystyka anty-tip-up), ewentualnie podniesienie Z na „bezpieczną wysokość nad wyciętymi”.
4. Opcja „wytnij całą część zanim przejdziesz dalej” vs „najpierw wszystkie otwory na arkuszu”.

### 5.5 Parametry z tabeli cięcia (cut chart)
Klucz: **materiał + grubość + prąd + zestaw materiałów eksploatacyjnych (dysza)** →
kerf, prędkość, wysokość przebicia, czas przebicia (pierce delay), wysokość cięcia, napięcie łuku (THC), próg małych otworów, % prędkości dla otworów, długości leadów.
- Wbudowane presety startowe dla CUT80CNC (stal czarna, nierdzewka, aluminium; 1–12 mm) — oznaczone jako „do kalibracji”.
- **Kreator kalibracji kerfu:** tnie próbkę (kwadrat + otwór), użytkownik wpisuje zmierzone wymiary → soft liczy rzeczywisty kerf i zapisuje do presetu.
- Interpolacja między grubościami, gdy brak dokładnego wpisu (z ostrzeżeniem).

### 5.6 Dodatkowe automaty (po MVP)
- Mikromostki (tabs) dla małych części.
- Wspólna linia cięcia (common line) dla prostokątów.
- Łańcuchowanie (chain cutting) – jedno przebicie na kilka części.
- Znakowanie (marking) niskim prądem/ruchem bez przebicia.
- Nesting prostokątny → potem prawdziwy (NFP).

## 6. UX / UI

### 6.1 Styl
- Ciemny motyw domyślny (jasny opcjonalnie), czysty, „inżynierski”, płaskie panele, subtelne obramowania, akcent kolorystyczny jak łuk plazmy (cyan/elektryczny niebieski) + pomarańcz dla gorącego metalu/ostrzeżeń.
- Inspiracje: **Fusion 360** (przestrzenie robocze, timeline, browser), **Onshape** (szkicownik, więzy, czystość), **SheetCAM** (lista operacji, tabele narzędzi), **SolidCraft** (prostota).
- Obsługa myszy + klawiatury (skróty jak Fusion: L, C, R, D, T…), przygotowanie pod tablet/dotyk (większe hit-targety w trybie touch).

### 6.2 Layout
- **Górny pasek:** przełącznik przestrzeni roboczych `Szkic | CAM | Nesting | Symulacja | Wyślij`, wybór maszyny i presetu cięcia (zawsze widoczny „chip”: *Toploong 1325 · S235 · 4 mm · 45 A · dysza 1.1*), przełącznik **Synergic / Assisted / Manual**.
- **Lewy panel – Przeglądarka:** arkusz → części → kontury (z ikonami typu, kierunku, statusu auto/ręczny/błąd).
- **Centrum – Canvas:** arkusz, siatka, ścieżki w kolorach (zewn./wewn./otwarte/leady/przejazdy jałowe przerywane), punkty przebicia, strzałki kierunku, numery kolejności.
- **Prawy panel – Właściwości:** parametry zaznaczonego elementu z wartościami auto (szare) i nadpisanymi (białe + ikona), sekcja **„Dlaczego?”** z uzasadnieniem automatu.
- **Dół – Timeline/Lista operacji:** kolejność cięcia jako przeciągana lista + mini-oś czasu; szacowany czas cięcia, długość cięcia, liczba przebić, zużycie gazu/elektrody (szacunek).
- **Pasek statusu:** walidacja (zielony/żółty/czerwony), współrzędne kursora, jednostki.

### 6.3 Kluczowe ekrany
1. Ekran startowy / ostatnie projekty / szybki import DXF (drag & drop).
2. Raport importu DXF z podglądem napraw.
3. Szkicownik z więzami.
4. CAM po „Generuj” — ścieżki + panel „Dlaczego?”.
5. Edycja pojedynczego konturu (lead-in, kierunek, punkt startu przeciągany myszką po konturze).
6. Menedżer tabel cięcia + kreator kalibracji kerfu.
7. Profil maszyny + edytor postprocesora z podglądem G-code na żywo.
8. Symulacja (odtwarzanie, prędkość, ślad kerfu, heatmapa prędkości).
9. Walidacja przed eksportem + eksport (plik `.nc`/`.txt` na USB dla F2100K, streaming dla GRBL).

### 6.4 Walidacja (przykłady reguł)
- Kontur otwarty tam, gdzie powinien być zamknięty (błąd).
- Lead-in przecina część lub inny kontur (błąd).
- Otwór poniżej minimum dla dyszy (ostrzeżenie).
- Część poza arkuszem / poza polem roboczym maszyny (błąd).
- Przejazd jałowy nad wyciętą częścią bez podniesienia Z (ostrzeżenie).
- Brak kompensacji na konturze zamkniętym w trybie Manual (ostrzeżenie).

## 7. Architektura (propozycja)

- **Desktop:** Tauri (lekko, Rust backend do ciężkiej geometrii) lub Electron (szybszy start dla stacku JS) + **React + TypeScript**.
- **Rendering:** WebGL (Three.js w trybie ortho lub własny renderer 2D na regl/PixiJS) — tysiące segmentów płynnie.
- **Geometria:**
  - offsety/kompensacja: **Clipper2** (WASM) dla linii, ale z zachowaniem łuków (offset łuków analitycznie, Clipper jako fallback),
  - solver więzów: **planegcs** (solver z FreeCAD skompilowany do WASM),
  - DXF: `dxf-parser` + własny cleanup; eksport DXF `@tarikjabiri/dxf` lub własny.
- **Rdzeń CAM** jako czysta biblioteka TS (bez UI) — testowalna jednostkowo, z golden testami G-code.
- **Postprocesory:** deklaratywne szablony + hooki JS; testy porównawcze z istniejącym `.cps` dla F2100K.
- **Dane:** projekt jako JSON (`.arcflow`), tabele cięcia jako osobne pliki (import/eksport, wersjonowanie).
- **Komunikacja z maszyną:** F2100K – eksport pliku (USB); GRBL – serial/WebSerial (streaming z buforem, jog, home, zero).

## 8. Zakres MVP (kolejność)

1. Import DXF + cleanup + klasyfikacja konturów.
2. Synergia: kompensacja, kierunek, lead-in/out, małe otwory, kolejność.
3. Tabela cięcia (ręczne presety) + profil maszyny.
4. Postprocesor F2100K (zgodny z obecnym .cps) i GRBL.
5. Podgląd ścieżek + edycja konturu + panel „Dlaczego?”.
6. Symulacja 2D + walidacja + eksport.
7. Szkicownik (podstawowe narzędzia + więzy).
8. Później: nesting, tabs, common line, tekst stencil, streaming GRBL, apka mobilna/touch.

## 9. Otwarte pytania

- Dokładne kody F2100K: włączenie/wyłączenie łuku, blokada THC, obsługa IHS, format pliku — **zweryfikować na istniejącym poście i dokumentacji Fangling**.
- MK2/GRBL: który kod do przekaźnika łuku (M3 vs M8), czy firmware obsługuje laser mode (należy go **wyłączyć** dla plazmy przy M3).
- Tauri vs Electron.
- Model biznesowy: narzędzie własne vs produkt na sprzedaż (wpływa na licencje bibliotek, np. planegcs = LGPL).
- Język UI: PL + EN od startu (i18n od pierwszego dnia).
