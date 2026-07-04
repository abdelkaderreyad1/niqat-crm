"use client";
import { useEffect, useState } from "react";
import { DAILY_QUOTES, randomCat } from "@/lib/fun";

const KEY = "niqat_daily_greet";

export default function DailyGreeting() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [quote, setQuote] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let last = "";
    try { last = localStorage.getItem(KEY) || ""; } catch {}
    if (last === today) return;

    // اختيار جملة عشوائية (نتجنّب تكرار جملة أمس)
    let lastQ = "";
    try { lastQ = localStorage.getItem(KEY + "_q") || ""; } catch {}
    let pool = DAILY_QUOTES.filter((q) => q !== lastQ);
    if (!pool.length) pool = DAILY_QUOTES;
    const q = pool[Math.floor(Math.random() * pool.length)];

    setQuote(q);
    setCat(randomCat());
    setShow(true);
    try {
      localStorage.setItem(KEY, today);
      localStorage.setItem(KEY + "_q", q);
    } catch {}

    const t1 = setTimeout(() => setLeaving(true), 5000);
    const t2 = setTimeout(() => setShow(false), 5450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function close() {
    setLeaving(true);
    setTimeout(() => setShow(false), 450);
  }

  if (!show) return null;

  return (
    <div className={"dg-overlay" + (leaving ? " dg-leave" : "")} onClick={close}>
      <div className="dg-card" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dg-cat" src={cat} alt="" aria-hidden="true" />
        <div className="dg-quote">{quote}</div>
        <button className="dg-close" onClick={close} aria-label="close">×</button>
      </div>
    </div>
  );
}
