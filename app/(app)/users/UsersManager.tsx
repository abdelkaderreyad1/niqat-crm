"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Profile = { id: string; full_name: string | null; team: string | null; [k: string]: any };

const TEAMS: [string, string][] = [
  ["admin", "teamAdmin"], ["sales", "teamSales"], ["support", "teamSupport"], ["ops", "teamOps"],
];
const PERMS: [string, string][] = [
  ["can_edit_customers", "permEditCustomers"],
  ["can_see_finance", "permSeeFinance"],
  ["can_view_reports", "permViewReports"],
  ["can_manage_tickets", "permManageTickets"],
  ["can_manage_batches", "permManageBatches"],
  ["can_grant_access", "permGrantAccess"],
  ["can_message", "permMessage"],
  ["can_export", "permExport"],
  ["can_manage_settings", "permManageSettings"],
  ["can_manage_users", "permManageUsers"],
  ["can_see_daily_sales", "permSeeDailySales"],
];
const PRESET: Record<string, string[]> = {
  sales: ["can_edit_customers", "can_message", "can_view_reports"],
  support: ["can_manage_tickets", "can_grant_access", "can_message"],
  admin: PERMS.map((p) => p[0]),
  ops: ["can_edit_customers", "can_view_reports", "can_manage_batches", "can_message"],
};
// أوبشنز الذكاء الاصطناعي — كل واحد صلاحية مستقلة لكل مستخدم (تبدأ كلها مقفولة)
const AI_OPTIONS: [string, string][] = [
  ["top_diplomas", "aiOptTopDiplomas"],
  ["peak_hours", "aiOptPeakHours"],
  ["batches_filling", "aiOptBatchesFilling"],
  ["stale_leads", "aiOptStaleLeads"],
  ["collection_trend", "aiOptCollectionTrend"],
];
const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
const avc = (id: string) => { let h = 0; for (const ch of id || "") h += ch.charCodeAt(0); return AV[h % AV.length]; };
const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)); };

