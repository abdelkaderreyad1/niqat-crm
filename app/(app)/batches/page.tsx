import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
export const dynamic = "force-dynamic";

export default async function Batches() {
  const supabase = createClient();
  const { data: batches } = await supabase
    .from("batches")
    .select("id,code,status,start_date,capacity,notes")
    .order("created_at", { ascending: false });

  const { data: enr } = await supabase.from("enrollments").select("batch_id");
  const cnt = new Map<string, number>();
  for (const e of enr || []) {
    const b = (e as any).batch_id as string;
    if (b) cnt.set(b, (cnt.get(b) || 0) + 1);
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("batches")}</h1>
          <p>{(batches || []).length} باتش</p>
        </div>
      </div>
      <div className="bgrid">
        {(batches || []).map((b) => {
          const seats = Number(b.capacity) || 0;
          const en = cnt.get(b.id as string) || 0;
          const pct = seats ? Math.min(100, Math.round((en / seats) * 100)) : 0;
          const full = b.status === "full" || b.status === "closed";
          const c = full ? "#94A2BB" : "#18A957";
          return (
            <div key={b.id as string} className="bcard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div className="bcode">{b.code}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{b.notes || ""}</div>
                </div>
                <span className="stg" style={{ background: c + "1a", color: c }}>
                  {full ? "مكتمل" : "مفتوح"}
                </span>
              </div>
              <div style={{ margin: "14px 0 6px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "var(--muted)" }}>المقاعد</span>
                <b className="num">{en}/{seats || "—"}</b>
              </div>
              <div className="bbar"><i style={{ width: pct + "%" }} /></div>
              <div style={{ marginTop: 14 }}>
                <div className="brow"><span>تاريخ البدء</span><b className="num">{b.start_date ? String(b.start_date).slice(0, 10) : "—"}</b></div>
                <div className="brow"><span>الحالة</span><b>{b.status || "—"}</b></div>
              </div>
            </div>
          );
        })}
        {(!batches || batches.length === 0) && <div className="empty"><b>لا توجد باتشات</b></div>}
      </div>
    </div>
  );
}
