"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cust = { id: string; name: string };

const PRIOS = [
  { key: "high", label: "عالية" },
  { key: "medium", label: "متوسطة" },
  { key: "low", label: "منخفضة" },
];

export default function NewTicketForm({
  customers,
  presetCustomer,
}: {
  customers: Cust[];
  presetCustomer: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [customerId, setCustomerId] = useState(presetCustomer || "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const locked = !!presetCustomer;
  const lbl = "block text-xs font-bold text-muted mb-1";
  const inp = "w-full border border-line rounded-lg px-3 py-2 text-sm";

  async function create() {
    setErr("");
    if (!customerId) {
      setErr("اختر العميل أولاً.");
      return;
    }
    if (!title.trim()) {
      setErr("اكتب موضوع التذكرة.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        customer_id: customerId,
        title: title.trim(),
        priority,
        status: "open",
        archived: false,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setErr("تعذّر إنشاء التذكرة: " + error.message);
      return;
    }
    router.push(`/support/${data!.id}`);
  }

  return (
    <div className="bg-white rounded-xl border border-line p-4 space-y-3">
      <div>
        <label className={lbl}>العميل</label>
        <select
          className={inp + (locked ? " bg-gray-50" : "")}
          value={customerId}
          disabled={locked}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">— اختر العميل —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={lbl}>الموضوع</label>
        <input
          className={inp}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: مشكلة في الدخول على المنصة"
        />
      </div>

      <div>
        <label className={lbl}>الأولوية</label>
        <select className={inp} value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIOS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {err && <div className="text-xs text-red-600">{err}</div>}

      <button
        onClick={create}
        disabled={saving}
        className="bg-brand text-white rounded-lg px-5 py-2 text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
      >
        {saving ? "جاري الإنشاء…" : "إنشاء التذكرة"}
      </button>
    </div>
  );
}
