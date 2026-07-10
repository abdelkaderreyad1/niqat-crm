"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Aff = { name: string; code: string; discount: number; rate?: number };

export default function AffiliatesManager({ initial }: { initial: Aff[] }) {
  const tr = useT();
  const supabase = createClient();
  const router = useRouter();
  const [list, setList] = useState<Aff[]>(initial || []);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [disc, setDisc] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function persist(next: Aff[]) {
    setBusy(true); setSaved(false);
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "affiliates", value: next, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { alert(tr("saveFailedColon") + error.message); return false; }
    setSaved(true); router.refresh(); return true;
  }

  async function add() {
    const c = code.trim().toUpperCase();
    if (!c) return alert(tr("enterCode"));
    if (list.some((a) => a.code.toUpperCase() === c)) return alert(tr("codeAlreadyExists"));
    const d = Number(disc) || 0;
    const r = Number(rate) || 0;
    const next = [...list, { name: name.trim() || "—", code: c, discount: d, rate: r }];
    setList(next); setName(""); setCode(""); setDisc(""); setRate("");
    await persist(next);
  }

  function changeDiscount(i: number, v: string) {
    setList(list.map((a, idx) => (idx === i ? { ...a, discount: Number(v) || 0 } : a)));
  }

  function changeRate(i: number, v: string) {
    setList(list.map((a, idx) => (idx === i ? { ...a, rate: Number(v) || 0 } : a)));
  }

  async function remove(i: number) {
    if (!confirm(tr("deleteCodeQ"))) return;
    const next = list.filter((_, idx) => idx !== i);
    setList(next); await persist(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="sec-t" style={{ marginTop: 0 }}>{tr("addNewCode")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <input className="inp" style={{ flex: 1, minWidth: 140 }} placeholder={tr("affiliateName")}
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className="inp" style={{ width: 130 }} placeholder={tr("code")}
            value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="inp num" style={{ width: 100 }} placeholder={tr("discountPct")}
            value={disc} onChange={(e) => setDisc(e.target.value)} />
          <input className="inp num" style={{ width: 120 }} placeholder={tr("commissionPct")}
            value={rate} onChange={(e) => setRate(e.target.value)} />
          <button onClick={add} disabled={busy} className="btn">{tr("add")}</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("code")}</th>
              <th>{tr("name")}</th>
              <th>{tr("discountPct")}</th>
              <th>{tr("commissionPct")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{tr("noCodesYet")}</td></tr>
            )}
            {list.map((a, i) => (
              <tr key={a.code}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>{a.code}</td>
                <td>{a.name}</td>
                <td>
                  <input className="inp num" style={{ width: 80, padding: "5px 8px" }}
                    value={a.discount} onChange={(e) => changeDiscount(i, e.target.value)} />
                </td>
                <td>
                  <input className="inp num" style={{ width: 80, padding: "5px 8px" }}
                    value={a.rate ?? 0} onChange={(e) => changeRate(i, e.target.value)} />
                </td>
                <td style={{ textAlign: "end" }}>
                  <button onClick={() => remove(i)} style={{ color: "var(--red)", fontSize: 12, fontWeight: 700, background: "none" }}>{tr("delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => persist(list)} disabled={busy} className="btn">{tr("saveDiscountEdits")}</button>
        {saved && <span style={{ color: "var(--green)", fontSize: 13, fontWeight: 700 }}>{tr("saved2")} ✓</span>}
      </div>
    </div>
  );
}
