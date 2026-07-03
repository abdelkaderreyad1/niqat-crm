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
const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
const avc = (id: string) => { let h = 0; for (const ch of id || "") h += ch.charCodeAt(0); return AV[h % AV.length]; };
const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)); };

export default function UsersManager({ profiles }: { profiles: Profile[] }) {
  const tr = useT();
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

  // تعديل / حذف عضو
  const [editId, setEditId] = useState<string | null>(null);
  const [ef, setEf] = useState({ full_name: "", phone: "", email: "" });
  function startEdit(u: Profile) {
    setEditId(u.id); setEf({ full_name: u.full_name || "", phone: u.phone || "", email: u.email || "" });
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

  function pickTeam(team: string) {
    setF((s) => ({ ...s, team }));
    const o: Record<string, boolean> = {}; (PRESET[team] || []).forEach((k) => (o[k] = true)); setPerms(o);
  }

  async function addMember() {
    if (!f.full_name.trim()) return toast(tr("enterMemberName"));
    if (!f.email.trim()) return toast(tr("enterEmail"));
    if (f.password.length < 6) return toast(tr("passwordMin6"));
    setAdding(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, perms }),
      });
      const data = await res.json();
      setAdding(false);
      if (!res.ok) return toast(data.error || tr("errorOccurredShort"));
      toast(`${tr("memberAdded")} ${f.full_name} ✓`);
      setF({ full_name: "", email: "", password: "", team: "sales" });
      const o: Record<string, boolean> = {}; PRESET.sales.forEach((k) => (o[k] = true)); setPerms(o);
      setOpen(false); router.refresh();
    } catch { setAdding(false); toast(tr("serverConnFailed")); }
  }

  const card = (u: Profile) => (
    <div key={u.id} className="ucard">
      <div className="ucard-h">
        <div className="av" style={{ background: avc(u.id) }}>{ini(u.full_name || "?")}</div>
        <div>
          <b style={{ fontSize: 15, color: "var(--ink)" }}>{u.full_name || "—"}</b>{" "}
          <span className="uteam">{tr((TEAMS.find((t) => t[0] === u.team) || [, u.team])[1] as string)}</span>
          {u.phone && <div style={{ fontSize: 12, color: "var(--muted)" }} className="num" dir="ltr">{u.phone}</div>}
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => (editId === u.id ? setEditId(null) : startEdit(u))} style={{ background: "none", border: "none", color: "var(--brand)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{tr("edit")}</button>
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
      {u.team === "admin" ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("adminAllPermsLabel")}</div>
      ) : (
        PERMS.map(([k, lbl]) => (
          <div key={k} className="permrow" style={{ opacity: busy === u.id + k ? 0.5 : 1 }}>
            <span>{tr(lbl)}</span>
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
            <div className="fld"><label>{tr("initialPassword")}</label>
              <input className="inp num" dir="ltr" value={f.password} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} placeholder={tr("min6chars")} /></div>
          </div>
          <div className="sec-t">{tr("permissions")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 10, marginBottom: 12 }}>
            {PERMS.map(([k, lbl]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{tr(lbl)}</span>
                <div className={"sw" + (perms[k] ? " on" : "")} onClick={() => setPerms((p) => ({ ...p, [k]: !p[k] }))}><i /></div>
              </div>
            ))}
          </div>
          <button onClick={addMember} disabled={adding} className="btn">{adding ? tr("creating") : tr("createAccount")}</button>
        </div>
      )}

      {grp(tr("teamAdmin"), "admin")}
      {grp(tr("teamSales"), "sales")}
      {grp(tr("teamSupport"), "support")}
      {grp(tr("teamOps"), "ops")}
    </div>
  );
}
