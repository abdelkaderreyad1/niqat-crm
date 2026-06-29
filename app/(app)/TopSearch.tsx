"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  function go() {
    const v = q.trim();
    router.push(v ? `/customers?q=${encodeURIComponent(v)}` : "/customers");
  }
  return (
    <div className="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
      <input placeholder="ابحث عن عميل (اسم / موبايل / إيميل)…" value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
    </div>
  );
}
