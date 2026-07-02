"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";


export default function StageMover({ id, current }: { id: string; current: string }) {
  const tr = useT();
  const STAGES = [
    { key: "new", label: tr("dashStageNew") },
    { key: "contacted", label: tr("dashStageContacted") },
    { key: "interested", label: tr("dashStageInterested") },
    { key: "negotiation", label: tr("dashStageNegotiation") },
    { key: "enrolled", label: tr("dashStageEnrolled") },
    { key: "onhold", label: tr("dashStageOnhold") },
    { key: "lost", label: tr("dashStageLost") },
  ];
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
