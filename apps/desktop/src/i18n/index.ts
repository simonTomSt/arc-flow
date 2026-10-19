import { createContext, useContext } from "react";
import { pl, type MessageKey } from "./pl";
import { en } from "./en";

export type Lang = "pl" | "en";
const dicts: Record<Lang, Record<MessageKey, string>> = { pl, en };

/** Numbers in the UI use a decimal comma in Polish (design: "1,52 mm"). */
export function fmtNum(x: number, lang: Lang, digits = 2): string {
  const s = x.toFixed(digits).replace(/\.?0+$/, "");
  return lang === "pl" ? s.replace(".", ",") : s;
}

export function translate(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  return dicts[lang][key].replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = params[k];
    return typeof v === "number" ? fmtNum(v, lang) : (v ?? `{${k}}`);
  });
}

export const LangContext = createContext<Lang>("pl");
export function useT() {
  const lang = useContext(LangContext);
  return (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params);
}
export type { MessageKey };
