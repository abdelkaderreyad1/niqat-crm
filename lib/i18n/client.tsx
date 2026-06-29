"use client";
import { createContext, useContext } from "react";
import { DICT } from "./dict";

type Lang = "ar" | "en";
const LangCtx = createContext<Lang>("ar");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}

export function useLang(): Lang {
  return useContext(LangCtx);
}

export function useT() {
  const lang = useContext(LangCtx);
  return (key: string): string => {
    const v = DICT[lang]?.[key];
    return v === undefined ? key : (v as string);
  };
}

export function setLangCookie(lang: Lang) {
  document.cookie = `lang=${lang}; path=/; max-age=31536000`;
}
