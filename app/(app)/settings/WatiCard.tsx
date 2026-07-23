"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Wati = { endpoint: string; token: string; sender_sales: string; sender_support: string };

export default function WatiCard({ initial }: { initial: Wati }) {
  const tr = useT();
  const supabase = createClient();
  const [w, setW] = useState<Wati>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Wati, v: string) => setW((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "wati", value: w, updated_at: new Date().toISOString() });
    setBusy(false);
    toast(error ? tr("saveFailed") : tr("watiSaved"));
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h"><h3>{tr("watiTitle")}</h3></div>
      <div className="banner" style={{ margin: "10px 0 16px" }}>
        🔒 {tr("watiHint")}
      </div>
      <div className="fld"><label>Endpoint</label>
        <input className="inp" dir="ltr" value={w.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="https://live-server.wati.io/api/v1" /></div>
      <div className="fld"><label>API Token</label>
        <input className="inp" dir="ltr" type="password" value={w.token} onChange={(e) => set("token", e.target.value)} placeholder="••••••••" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("senderNumberSales")}</label>
          <input className="inp" dir="ltr" value={w.sender_sales} onChange={(e) => set("sender_sales", e.target.value)} placeholder="2010xxxxxxxx" /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("senderNumberSupport")}</label>
          <input className="inp" dir="ltr" value={w.sender_support} onChange={(e) => set("sender_support", e.target.value)} placeholder="2010xxxxxxxx" /></div>
      </div>
      <button onClick={save} disabled={busy} className="btn" style={{ marginTop: 16 }}>{busy ? "..." : tr("save")}</button>
    </div>
  );
}
