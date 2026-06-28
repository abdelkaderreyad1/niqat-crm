"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Aff = { name: string; code: string; discount: number };

export default function AffiliatesManager({ initial }: { initial: Aff[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [list, setList] = useState<Aff[]>(initial || []);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [disc, setDisc] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function persist(next: Aff[]) {
    setBusy(true);
    setSaved(false);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "affiliates", value: next, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      alert("تعذّر الحفظ: " + error.message);
      return false;
    }
    setSaved(true);
    router.refresh();
    return true;
  }

  async function add() {
    const c = code.trim().toUpperCase();
    if (!c) return alert("اكتب الكود.");
    if (list.some((a) => a.code.toUpperCase() === c)) return alert("الكود موجود بالفعل.");
    const d = Number(disc) || 0;
    const next = [...list, { name: name.trim() || "—", code: c, discount: d }];
    setList(next);
    setName("");
    setCode("");
    setDisc("");
    await persist(next);
  }

  async function changeDiscount(i: number, v: string) {
    const next = list.map((a, idx) => (idx === i ? { ...a, discount: Number(v) || 0 } : a));
    setList(next);
  }

  async function saveDiscounts() {
    await persist(list);
  }

  async function remove(i: number) {
    if (!confirm("تحذف الكود ده؟")) return;
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    await persist(next);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-line p-4">
        <div className="font-bold text-ink mb-3">إضافة كود جديد</div>
        <div className="flex flex-wrap gap-2">
          <input
            className="border border-line rounded-md px-2 py-1.5 text-sm flex-1 min-w-[120px]"
            placeholder="اسم الأفيلييت"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border border-line rounded-md px-2 py-1.5 text-sm w-32"
            placeholder="الكود"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="border border-line rounded-md px-2 py-1.5 text-sm w-24 num"
            placeholder="الخصم %"
            value={disc}
            onChange={(e) => setDisc(e.target.value)}
          />
          <button
            onClick={add}
            disabled={busy}
            className="bg-brand text-white text-sm font-bold rounded-md px-4 py-1.5 hover:bg-brand-dark disabled:opacity-50"
          >
            إضافة
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-line overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-brand-soft/50 text-muted text-xs">
            <tr>
              <th className="text-start px-4 py-3 font-bold">الكود</th>
              <th className="text-start px-4 py-3 font-bold">الاسم</th>
              <th className="text-start px-4 py-3 font-bold">الخصم %</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  لا توجد أكواد بعد.
                </td>
              </tr>
            )}
            {list.map((a, i) => (
              <tr key={a.code} className="border-t border-line">
                <td className="px-4 py-3 font-bold text-brand">{a.code}</td>
                <td className="px-4 py-3 text-ink">{a.name}</td>
                <td className="px-4 py-3">
                  <input
                    className="border border-line rounded-md px-2 py-1 text-sm w-20 num"
                    value={a.discount}
                    onChange={(e) => changeDiscount(i, e.target.value)}
                  />
                </td>
                <td className="px-4 py-3 text-end">
                  <button
                    onClick={() => remove(i)}
                    className="text-red text-xs font-bold hover:underline"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveDiscounts}
          disabled={busy}
          className="bg-ink text-white text-sm font-bold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          حفظ تعديلات الخصم
        </button>
        {saved && <span className="text-green text-sm font-bold">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}
