"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

const OPTS: [string, string][] = [
  ["today", "periodToday"], ["7", "period7"], ["30", "period30"], ["month", "periodMonth"], ["all", "periodAll"],
];

export default function PeriodFilter() {
  const tr = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const cur = sp.get("period") || "all";

  function pick(v: string) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    if (v === "all") p.delete("period"); else p.set("period", v);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 18, paddingBottom: 2 }}>
      {OPTS.map(([v, k]) => {
        const on = cur === v;
        return (
          <button key={v} onClick={() => pick(v)}
            style={{
              height: 34, padding: "0 15px", borderRadius: 10, whiteSpace: "nowrap", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 12.5,
              border: "1px solid " + (on ? "var(--brand)" : "var(--line)"),
              background: on ? "var(--brand)" : "var(--surface)",
              color: on ? "#fff" : "var(--muted-d)",
            }}>
            {tr(k)}
          </button>
        );
      })}
    </div>
  );
}
