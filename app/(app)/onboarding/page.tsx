import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("handoffs")
    .select("id,customer_id,assignee_id,note,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: custs } = await supabase.from("customers").select("id,name,stage,phone1");
  const cMap = new Map((custs || []).map((c: any) => [c.id, c]));

  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));

  const { data: items } = await supabase.from("handoff_items").select("handoff_id,id,done");
  const itemList = new Map<string, any[]>();
  for (const it of (items || []) as any[]) {
    const list = itemList.get(it.handoff_id) || [];
    list.push(it);
    itemList.set(it.handoff_id, list);
  }

  const { data: enrData } = await supabase.from("enrollments").select("customer_id,diploma_id");
  const { data: dipData } = await supabase.from("diplomas").select("id,name_ar");
  const dNameMap = new Map((dipData || []).map((d: any) => [d.id, d.name_ar]));
  const custDips = new Map<string, string[]>();
  for (const enr of (enrData || []) as any[]) {
    const list = custDips.get(enr.customer_id) || [];
    const dn = dNameMap.get(enr.diploma_id);
    if (dn && !list.includes(dn)) list.push(dn);
    custDips.set(enr.customer_id, list);
  }

  function fmtDate(d: string) {
    try { return new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }); } catch { return d; }
  }

  const initials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("onboarding")}</h1>
          <p>{(rows || []).length} في الانتظار</p>
        </div>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="empty"><b>لا توجد طلبات تفعيل معلّقة</b></div>
      ) : (
        <div className="onb-grid">
          {(rows || []).map((h: any) => {
            const customer = cMap.get(h.customer_id) || {};
            const custName = customer.name || "—";
            const custPhone = customer.phone1 || "";
            const stage = customer.stage || "";
            const dips = custDips.get(h.customer_id) || [];
            const hItems = itemList.get(h.id) || [];
            const done = hItems.filter((it: any) => it.done).length;
            const total = hItems.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={h.id} className="onb-card">
                <div className="oh">
                  <div className="av" style={{ background: "var(--brand)", width: 44, height: 44, fontSize: 16 }}>{initials(custName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{custName}</div>
                    {custPhone && <div style={{ fontSize: 12.5, color: "var(--muted)", direction: "ltr", textAlign: "start" }}>{custPhone}</div>}
                    <div style={{ marginTop: 4 }}>
                      <span className="chip">{stage === "enrolled" ? "مسجّل / دفع" : stage}</span>
                    </div>
                  </div>
                </div>
                <div className="ob">
                  {dips.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                      {dips.map((d: string) => <span key={d} className="chip">{d}</span>)}
                    </div>
                  )}
                  {h.note && <div className="onb-note" style={{ marginBottom: 10 }}>📝 {h.note}</div>}
                  {total > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                        <span style={{ fontWeight: 700 }}>التفعيل</span>
                        <span className="num">{done}/{total}</span>
                      </div>
                      <div className="prog" style={{ marginBottom: 10 }}>
                        <i style={{ width: pct + "%", background: pct === 100 ? "var(--green)" : "var(--brand)" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                        {hItems.map((it: any) => (
                          <div key={it.id} className={`task ${it.done ? "done" : ""}`} style={{ padding: "7px 10px" }}>
                            <div className={`cb ${it.done ? "on" : ""}`}>
                              {it.done && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
                            </div>
                            <div className="tt" style={{ fontSize: 12.5 }}>بند {hItems.indexOf(it) + 1}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    {custPhone && (
                      <a href={`https://wa.me/${custPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="btn wa sm">واتساب</a>
                    )}
                    <Link href={`/customers/${h.customer_id}`} className="btn sm">{tr("profile")}</Link>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
                    {pMap.get(h.assignee_id || "") ? `المسؤول: ${pMap.get(h.assignee_id)}` : ""}
                    {h.created_at ? ` · ${fmtDate(h.created_at)}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
