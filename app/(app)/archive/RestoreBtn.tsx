"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function RestoreBtn({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  async function restore() {
    setBusy(true);
    const { error } = await supabase.from("customers").update({ archived: false }).eq("id", id);
    setBusy(false);
    if (error) { toast("تعذّر الرجوع"); return; }
    toast("رجع للعملاء"); router.refresh();
  }
  return (
    <button className="btn ghost" onClick={restore} disabled={busy} style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}>
      {busy ? "..." : "↩ رجوع للعملاء"}
    </button>
  );
}
