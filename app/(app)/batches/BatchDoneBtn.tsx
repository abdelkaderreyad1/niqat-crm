"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

export default function BatchDoneBtn({ id }: { id: string }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function mark() {
    setBusy(true);
    const { error } = await supabase.from("batches").update({ status: "closed" }).eq("id", id);
    setBusy(false);
    if (error) { toast(tr("updateFailedShort")); return; }
    toast(tr("markedEnded")); router.refresh();
  }

  return (
    <button className="lnk" onClick={mark} disabled={busy}
      style={{ fontSize: 12, fontWeight: 700, color: "#2F6BFF", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      {busy ? "..." : tr("markEnded")}
    </button>
  );
}
