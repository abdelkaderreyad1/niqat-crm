"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = [
  { key: "open", label: "مفتوحة" },
  { key: "progress", label: "قيد المعالجة" },
  { key: "resolved", label: "محلولة" },
  { key: "closed", label: "مغلقة" },
];

export default function StatusMover({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [val, setVal] = useState(current);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    if (next === val) return;
    const prev = val;
    setVal(next);
    setBusy(true);
    const { error } = await supabase.from("tickets").update({ status: next }).eq("id", id);
    setBusy(false);
    if (error) {
      setVal(prev);
      alert("تعذّر تغيير الحالة: " + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <select
      value={val}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="w-full text-xs border border-line rounded-md px-2 py-1 bg-white disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
