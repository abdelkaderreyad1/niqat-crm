"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  team: string | null;
  [k: string]: any;
};

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

function Toggle({
  on,
  busy,
  onClick,
}: {
  on: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        "relative w-10 h-5 rounded-full transition disabled:opacity-50 " +
        (on ? "bg-green" : "bg-line")
      }
      aria-pressed={on}
    >
      <span
        className={
          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all " +
          (on ? "right-0.5" : "right-[22px]")
        }
      />
    </button>
  );
}

export default function PermissionsManager({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(pid: string, col: string, current: boolean) {
    const key = pid + col;
    setBusy(key);
    setRows((rs) => rs.map((r) => (r.id === pid ? { ...r, [col]: !current } : r)));
    const { error } = await supabase
      .from("profiles")
      .update({ [col]: !current })
      .eq("id", pid);
    setBusy(null);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === pid ? { ...r, [col]: current } : r)));
      alert("تعذّر التحديث: " + error.message);
    }
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="bg-white rounded-xl border border-line p-6 text-center text-muted text-sm">
          لا يوجد أعضاء بعد.
        </div>
      )}

      {rows.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border border-line p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-extrabold text-ink">{p.full_name || "—"}</div>
            <span className="text-[11px] rounded-full px-2 py-0.5 font-bold bg-brand-soft text-brand">
              {p.team || "—"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {PERMS.map(([col, label]) => {
              const on = !!p[col];
              return (
                <div key={col} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">{label}</span>
                  <Toggle
                    on={on}
                    busy={busy === p.id + col}
                    onClick={() => toggle(p.id, col, on)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted">
        ملاحظة: الأعضاء بيظهروا هنا بعد ما يتعمل لهم حساب دخول. دلوقتي ظاهر حسابات الإدارة بس.
      </p>
    </div>
  );
}
