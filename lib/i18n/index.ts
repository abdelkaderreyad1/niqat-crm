import { cookies } from "next/headers";
import { DICT } from "./dict";

export type Lang = "ar" | "en";

export function getLang(): Lang {
  try {
    const c = cookies().get("lang")?.value;
    return c === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function tFor(lang: Lang) {
  return (key: string): string => {
    const v = DICT[lang]?.[key];
    return v === undefined ? key : (v as string);
  };
}

// مساعد للسيرفر مباشرة
export function t(key: string): string {
  return tFor(getLang())(key);
}
