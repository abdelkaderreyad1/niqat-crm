"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TEAMS = [
  { key: "sales", label: "المبيعات" },
  { key: "support", label: "الدعم" },
  { key: "admin", label: "الإدارة" },
  { key: "ops", label: "العمليات" },
];

const PERMS: [string, string][] = [
  ["can_edit_customers", "تعديل العملاء"],
  ["can_see_finance", "رؤية المالية"],
  ["can_view_reports", "رؤية التقارير"],
  ["can_manage_tickets", "إدارة الدعم"],
  ["can_manage_batches", "إدارة الباتشات"],
  ["can_manage_settings", "إدارة الإعدادات"],
  ["can_manage_users", "إدارة المستخدمين"],
  ["can_grant_access", "منح صلاحية الدخول"],
  ["can_message", "إرسال واتساب"],
  ["can_export", "تصدير البيانات"],
];

// صلاحيات افتراضية حسب الفريق (تقدر تعدّلها قبل الحفظ)
const PRESET: Record<string, string[]> = {
  sales: ["can_edit_customers", "can_message", "can_view_reports"],
  support: ["can_manage_tickets", "can_grant_access", "can_message"],
  admin: PERMS.map((p) => p[0]),
  ops: ["can_edit_customers", "can_view_reports", "can_manage_batches", "can_message"],
};

export default function AddMemberForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", password: "", team: "sales" });
  const [perms, setPerms] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    PRESET.sales.forEach((k) => (o[k] = true));
    return o;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  function pickTeam(team: string) {
    set("team", team);
    const o: Record<string, boolean> = {};
    (PRESET[team] || []).forEach((k) => (o[k] = true));
    setPerms(o);
  }
  function togglePerm(k: string) {
    setPerms((p) => ({ ...p, [k]: !p[k] }));
  }

  async function submit() {
    setMsg(null);
    if (!f.full_name.trim()) return setMsg({ ok: false, text: "اكتب اسم العضو." });
    if (!f.email.trim()) return setMsg({ ok: false, text: "اكتب الإيميل." });
    if (f.password.length < 6) return setMsg({ ok: false, text: "كلمة السر لازم 6 حروف على الأقل." });
    setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, perms }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) return setMsg({ ok: false, text: data.error || "حصل خطأ." });
      setMsg({ ok: true, text: `تم إضافة ${f.full_name} ✓` });
      setF({ full_name: "", email: "", password: "", team: "sales" });
      const o: Record<string, boolean> = {}; PRESET.sales.forEach((k) => (o[k] = true)); setPerms(o);
      router.refresh();
    } catch {
      setBusy(false);
      setMsg({ ok: false, text: "تعذّر الاتصال بالسيرفر." });
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setOpen(true)} className="btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
          إضافة عضو جديد
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="sec-t" style={{ margin: 0 }}>إضافة عضو جديد</div>
        <button onClick={() => setOpen(false)} style={{ background: "none", color: "var(--muted)", fontSize: 13 }}>إغلاق</button>
      </div>

      <div className="frow">
        <div className="fld"><label>الاسم</label>
          <input className="inp" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
        <div className="fld"><label>الفريق</label>
          <select className="inp" value={f.team} onChange={(e) => pickTeam(e.target.value)}>
            {TEAMS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select></div>
      </div>
      <div className="frow">
        <div className="fld"><label>الإيميل</label>
          <input className="inp num" dir="ltr" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@niqat.com" /></div>
        <div className="fld"><label>كلمة سر مبدئية</label>
          <input className="inp num" dir="ltr" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="6 حروف على الأقل" /></div>
      </div>

      <div className="sec-t">الصلاحيات</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 10, marginBottom: 12 }}>
        {PERMS.map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 14, color: "var(--ink)" }}>{label}</span>
            <div className={"sw" + (perms[k] ? " on" : "")} onClick={() => togglePerm(k)}><i /></div>
          </div>
        ))}
      </div>

      {msg && <div style={{ color: msg.ok ? "var(--green)" : "var(--red)", fontSize: 13, marginBottom: 10 }}>{msg.text}</div>}

      <button onClick={submit} disabled={busy} className="btn">{busy ? "بيتعمل..." : "إنشاء الحساب"}</button>
    </div>
  );
}
