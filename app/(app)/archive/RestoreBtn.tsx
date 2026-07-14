"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function RestoreBtn({ id }: { id: string }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  async function restore() {
    setBusy(true);
    const { error } = await supabase.from("customers").update({ archived: false }).eq("id", id);
    if (!error) {
      // العميل رجع للنشط → أي ريفند نشط له يتقفل
      await supabase.from("refunds").update({ status: "closed" }).eq("customer_id", id).neq("status", "closed");
    }
    setBusy(false);
    if (error) { toast(tr("restoreFailed")); return; }
    toast(tr("restoredToCustomers")); router.refresh();
  }
  return (
    <button className="btn ghost" onClick={restore} disabled={busy} style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}>
      {busy ? "..." : "↩ " + tr("restoreToCustomers")}
    </button>
  );
}
