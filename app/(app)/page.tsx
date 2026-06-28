import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

const STAGES = [
  { key: "new", label: "جديد", color: "#2F6BFF" },
  { key: "contacted", label: "تم التواصل", color: "#0FA3A3" },
  { key: "interested", label: "مهتم", color: "#7B61FF" },
  { key: "negotiation", label: "تفاوض", color: "#F08A24" },
  { key: "enrolled", label: "مسجّل / دفع", color: "#18A957" },
  { key: "onhold", label: "معلّق", color: "#E6A700" },
  { key: "lost", label: "مؤجل / مرفوض", color: "#94A2BB" },
];

export default async function Dashboard() {
  const supabase = createClient();
  const [cust, enr, tk, bt, stageRows] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("deleted", false),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("batches").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("stage").eq("deleted", false),
  ]);

  const byStage: Record<string, number> = {};
  for (const r of stageRows.data || []) byStage[(r as any).stage] = (byStage[(r as any).stage] || 0) + 1;
  const total = cust.count ?? 0;
  const enrolled = byStage["enrolled"] || 0;
  const conv = total ? Math.round((enrolled / total) * 100) : 0;

  const kpis = [
    { label: "إجمالي العملاء", value: total, color: "#2F6BFF" },
    { label: "مسجّل / دفع", value: enrolled, color: "#18A957" },
    { label: "نسبة التحويل", value: conv + "%", color: "#F08A24" },
    { label: "تذاكر مفتوحة", value: tk.count ?? 0, color: "#E0483B" },
    { label: "الاشتراكات", value: enr.count ?? 0, color: "#0FA3A3" },
    { label: "الباتشات", value: bt.count ?? 0, color: "#7B61FF" },
  ];

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>لوحة المعلومات</h1>
          <p>ملخّص حيّ من قاعدة البيانات</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: 18 }}>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}>{k.label}</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div className="sec-t">ملخّص مسار المبيعات</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {STAGES.map((s) => {
            const n = byStage[s.key] || 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 110, fontSize: 13, color: "var(--ink)", fontWeight: 700 }}>
                  <span className="dot" style={{ background: s.color, display: "inline-block", width: 9, height: 9, borderRadius: "50%", marginInlineEnd: 6 }} />
                  {s.label}
                </span>
                <div style={{ flex: 1, height: 10, background: "#eef2f8", borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ width: pct + "%", height: "100%", background: s.color }} />
                </div>
                <span className="num" style={{ width: 36, textAlign: "left", fontWeight: 700, color: "var(--muted)" }}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
