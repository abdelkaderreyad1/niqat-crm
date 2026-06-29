"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

type Opt = { v: string; label: string };
type Tpl = { id: string; name: string; body: string };

export default function CustomersTools({
  stages, owners, diplomas, batches, companies, canFinance, canMessage,
  phones, templates,
}: {
  stages: Opt[]; owners: Opt[]; diplomas: Opt[]; batches: Opt[]; companies: Opt[];
  canFinance: boolean; canMessage: boolean; phones: string[]; templates: Tpl[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [openBulk, setOpenBulk] = useState(false);

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val); else p.delete(key);
    router.push("/customers" + (p.toString() ? "?" + p.toString() : ""));
  }
  const cur = (k: string) => sp.get(k) || "";

  const Sel = (key: string, ph: string, opts: Opt[]) => (
    <select className="inp" style={{ minWidth: 120, height: 36 }} value={cur(key)} onChange={(e) => setParam(key, e.target.value)}>
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );

  const nums = phones.filter(Boolean);
  function copyNums() {
    if (navigator.clipboard) navigator.clipboard.writeText(nums.join("\n"));
    toast("اتنسخت الأرقام");
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        {Sel("stage", "كل المراحل", stages)}
        {Sel("dip", "كل الدبلومات", diplomas)}
        {Sel("batch", "كل الباتشات", batches)}
        {owners.length > 0 && Sel("owner", "كل المسؤولين", owners)}
        {companies.length > 0 && Sel("company", "كل الشركات", companies)}
        {canFinance && Sel("pay", "كل حالات الدفع", [
          { v: "bal", label: "عليه رصيد" }, { v: "due", label: "له موعد استحقاق" }, { v: "overdue", label: "متأخر" },
        ])}
        {(sp.toString()) && (
          <button className="btn ghost" style={{ height: 36, padding: "0 12px", fontSize: 12.5 }} onClick={() => router.push("/customers")}>مسح الفلاتر</button>
        )}
        {canMessage && nums.length > 0 && (
          <button className="btn" style={{ height: 36, padding: "0 12px", fontSize: 12.5, marginInlineStart: "auto" }} onClick={() => setOpenBulk(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" /></svg>
            إرسال جماعي ({nums.length})
          </button>
        )}
      </div>

      {openBulk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setOpenBulk(false)}>
          <div className="card" style={{ padding: 20, width: "min(460px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="sec-t" style={{ marginTop: 0 }}>إرسال جماعي — {nums.length} رقم</div>
            <div className="fld"><label>اختر قالب</label>
              <select className="inp" id="bulk_tpl">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                {templates.length === 0 && <option>مفيش قوالب</option>}
              </select></div>
            <div className="fld"><label>الأرقام</label>
              <textarea className="inp num" dir="ltr" rows={4} readOnly value={nums.join("\n")} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={copyNums}>نسخ الأرقام</button>
              <button className="btn" onClick={() => { toast("استخدم القالب وانسخ الأرقام للإرسال عبر WATI"); setOpenBulk(false); }}>تم</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>الإرسال الفعلي الجماعي بيتم عبر WATI بعد ربط المفتاح. دلوقتي تقدر تنسخ الأرقام والقالب.</p>
          </div>
        </div>
      )}
    </>
  );
}
