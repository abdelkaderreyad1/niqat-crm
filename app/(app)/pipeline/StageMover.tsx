"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STAGES = [
  { key: "new", label: "جديد" },
  { key: "contacted", label: "تم التواصل" },
  { key: "interested", label: "مهتم" },
  { key: "quote", label: "عرض سعر مُرسل" },
  { key: "negotiation", label: "تفاوض" },
  { key: "enrolled", label: "مشترك" },
  { key: "lost", label: "خسارة" },
];

export default function StageMover({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [val, setVal] = useState(current);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    if (next === val) return;
    const prev = val;
    setVal(next);
    setBusy(true);
    const { error } = await supabase.from("customers").update({ stage: next }).eq("id", id);
    setBusy(false);
    if (error) {
      setVal(prev);
      alert("تعذّر نقل المرحلة: " + error.message);
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
      {STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
