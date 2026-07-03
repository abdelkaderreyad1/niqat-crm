import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import AddBatch from "./AddBatch";
export const dynamic = "force-dynamic";

export default async function Batches() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meB } = await supabase.from("profiles").select("can_manage_batches").eq("id", user?.id || "").maybeSingle();
  const canManage = !!meB?.can_manage_batches;
  let batches: any[] = [];
  const bFull = await supabase.from("batches")
    .select("id,code,status,start_date,end_date,capacity,notes")
    .order("created_at", { ascending: false });
  if (bFull.error) {
    const bMin = await supabase.from("batches")
      .select("id,code,status,start_date,capacity,notes")
      .order("created_at", { ascending: false });
    batches = bMin.data || [];
  } else batches = bFull.data || [];

  // الدبلومة لكل باتش (دفاعي)
  const dMap = new Map<string, string>();
  const bd = await supabase.from("batches").select("id,diploma_id");
  const { data: allDips } = await supabase.from("diplomas").select("id,name_ar").order("name_ar");
  const dipName = new Map((allDips || []).map((d: any) => [d.id, d.name_ar]));
  if (!bd.error) for (const r of (bd.data as any[]) || []) if (r.diploma_id) dMap.set(r.id, dipName.get(r.diploma_id) || "");

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
          <p>{(batches || []).length} {tr("batchWord")}</p>
        </div>
        {canManage && <AddBatch diplomas={(allDips || []).map((d: any) => ({ id: d.id, name: d.name_ar }))} />}
      </div>
      <div className="bgrid">
        {(batches || []).map((b) => {
          const seats = Number(b.capacity) || 0;
          const en = cnt.get(b.id as string) || 0;
          const pct = seats ? Math.min(100, Math.round((en / seats) * 100)) : 0;
          const stt = b.status === "closed" ? { l: tr("batchEnded"), c: "#94A2BB" }
            : b.status === "full" ? { l: tr("batchFull"), c: "#E0483B" }
            : { l: tr("batchOpen"), c: "#18A957" };
          return (
            <div key={b.id as string} className="bcard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  {dMap.get(b.id as string) && <div style={{ color: "var(--brand)", fontSize: 12.5, fontWeight: 700 }}>{dMap.get(b.id as string)}</div>}
                  <div className="bcode">{b.code}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{b.notes || ""}</div>
                </div>
                <span className="stg" style={{ background: stt.c + "1a", color: stt.c }}>{stt.l}</span>
              </div>
              <div style={{ margin: "14px 0 6px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "var(--muted)" }}>{tr("seats")}</span>
                <b className="num">{en}/{seats || "—"}</b>
              </div>
              <div className="bbar"><i style={{ width: pct + "%" }} /></div>
              <div style={{ marginTop: 14 }}>
                <div className="brow"><span>{tr("startDate")}</span><b className="num">{b.start_date ? String(b.start_date).slice(0, 10) : "—"}</b></div>
                <div className="brow"><span>{tr("endDate")}</span><b className="num">{b.end_date ? String(b.end_date).slice(0, 10) : "—"}</b></div>
              </div>
            </div>
          );
        })}
        {(!batches || batches.length === 0) && <div className="empty"><b>{tr("noBatches")}</b></div>}
      </div>
    </div>
  );
}