export default function UsersManager({ profiles }: { profiles: Profile[] }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [openTeams, setOpenTeams] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // إضافة عضو
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", team: "sales" });
  const [perms, setPerms] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}; PRESET.sales.forEach((k) => (o[k] = true)); return o;
  });
  const [adding, setAdding] = useState(false);
  // الذكاء الاصطناعي في فورم الإضافة (يبدأ مقفول + كل الأوبشنز مقفولة)
  const [newAi, setNewAi] = useState(false);
  const [newAiOpts, setNewAiOpts] = useState<Record<string, boolean>>({});
  const [newAiOpen, setNewAiOpen] = useState(false); // قايمة أوبشنز الفورم مطوية افتراضياً
  const [aiListOpen, setAiListOpen] = useState<Record<string, boolean>>({}); // أي كارت مفتوحة أوبشنزه

  // تعديل / حذف عضو
  const [editId, setEditId] = useState<string | null>(null);
  const [ef, setEf] = useState({ full_name: "", phone: "", email: "" });
  function startEdit(u: Profile) {
    setPwId(null);
    setEditId(u.id); setEf({ full_name: u.full_name || "", phone: u.phone || "", email: u.email || "" });
  }

  // إعادة تعيين كلمة السر → بإرسال إيميل استعادة للمستخدم (يحط الباسورد بنفسه)
  const [pwId, setPwId] = useState<string | null>(null);
  function startPw(u: Profile) {
    setEditId(null);
    setPwId(pwId === u.id ? null : u.id);
  }
  async function sendReset(u: Profile) {
    if (!u.email) return toast(tr("noEmailForUser"));
    setBusy(u.id + "pw");
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${origin}/reset-password` });
    setBusy(null);
    if (error) return toast(error.message);
    setPwId(null);
    toast(`${tr("resetLinkSent")} ${u.email} ✓`);
  }
  async function saveEdit(u: Profile) {
    setBusy(u.id + "edit");
    const res = await fetch("/api/team", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, full_name: ef.full_name, phone: ef.phone, email: ef.email }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(j.error || tr("editFailed"));
    setRows((rs) => rs.map((x) => (x.id === u.id ? { ...x, full_name: ef.full_name, phone: ef.phone, email: ef.email } : x)));
    setEditId(null); toast(tr("edited"));
  }
  async function removeUser(u: Profile) {
    if (!confirm(`${tr("confirmDeleteMember")} ${u.full_name || tr("member")}?`)) return;
    setBusy(u.id + "del");
    const res = await fetch("/api/team", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(j.error || tr("deleteFailed"));
    setRows((rs) => rs.filter((x) => x.id !== u.id)); toast(tr("deletedM"));
  }

  async function toggle(p: Profile, col: string) {
    if (p.team === "admin") { toast(tr("adminAllPerms")); return; }
    const cur = !!p[col]; const key = p.id + col;
    setBusy(key);
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [col]: !cur } : r)));
    const { error } = await supabase.from("profiles").update({ [col]: !cur }).eq("id", p.id);
    setBusy(null);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [col]: cur } : r)));
      toast(tr("updateFailedShort"));
    } else toast(tr("saved2"));
  }

  // تفعيل/قفل الذكاء الاصطناعي الرئيسي (بيشتغل للأدمن كمان)
  async function toggleAi(p: Profile) {
    const cur = !!p.can_use_ai; const key = p.id + "canai";
    setBusy(key);
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, can_use_ai: !cur } : r)));
    const { error } = await supabase.from("profiles").update({ can_use_ai: !cur }).eq("id", p.id);
    setBusy(null);
    if (error) { setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, can_use_ai: cur } : r))); toast(tr("updateFailedShort")); }
    else toast(tr("saved2"));
  }
  // تفعيل/قفل أوبشن واحد من الذكاء الاصطناعي (متخزّن في ai_options JSONB)
  async function toggleAiOption(p: Profile, optKey: string) {
    const curOpts = (p.ai_options && typeof p.ai_options === "object") ? p.ai_options : {};
    const next = { ...curOpts, [optKey]: !curOpts[optKey] };
    const key = p.id + "aiopt" + optKey;
    setBusy(key);
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, ai_options: next } : r)));
    const { error } = await supabase.from("profiles").update({ ai_options: next }).eq("id", p.id);
    setBusy(null);
    if (error) { setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, ai_options: curOpts } : r))); toast(tr("updateFailedShort")); }
    else toast(tr("saved2"));
  }

  function pickTeam(team: string) {
    setF((s) => ({ ...s, team }));    const o: Record<string, boolean> = {}; (PRESET[team] || []).forEach((k) => (o[k] = true)); setPerms(o);
  }

  async function addMember() {
    if (!f.full_name.trim()) return toast(tr("enterMemberName"));
    if (!f.email.trim()) return toast(tr("enterEmail"));
    setAdding(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, perms, can_use_ai: newAi, ai_options: newAi ? newAiOpts : {} }),
      });
      const data = await res.json();
      setAdding(false);
      if (!res.ok) return toast(data.error || tr("errorOccurredShort"));
      toast(`${tr("inviteSent")} ${f.email} ✓`);
      setF({ full_name: "", email: "", team: "sales" });
      const o: Record<string, boolean> = {}; PRESET.sales.forEach((k) => (o[k] = true)); setPerms(o);
      setNewAi(false); setNewAiOpts({});
      setOpen(false); router.refresh();
    } catch { setAdding(false); toast(tr("serverConnFailed")); }
  }

  const card = (u: Profile) => (
    <div key={u.id} className="ucard">
      <div className="ucard-h">
        <div className="av" style={{ background: avc(u.id) }}>{ini(u.full_name || "?")}</div>
        <div>
          <b style={{ fontSize: 16.5, fontWeight: 800, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".2px" }}>{u.full_name || "—"}</b>{" "}
          <span className="uteam">{tr((TEAMS.find((t) => t[0] === u.team) || [, u.team])[1] as string)}</span>
          {u.phone && <div style={{ fontSize: 12, color: "var(--muted)" }} className="num" dir="ltr">{u.phone}</div>}
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => (editId === u.id ? setEditId(null) : startEdit(u))} style={{ background: "none", border: "none", color: "var(--brand)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{tr("edit")}</button>
          <button onClick={() => startPw(u)} style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{tr("resetPassword")}</button>
          <button onClick={() => removeUser(u)} disabled={busy === u.id + "del"} style={{ background: "none", border: "none", color: "#E0483B", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{tr("delete")}</button>
        </div>
      </div>
      {editId === u.id && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0", padding: 10, border: "1px dashed var(--brand)", borderRadius: 8 }}>
          <input className="inp" placeholder={tr("name")} value={ef.full_name} onChange={(e) => setEf((s) => ({ ...s, full_name: e.target.value }))} />
          <input className="inp num" dir="ltr" placeholder={tr("phoneNumber")} value={ef.phone} onChange={(e) => setEf((s) => ({ ...s, phone: e.target.value }))} />
          <input className="inp num" dir="ltr" type="email" placeholder={tr("email")} value={ef.email} onChange={(e) => setEf((s) => ({ ...s, email: e.target.value }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => saveEdit(u)} disabled={busy === u.id + "edit"} style={{ height: 36 }}>{busy === u.id + "edit" ? "..." : tr("save")}</button>
            <button className="btn ghost" onClick={() => setEditId(null)} style={{ height: 36 }}>{tr("cancel")}</button>
          </div>
        </div>
      )}
      {pwId === u.id && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0", padding: 10, border: "1px dashed var(--blue)", borderRadius: 8 }}>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{tr("resetByEmailHint")}</p>
          {u.email
            ? <div style={{ fontSize: 12.5, color: "var(--ink)" }} className="num" dir="ltr">{u.email}</div>
            : <div style={{ fontSize: 12.5, color: "var(--red)" }}>{tr("noEmailForUser")}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => sendReset(u)} disabled={busy === u.id + "pw" || !u.email} style={{ height: 36 }}>{busy === u.id + "pw" ? "..." : tr("sendResetLink")}</button>
            <button className="btn ghost" onClick={() => setPwId(null)} style={{ height: 36 }}>{tr("cancel")}</button>
          </div>
        </div>
      )}
      {u.team === "admin" ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("adminAllPermsLabel")}</div>
      ) : (
        <div className="permgrid">
          {PERMS.map(([k, lbl]) => (
            <div key={k} className={"permcard" + (u[k] ? " on" : "")} onClick={() => busy !== u.id + k && toggle(u, k)}
              style={{ opacity: busy === u.id + k ? 0.5 : 1, cursor: "pointer" }}>
              <span>{tr(lbl)}</span>
              <div className={"sw" + (u[k] ? " on" : "")}><i /></div>
            </div>
          ))}
        </div>
      )}

      {/* قسم الذكاء الاصطناعي — لكل المستخدمين (بما فيهم الأدمن) */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
        <div className="permrow" style={{ opacity: busy === u.id + "canai" ? 0.5 : 1 }}>
          <span style={{ fontWeight: 800, color: "var(--ai, #7B61FF)" }}>✨ {tr("aiMaster")}</span>
          <div className={"sw" + (u.can_use_ai ? " on" : "")} onClick={() => busy !== u.id + "canai" && toggleAi(u)}><i /></div>
        </div>
        {u.can_use_ai && (
          <div style={{ marginTop: 6, paddingInlineStart: 12, borderInlineStart: "2px solid var(--line)" }}>
            <button
              onClick={() => setAiListOpen((s) => ({ ...s, [u.id]: !s[u.id] }))}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "var(--muted)", fontSize: 12.5, fontWeight: 700 }}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.6}
                style={{ transform: aiListOpen[u.id] ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="m9 6 6 6-6 6" /></svg>
              {tr("aiOptionsBtn")}
            </button>
            {aiListOpen[u.id] && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "6px 0" }}>{tr("aiOptionsHint")}</div>
                <div className="permgrid">
                  {AI_OPTIONS.map(([ok, lbl]) => {
                    const on = !!(u.ai_options && u.ai_options[ok]);
                    const bid = u.id + "aiopt" + ok;
                    return (
                      <div key={ok} className={"permcard" + (on ? " on" : "")} onClick={() => busy !== bid && toggleAiOption(u, ok)}
                        style={{ opacity: busy === bid ? 0.5 : 1, cursor: "pointer" }}>
                        <span>{tr(lbl)}</span>
                        <div className={"sw" + (on ? " on" : "")}><i /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const grp = (title: string, team: string) => {
    const list = rows.filter((u) => u.team === team);
    if (!list.length) return null;
    const isOpen = !!openTeams[team];
    return (
      <div key={team} className="card" style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
        <button
          onClick={() => setOpenTeams((s) => ({ ...s, [team]: !s[team] }))}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4}
            style={{ color: "var(--muted)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink)" }}>{title}</span>
          <span className="uteam" style={{ background: "var(--brand-soft)", color: "var(--brand-d)" }}>{list.length}</span>
        </button>
        {isOpen && <div className="usergrid" style={{ padding: "0 18px 4px" }}>{list.map(card)}</div>}
      </div>
    );
  };

  return (
    <div>
      {!open ? (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setOpen(true)} className="btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            {tr("addNewMember")}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="sec-t" style={{ margin: 0 }}>{tr("addNewMember")}</div>
            <button onClick={() => setOpen(false)} style={{ background: "none", color: "var(--muted)", fontSize: 13 }}>{tr("close")}</button>
          </div>
          <div className="frow">
            <div className="fld"><label>{tr("name")}</label>
              <input className="inp" value={f.full_name} onChange={(e) => setF((s) => ({ ...s, full_name: e.target.value }))} /></div>
            <div className="fld"><label>{tr("team")}</label>
              <select className="inp" value={f.team} onChange={(e) => pickTeam(e.target.value)}>
                {TEAMS.map((t) => <option key={t[0]} value={t[0]}>{tr(t[1])}</option>)}
              </select></div>
          </div>
          <div className="frow">
            <div className="fld"><label>{tr("email")}</label>
              <input className="inp num" dir="ltr" type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} placeholder="name@niqat.com" /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--brand-soft)", border: "1px solid #f6d6b0", borderRadius: 10, padding: "10px 12px", marginBottom: 4, fontSize: 12.5, color: "var(--brand-d)" }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2 6h20v12H2z" /><path d="m22 6-10 7L2 6" /></svg>
            {tr("inviteNote")}
          </div>
          <div className="sec-t">{tr("permissions")}</div>
          <div className="permgrid" style={{ marginBottom: 12 }}>
            {PERMS.map(([k, lbl]) => (
              <div key={k} className={"permcard" + (perms[k] ? " on" : "")} onClick={() => setPerms((p) => ({ ...p, [k]: !p[k] }))} style={{ cursor: "pointer" }}>
                <span>{tr(lbl)}</span>
                <div className={"sw" + (perms[k] ? " on" : "")}><i /></div>
              </div>
            ))}
          </div>
          {/* الذكاء الاصطناعي */}
          <div style={{ marginTop: 4, marginBottom: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ai, #7B61FF)" }}>✨ {tr("aiMaster")}</span>
              <div className={"sw" + (newAi ? " on" : "")} onClick={() => { setNewAi((v) => !v); if (newAi) setNewAiOpen(false); }}><i /></div>
            </div>
            {newAi && (
              <div style={{ marginTop: 6, paddingInlineStart: 12, borderInlineStart: "2px solid var(--line)" }}>
                <button type="button"
                  onClick={() => setNewAiOpen((v) => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "var(--muted)", fontSize: 12.5, fontWeight: 700 }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.6}
                    style={{ transform: newAiOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="m9 6 6 6-6 6" /></svg>
                  {tr("aiOptionsBtn")}
                </button>
                {newAiOpen && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "6px 0" }}>{tr("aiOptionsHint")}</div>
                    <div className="permgrid">
                      {AI_OPTIONS.map(([ok, lbl]) => (
                        <div key={ok} className={"permcard" + (newAiOpts[ok] ? " on" : "")} onClick={() => setNewAiOpts((p) => ({ ...p, [ok]: !p[ok] }))} style={{ cursor: "pointer" }}>
                          <span>{tr(lbl)}</span>
                          <div className={"sw" + (newAiOpts[ok] ? " on" : "")}><i /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={addMember} disabled={adding} className="btn">{adding ? tr("sending") : tr("sendInvite")}</button>        </div>
      )}

      {grp(tr("teamAdmin"), "admin")}
      {grp(tr("teamSales"), "sales")}
      {grp(tr("teamSupport"), "support")}
      {grp(tr("teamOps"), "ops")}
    </div>
  );
}
