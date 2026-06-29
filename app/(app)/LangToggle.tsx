"use client";
import { useRouter } from "next/navigation";
import { useLang, setLangCookie } from "@/lib/i18n/client";

export default function LangToggle() {
  const router = useRouter();
  const lang = useLang();
  function flip() {
    const next = lang === "ar" ? "en" : "ar";
    setLangCookie(next);
    router.refresh();
  }
  return (
    <button className="icon-btn" type="button" onClick={flip} title={lang === "ar" ? "English" : "العربية"}
      style={{ fontWeight: 800, fontSize: 13, width: "auto", padding: "0 12px", gap: 6 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
