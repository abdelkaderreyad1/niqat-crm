"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

const STG: Record<string, { k: string; c: string }> = {
  contacted: { k: "dashStageContacted", c: "#0FA3A3" },
  interested: { k: "dashStageInterested", c: "#7B61FF" },
  enrolled: { k: "dashStageEnrolled", c: "#18A957" },
  lost: { k: "dashStageLost", c: "#94A2BB" },
};
const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
function waLink(p: string) { const d = (p || "").replace(/\D/g, ""); return d ? "https://wa.me/" + d : "#"; }

type Data = {
  name: string; phone1: string; company: string; stage: string;
  specialty: string; owner: string; source: string; created: string;
  diplomas: string[]; batches: string[];
  agreed: number; paid: number; remaining: number; nextDue: string;
  transfers: string[];
};

export default function CustomerBrief({ customerId, canFinance }: { customerId: string; canFinance: boolean }) {
  const t = useT();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr(false);
    try {
      const { data: c, error } = await supabase.from("customers")
        .select("name,phone1,company,stage,source,created_at,specialty_id,owner_id")
        .eq("id", customerId).maybeSingle();
      if (error) throw error;
      const cc = (c || {}) as any;

      const [spRes, ownRes, enrRes, trRes] = await Promise.all([
        cc.specialty_id ? supabase.from("specialties").select("name_ar").eq("id", cc.specialty_id).maybeSingle() : Promise.resolve({ data: null }),
        cc.owner_id ? supabase.from("profiles").select("full_name").eq("id", cc.owner_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("enrollments").select("id, diplomas(name_ar), batches(code)").eq("customer_id", customerId),
        supabase.from("audit_log").select("detail,at").eq("customer_id", customerId).eq("action", "batch_transfer").order("at", { ascending: false }),
      ]);
      const enrList = ((enrRes as any).data as any[]) || [];
      const diplomas = Array.from(new Set(enrList.map((e) => e.diplomas?.name_ar).filter(Boolean)));
      const batches = Array.from(new Set(enrList.map((e) => e.batches?.code).filter(Boolean)));
      const transfers = (((trRes as any).data as any[]) || []).map((r) => String(r.detail || "").trim()).filter(Boolean);

      let agreed = 0, paid = 0, remaining = 0, nextDue = "";
      if (canFinance && enrList.length) {
        const ids = enrList.map((e) => e.id);
        const [{ data: fin }, { data: ins }] = await Promise.all([
          supabase.from("enrollment_finance").select("agreed_amount").in("enrollment_id", ids),
          supabase.from("installments").select("amount,status,due_date,paid_at").in("enrollment_id", ids),
        ]);
        agreed = ((fin as any[]) || []).reduce((s, f) => s + (Number(f.agreed_amount) || 0), 0);
        paid = ((ins as any[]) || []).filter((i) => i.status === "paid" || i.paid_at).reduce((s, i) => s + (Number(i.amount) || 0), 0);
        remaining = agreed - paid;
        const upcoming = ((ins as any[]) || []).filter((i) => !(i.status === "paid" || i.paid_at) && i.due_date)
          .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
        if (upcoming[0]) nextDue = String(upcoming[0].due_date).slice(0, 10);
      }

      setData({
        name: cc.name || "—", phone1: cc.phone1 || "", company: cc.company || "",
        stage: cc.stage || "interested", specialty: (spRes as any).data?.name_ar || "",
        owner: (ownRes as any).data?.full_name || "", source: cc.source || "",
        created: cc.created_at ? String(cc.created_at).slice(0, 10) : "",
        diplomas, batches, agreed, paid, remaining, nextDue, transfers,
      });
    } catch { setErr(true); }
    setLoading(false);
  }

  function openModal() { setOpen(true); if (!data) load(); }

  const st = data ? (STG[data.stage] || STG.interested) : STG.interested;
  const Row = ({ label, value }: { label: string; value: any }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", fontSize: 13, borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <b style={{ color: "var(--ink)", textAlign: "end" }}>{value || "—"}</b>
    </div>
  );

  return (
    <>
      <button onClick={openModal} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12, fontWeight: 700 }}>
        {t("briefBtn")}
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, maxHeight: "85vh", overflowY: "auto", background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.4)", padding: 18 }}>
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 24 }}>…</div>
            ) : err || !data ? (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 20 }}>
                {t("errorOccurredShort")}
                <div style={{ marginTop: 12 }}><button className="btn ghost" onClick={() => setOpen(false)}>{t("close")}</button></div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 15.5, color: "var(--ink)" }}>{data.name}</b>
                    {data.phone1 && <div className="num" dir="ltr" style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{data.phone1}</div>}
                  </div>
                  <span className="stg" style={{ background: st.c + "1a", color: st.c, flexShrink: 0 }}>{t(st.k)}</span>
                </div>

                <Row label={t("specialty")} value={data.specialty} />
                <Row label={t("diplomas")} value={data.diplomas.join(" / ")} />
                <Row label={t("batchWord")} value={data.batches.join(" / ")} />
                {data.company && <Row label={t("company")} value={data.company} />}
                <Row label={t("owner")} value={data.owner || t("unassigned")} />
                {data.source && <Row label={t("source")} value={data.source} />}
                <Row label={t("createdDate")} value={data.created} />

                {data.transfers.length > 0 && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "rgba(240,138,36,.1)", border: "1px solid rgba(240,138,36,.35)" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#C56A12", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🔄</span>{t("auditBatchTransfer")}
                    </div>
                    {data.transfers.map((trLine, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: "var(--ink)", padding: "3px 0", lineHeight: 1.5 }}>{trLine}</div>
                    ))}
                  </div>
                )}

                {canFinance && data.agreed > 0 && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--muted-soft)" }}>
                    <Row label={t("salesBaseCol")} value={money(data.agreed)} />
                    <Row label={t("collected")} value={money(data.paid)} />
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5 }}>
                      <span style={{ color: "var(--muted)" }}>{t("remaining")}</span>
                      <b style={{ color: data.remaining > 0 ? "#E0483B" : "#18A957" }} dir="ltr">{money(data.remaining)}</b>
                    </div>
                    {data.nextDue && <Row label={t("nextDueLabel")} value={data.nextDue} />}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn" style={{ flex: 1, height: 38 }} onClick={() => { setOpen(false); router.push(`/customers/${customerId}`); }}>{t("openCard")}</button>
                  {data.phone1 && (
                    <a href={waLink(data.phone1)} target="_blank" rel="noreferrer" className="btn wa" style={{ height: 38, padding: "0 14px", textDecoration: "none" }}>
                      <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" /></svg>
                    </a>
                  )}
                  <button className="btn ghost" style={{ height: 38, padding: "0 14px" }} onClick={() => setOpen(false)}>{t("close")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
