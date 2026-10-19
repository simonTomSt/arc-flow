import type { Reason, ReasonCode } from "./types";

type Fmt = (p: Record<string, number | string>) => string;

const n = (x: number | string | undefined, d = 2) =>
  typeof x === "number" ? x.toFixed(d).replace(/\.?0+$/, "").replace(".", ",") : String(x ?? "");

/** Polish messages for the "Dlaczego?" panel (primary UI language). */
export const reasonTextPl: Record<ReasonCode, Fmt> = {
  ROLE_OUTER: (p) => `Obrys części → kompensacja na zewnątrz, kierunek ${p.dir}`,
  ROLE_HOLE: (p) => `Otwór → kompensacja do wewnątrz, kierunek ${p.dir}`,
  ROLE_ISLAND: (p) => `Wyspa w otworze → jak obrys, kierunek ${p.dir}`,
  ROLE_OPEN: () => `Kontur otwarty → cięcie po osi, bez kompensacji`,
  SMALL_HOLE_CENTER: (p) => `Ø${n(p.size)} < ${n(p.k)} × grubość (${n(p.limit)} mm) → wejście ze środka`,
  SMALL_HOLE_SPEED: (p) => `Mały otwór → prędkość ${p.pct} %`,
  THC_OFF_SHORT: (p) => `Kontur ${n(p.len, 1)} mm < ${n(p.limit, 0)} mm → THC wyłączony`,
  THC_OFF_SMALL: () => `Mały otwór → THC wyłączony`,
  LEAD_CLAMPED: (p) => `Wejście skrócone do ${n(p.len)} mm: Ø${n(p.size)} − kerf ${n(p.kerf)} − 2 × ${n(p.margin)} mm zapasu`,
  TOO_SMALL_TO_CUT: (p) => `Ø${n(p.size)} < minimum ${n(p.limit)} mm → nie do wycięcia plazmą`,
  DRILL_SUGGESTED: (p) => `Ø${n(p.size)} < ${n(p.k)} × grubość (${n(p.limit)} mm) → plazma da stożek, lepiej punktować i wiercić`,
  KERF_FROM_CHART: (p) => `Kerf ${n(p.kerf)} mm z tabeli cięcia`,
  MANUAL_MODE: () => `Tryb Manual: automat wyłączony`,
};

export const reasonPl = (r: Reason): string => reasonTextPl[r.code](r.params);

/** English messages for the "Why?" panel. Keep in sync with reasonTextPl. */
export const reasonTextEn: Record<ReasonCode, Fmt> = {
  ROLE_OUTER: (p) => `Part outline → kerf outside, direction ${p.dir}`,
  ROLE_HOLE: (p) => `Hole → kerf inside, direction ${p.dir}`,
  ROLE_ISLAND: (p) => `Island inside a hole → treated as an outline, direction ${p.dir}`,
  ROLE_OPEN: () => `Open contour → cut on the centre line, no compensation`,
  SMALL_HOLE_CENTER: (p) => `Ø${p.size} < ${p.k} × thickness (${p.limit} mm) → lead-in from the centre`,
  SMALL_HOLE_SPEED: (p) => `Small hole → speed ${p.pct} %`,
  THC_OFF_SHORT: (p) => `Contour ${Number(p.len).toFixed(1)} mm < ${p.limit} mm → THC off`,
  THC_OFF_SMALL: () => `Small hole → THC off`,
  LEAD_CLAMPED: (p) => `Lead-in shortened to ${Number(p.len).toFixed(2)} mm: Ø${p.size} − kerf ${p.kerf} − 2 × ${p.margin} mm clearance`,
  TOO_SMALL_TO_CUT: (p) => `Ø${p.size} < minimum ${Number(p.limit).toFixed(2)} mm → not cuttable with plasma`,
  DRILL_SUGGESTED: (p) => `Ø${p.size} < ${p.k} × thickness (${p.limit} mm) → plasma leaves a taper, mark and drill instead`,
  KERF_FROM_CHART: (p) => `Kerf ${p.kerf} mm from the cut chart`,
  MANUAL_MODE: () => `Manual mode: automation off`,
};

export const reasonText = (r: Reason, lang: "pl" | "en" = "pl"): string => (lang === "en" ? reasonTextEn : reasonTextPl)[r.code](r.params);
