"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

const STAGES = [
  { key: "contacted", labelKey: "dashStageContacted" },
  { key: "interested", labelKey: "dashStageInterested" },
  { key: "enrolled", labelKey: "dashStageEnrolled" },
  { key: "lost", labelKey: "dashStageLost" },
];

export default function StageMover({ id, current }: { id: string; current: string }) {
  const tr = useT();
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
      alert(tr("moveStageFailed") + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <select
      value={val}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="w-full text-xs border border-line rounded-md px-2 py-1 disabled:opacity-50"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      {STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {tr(s.labelKey)}
        </option>
      ))}
    </select>
  );
}
