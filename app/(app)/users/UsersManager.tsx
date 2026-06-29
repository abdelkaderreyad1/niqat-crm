"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Profile = { id: string; full_name: string | null; team: string | null; [k: string]: any };

const TEAMS: [string, string][] = [
  ["admin", "الإدارة"], ["sales", "فريق المبيعات"], ["support", "فريق الدعم"], ["ops", "العمليات"],
];
const PERMS: [string, string][] = [
  ["can_edit_customers", "تعديل العملاء"],
  ["can_see_finance", "رؤية المالية / الأسعار"],
  ["can_view_reports", "رؤية التقارير"],
  ["can_manage_tickets", "إدارة الدعم"],
  ["can_manage_batches", "إدارة الباتشات"],
  ["can_grant_access", "تفعيل الأكسس"],
  ["can_message", "إرسال واتساب"],
  ["can_export", "تصدير البيانات"],
  ["can_manage_settings", "إدارة الإعدادات"],
  ["can_manage_users", "إدارة المستخدمين"],
];
const PRESET: Record<string, string[]> = {
  sales: ["can_edit_customers", "can_message", "can_view_reports"],
  support: ["can_manage_tickets", "can_grant_access", "can_message"],
  admin: PERMS.map((p) => p[0]),
  ops: ["can_edit_customers", "can_view_reports", "can_manage_batches", "can_message"],
};
const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
const avc = (id: string) => { let h = 0; for (const ch of id || "") h += ch.charCodeAt(0); return AV[h % AV.length]; };
const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)); };

export default function UsersManager({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [busy, setBusy] = useState<string | null>(null);

  // إضافة عضو
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", password: "", team: "sales" });
  const [perms, setPerms] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}; PRESET.sales.forEach((k) => (o[k] = true)); return o;
  });
  const [adding, setAdding] = useState(false);

  async function toggle(p: Profile, col: string) {
    if (p.team === "admin") { toast("المدير العام كل صلاحياته مفعّلة"); return; }
    const cur = !!p[col]; const key = p.id + col;
    setBusy(key);
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [col]: !cur } : r)));
    const { error } = await supabase.from("profiles").update({ [col]: !cur }).eq("id", p.id);
    setBusy(null);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [col]: cur } : r)));
      toast("تعذّر التحديث");
    } else toast("تم الحفظ");
  }

  function pickTeam(team: string) {
    setF((s) => ({ ...s, team }));
    const o: Record<string, boolean> = {}; (PRESET[team] || []).forEach((k) => (o[k] = true)); setPerms(o);
  }

  async function addMember() {
    if (!f.full_name.trim()) return toast("اكتب اسم العضو");
    if (!f.email.trim()) return toast("اكتب الإيميل");
    if (f.password.length < 6) return toast("كلمة السر 6 حروف على الأقل");
    setAdding(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, perms }),
      });
      const data = await res.json();
      setAdding(false);
      if (!res.ok) return toast(data.error || "حصل خطأ");
      toast(`تم إضافة ${f.full_name} ✓`);
      setF({ full_name: "", email: "", password: "", team: "sales" });
      const o: Record<string, boolean> = {}; PRESET.sales.forEach((k) => (o[k] = true)); setPerms(o);
      setOpen(false); router.refresh();
    } catch { setAdding(false); toast("تعذّر الاتصال بالسيرفر"); }
  }

  const card = (u: Profile) => (
    <div key={u.id} className="ucard">
      <div className="ucard-h">
        <div className="av" style={{ background: avc(u.id) }}>{ini(u.full_name || "?")}</div>
        <div>
          <b style={{ fontSize: 15, color: "var(--ink)" }}>{u.full_name || "—"}</b>{" "}
          <span className="uteam">{(TEAMS.find((t) => t[0] === u.team) || [, u.team])[1]}</span>
        </div>
      </div>
      {u.team === "admin" ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>المدير العام — كل الصلاحيات مفعّلة</div>
      ) : (
        PERMS.map(([k, lbl]) => (
          <div key={k} className="permrow" style={{ opacity: busy === u.id + k ? 0.5 : 1 }}>
            <span>{lbl}</span>
            <div className={"sw" + (u[k] ? " on" : "")} onClick={() => busy !== u.id + k && toggle(u, k)}><i /></div>
          </div>
        ))
      )}
    </div>
  );

  const grp = (title: string, team: string) => {
    const list = rows.filter((u) => u.team === team);
    if (!list.length) return null;
    return (<div key={team}><div className="sec-t">{title}</div>{list.map(card)}</div>);
  };

  return (
    <div>
      {!open ? (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setOpen(true)} className="btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            إضافة عضو جديد
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="sec-t" style={{ margin: 0 }}>إضافة عضو جديد</div>
            <button onClick={() => setOpen(false)} style={{ background: "none", color: "var(--muted)", fontSize: 13 }}>إغلاق</button>
          </div>
          <div className="frow">
            <div className="fld"><label>الاسم</label>
              <input className="inp" value={f.full_name} onChange={(e) => setF((s) => ({ ...s, full_name: e.target.value }))} /></div>
            <div className="fld"><label>الفريق</label>
              <select className="inp" value={f.team} onChange={(e) => pickTeam(e.target.value)}>
                {TEAMS.map((t) => <option key={t[0]} value={t[0]}>{t[1]}</option>)}
              </select></div>
          </div>
          <div className="frow">
            <div className="fld"><label>الإيميل</label>
              <input className="inp num" dir="ltr" type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} placeholder="name@niqat.com" /></div>
            <div className="fld"><label>كلمة سر مبدئية</label>
              <input className="inp num" dir="ltr" value={f.password} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} placeholder="6 حروف على الأقل" /></div>
          </div>
          <div className="sec-t">الصلاحيات</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 10, marginBottom: 12 }}>
            {PERMS.map(([k, lbl]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{lbl}</span>
                <div className={"sw" + (perms[k] ? " on" : "")} onClick={() => setPerms((p) => ({ ...p, [k]: !p[k] }))}><i /></div>
              </div>
            ))}
          </div>
          <button onClick={addMember} disabled={adding} className="btn">{adding ? "بيتعمل..." : "إنشاء الحساب"}</button>
        </div>
      )}

      {grp("الإدارة", "admin")}
      {grp("فريق المبيعات", "sales")}
      {grp("فريق الدعم", "support")}
      {grp("العمليات", "ops")}
    </div>
  );
}
