import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "#2F6BFF" },
  contacted: { label: "تم التواصل", color: "#0FA3A3" },
  interested: { label: "مهتم", color: "#7B61FF" },
  negotiation: { label: "تفاوض", color: "#F08A24" },
  enrolled: { label: "مسجّل / دفع", color: "#18A957" },
  onhold: { label: "معلّق", color: "#E6A700" },
  lost: { label: "مؤجل / مرفوض", color: "#94A2BB" },
};

export default async function Customers() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("customers")
    .select("id,name,phone1,email,company,stage,owner_id")
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  const { data: enr } = await supabase
    .from("enrollments")
    .select("customer_id, diplomas(name_ar)")
    .order("enrolled_at", { ascending: true });
  const dip = new Map<string, string>();
  for (const e of enr || []) {
    const cid = (e as any).customer_id as string;
    const nm = (e as any).diplomas?.name_ar as string | undefined;
    if (cid && nm && !dip.has(cid)) dip.set(cid, nm);
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>العملاء</h1>
          <p>{(rows || []).length} عميل</p>
        </div>
        <Link className="btn" href="/customers/new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          إضافة عميل
        </Link>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الدبلومة</th>
              <th>الموبايل</th>
              <th>المرحلة</th>
              <th>المسؤول</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => {
              const st = STAGES[r.stage as string] || STAGES.new;
              return (
                <tr key={r.id as string}>
                  <td>
                    <Link href={`/customers/${r.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                      <div className="cust-name">{r.name}</div>
                    </Link>
                    <div className="cust-sub" dir="ltr">{r.email || r.phone1 || ""}</div>
                  </td>
                  <td>{dip.get(r.id as string) || "—"}</td>
                  <td className="num" dir="ltr">{r.phone1 || "—"}</td>
                  <td>
                    <span className="stg" style={{ background: st.color + "1a", color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td>{pName.get(r.owner_id || "") || "غير معيّن"}</td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                  لا يوجد عملاء بعد — اضغط «إضافة عميل».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
