"use client";
import { useT } from "@/lib/i18n/client";

type Row = Record<string, string>;

export default function ExportButton({ rows, headers }: { rows: Row[]; headers: [string, string][] }) {
  const tr = useT();
  function download() {
    const cols = headers.map((h) => h[0]);
    const titles = headers.map((h) => h[1]);
    const esc = (v: string) => {
      const s = (v ?? "").toString().replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [titles.map(esc).join(",")];
    for (const r of rows) lines.push(cols.map((c) => esc(r[c] || "")).join(","));
    // BOM علشان Excel يقرا العربي صح
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `niqat-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={download} className="btn ghost" title={tr("exportCustomersCsv")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      {tr("export")}
    </button>
  );
}
