"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

const STG: Record<string, { k: string; c: string }> = {
  new: { k: "dashStageNew", c: "#2F6BFF" }, contacted: { k: "dashStageContacted", c: "#0FA3A3" },
  interested: { k: "dashStageInterested", c: "#7B61FF" }, quote: { k: "dashStageQuote", c: "#E6A700" },
  negotiation: { k: "dashStageNegotiation", c: "#F08A24" }, enrolled: { k: "dashStageEnrolled", c: "#18A957" },
  onhold: { k: "dashStageOnhold", c: "#E6A700" }, lost: { k: "dashStageLost", c: "#94A2BB" },
};
const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
function waLink(p: string) { const d = (p || "").replace(/\D/g, ""); return d ? "https://wa.me/" + d : "#"; }

type Data = {
  name: string; phone1: string; email: string; company: string; stage: string;
  specialty: string; owner: string; source: string; created: string;
  diplomas: string[]; batches: string[];
  agreed: number; paid: number; remaining: number; nextDue: string;
};

export default function CustomerBrief({ customerId, canFinance }: { customerId: string; canFinance: boolean }) {
  const t = useT();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      const { data: c } = await supabase.from("customers")
        .select("name,phone1,email,company,stage,source,created_at,specialty_id,owner_id, specialties(name_ar)")
        .eq("id", customerId).maybeSingle();
      const cc = c as any;
      let owner = "";
      if (cc?.owner_id) {
        const { data: o } = await supabase.from("profiles").select("full_name").eq("id", cc.owner_id).maybeSingle();
        owner = (o as any)?.full_name || "";
      }
      const { data: enr } = await supabase.from("enrollments")
        .select("id, diplomas(name_ar), batches(code)").eq("customer_id", customerId);
      const enrList = (enr as any[]) || [];
      const diplomas = Array.from(new Set(enrList.map((e) => e.diplomas?.name_ar).filter(Boolean)));
      const batches = Array.from(new Set(enrList.map((e) => e.batches?.code).filter(Boolean)));

      let agreed = 0, paid = 0, remaining = 0, nextDue = "";
      if (canFinance && enrList.length) {
        const ids = enrList.map((e) => e.id);
        const [{ data: fin }, { data: ins }] = await Promise.all([
          supabase.from("enrollment_finance").select("agreed_amount").in("enrollment_id", ids),
          supabase.from("installments").select("amount,status,due_date,paid_at").in("enrollment_id", ids),
        ]);
        agreed = ((fin as any[]) || []).reduce((s, f) => s + (Number(f.agreed_amount) || 0), 0);
        const due = ((ins as any[]) || []).filter((i) => !(i.status === "paid" || i.paid_at));
        paid = ((ins as any[]) || []).filter((i) => i.status === "paid" || i.paid_at).reduce((s, i) => s + (Number(i.amount) || 0), 0);
        remaining = agreed - paid;
        const upcoming = due.filter((i) => i.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
        if (upcoming[0]) nextDue = String(upcoming[0].due_date).slice(0, 10);
      }

      setData({
        name: cc?.name || "—", phone1: cc?.phone1 || "", email: cc?.email || "", company: cc?.company || "",
        stage: cc?.stage || "new", specialty: cc?.specialties?.name_ar || "", owner, source: cc?.source || "",
        created: cc?.created_at ? String(cc.created_at).slice(0, 10) : "",
        diplomas, batches, agreed, paid, remaining, nextDue,
      });
    } catch { setData(null); }
    setLoading(false);
  }

  function toggle() {
    const nx = !open;
    setOpen(nx);
    if (nx && !data && !loading) load();
  }

  const st = data ? (STG[data.stage] || STG.new) : STG.new;
  const Row = ({ label, value }: { label: string; value: any }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <b style={{ color: "var(--ink)", textAlign: "end" }}>{value || "—"}</b>
    </div>
  );

  return (
    <div ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={toggle} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12, fontWeight: 700 }}>
        {t("briefBtn")}
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", insetInlineEnd: 0, width: 300, zIndex: 60,
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
          boxShadow: "0 14px 44px rgba(0,0,0,.22)", padding: 14,
        }}>
          {loading || !data ? (
            <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 12 }}>…</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <b style={{ fontSize: 14.5, color: "var(--ink)" }}>{data.name}</b>
                <span className="stg" style={{ background: st.c + "1a", color: st.c }}>{t(st.k)}</span>
              </div>
              {data.phone1 && <div className="num" dir="ltr" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{data.phone1}</div>}

              <Row label={t("specialty")} value={data.specialty} />
              <Row label={t("diplomas")} value={data.diplomas.join(" / ")} />
              <Row label={t("batchWord")} value={data.batches.join(" / ")} />
              {data.company && <Row label={t("company")} value={data.company} />}
              <Row label={t("owner")} value={data.owner || t("unassigned")} />
              {data.source && <Row label={t("source")} value={data.source} />}
              <Row label={t("createdDate")} value={data.created} />

              {canFinance && data.agreed > 0 && (
                <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--muted-soft)" }}>
                  <Row label={t("salesBaseCol")} value={money(data.agreed)} />
                  <Row label={t("collected")} value={money(data.paid)} />
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
                    <span style={{ color: "var(--muted)" }}>{t("remaining")}</span>
                    <b style={{ color: data.remaining > 0 ? "#E0483B" : "#18A957" }} dir="ltr">{money(data.remaining)}</b>
                  </div>
                  {data.nextDue && <Row label={t("nextDueLabel")} value={data.nextDue} />}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Link href={`/customers/${customerId}`} className="btn" style={{ flex: 1, height: 34, fontSize: 12.5, textAlign: "center" }}>{t("openCard")}</Link>
                {data.phone1 && (
                  <a href={waLink(data.phone1)} target="_blank" rel="noreferrer" className="btn wa" style={{ height: 34, padding: "0 12px", textDecoration: "none" }}>
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" /></svg>
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
