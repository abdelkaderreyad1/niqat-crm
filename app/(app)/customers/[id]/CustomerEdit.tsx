"use client";
import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Spec = { id: string; name_ar: string };
type C = {
  id: string; name: string; phone1: string | null; phone2: string | null;
  email: string | null; company: string | null; residency: string | null;
  grad_year: number | null; stage: string; specialty_id: string | null;
  lms_status: string | null; source: string | null; affiliate_code: string | null; created_at: string;
  terms_signed?: boolean | null; terms_signed_at?: string | null;
};

const STAGES = [
  { key: "contacted", labelKey: "dashStageContacted" },
  { key: "interested", labelKey: "dashStageInterested" },
  { key: "enrolled", labelKey: "dashStageEnrolled" },
  { key: "lost", labelKey: "dashStageLost" },
];

export type CustomerEditHandle = { save: () => Promise<void> };

const inp = "inp";
const sel = "inp appearance-none cursor-pointer";
const lbl = "text-[11px] font-bold uppercase tracking-wider mb-2 block";
const lblStyle = { color: "var(--muted)" } as const;

const CustomerEdit = forwardRef<CustomerEditHandle, { customer: C; specialties: Spec[] }>(({ customer, specialties }, ref) => {
  const router = useRouter();
  const supabase = createClient();
  const tr = useT();
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [f, setF] = useState({
    name: customer.name || "", phone1: customer.phone1 || "", phone2: customer.phone2 || "",
    email: customer.email || "", company: customer.company || "", residency: customer.residency || "",
    grad_year: customer.grad_year ? String(customer.grad_year) : "",
    specialty_id: customer.specialty_id || "", stage: customer.stage || "interested",
    affiliate_code: customer.affiliate_code || "",
    source: customer.source || "", lms_status: customer.lms_status || "",
  });
  const [terms, setTerms] = useState(!!customer.terms_signed);
  const [termsAt, setTermsAt] = useState(customer.terms_signed_at || "");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const set = useCallback((k: string, v: string) => setF((s) => ({ ...s, [k]: v })), []);

  const toggleTerms = useCallback(async () => {
    const next = !terms;
    const at = next ? new Date().toISOString() : "";
    setTerms(next); setTermsAt(at);
    await supabase.from("customers").update({ terms_signed: next, terms_signed_at: at || null }).eq("id", customer.id);
  }, [terms, supabase, customer.id]);

  const save = useCallback(async () => {
    setErr(""); setMsg("");
    if (!f.name.trim()) { setErr(tr("nameRequired")); return; }
    if (/[\u0600-\u06FF]/.test(f.name)) { setErr(tr("nameEnglishOnly")); return; }
    const { error } = await supabase.from("customers").update({
      name: f.name.trim().toUpperCase(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim() || null, residency: f.residency.trim() || null,
      grad_year: f.grad_year ? Number(f.grad_year) : null,
      specialty_id: f.specialty_id || null, stage: f.stage,
      affiliate_code: f.affiliate_code.trim(), source: f.source.trim(), lms_status: f.lms_status,
    }).eq("id", customer.id);
    if (error) {
      setErr((error as any).code === "23505" ? tr("dupContact") : tr("errorOccurred") + error.message);
      return;
    }
    setMsg(tr("saved"));
    router.refresh();
  }, [f, supabase, customer.id, router]);

  useImperativeHandle(ref, () => ({ save }), [save]);

  const TabBtn = ({ val, label }: { val: string; label: string }) => (
    <button type="button" onClick={() => setActiveTab(val)}
      className={"pb-3 px-1 text-[13px] font-bold transition-all duration-150 border-b-2 " +
        (activeTab === val ? "border-orange-500 text-orange-500" : "border-transparent hover:opacity-80")}
      style={activeTab === val ? undefined : { color: "var(--muted)" }}>
      {label}
    </button>
  );

  const fld = "flex flex-col gap-1.5";
  const grid2 = "grid grid-cols-2 gap-4";

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex border-b border-gray-800 mb-6 gap-6">
        <TabBtn val="basic" label={tr("basicData")} />
        <TabBtn val="sales" label={tr("sales")} />
        <TabBtn val="terms" label={tr("terms")} />
      </div>

      <div className="flex-1 space-y-5">
        {activeTab === "basic" && (
          <>
            <div className={fld}>
              <label className={lbl} style={lblStyle}>{tr("name")} <span className="text-orange-400/50 font-normal">({tr("englishOnlyShort")})</span></label>
              <input className={inp} dir="ltr" value={f.name} placeholder="AHMED ALI"
                onChange={(e) => setF({...f, name: e.target.value.replace(/[^A-Za-z\s]/g, '').toUpperCase()})} />
            </div>
            <div className={fld}>
              <label className={lbl} style={lblStyle}>{tr("stage")}</label>
              <select className={sel} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{tr(s.labelKey)}</option>)}
              </select>
            </div>
            <div className={grid2}>
              <div className={fld}>
                <label className={lbl} style={lblStyle}>{tr("phone1")}</label>
                <input className={inp} dir="ltr" value={f.phone1} onChange={(e) => set("phone1", e.target.value)} />
              </div>
              <div className={fld}>
                <label className={lbl} style={lblStyle}>{tr("phone2")}</label>
                <input className={inp} dir="ltr" value={f.phone2} onChange={(e) => set("phone2", e.target.value)} />
              </div>
            </div>
            <div className={fld}>
              <label className={lbl} style={lblStyle}>{tr("email")}</label>
              <input className={inp} dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className={grid2}>
              <div className={fld}>
                <label className={lbl} style={lblStyle}>{tr("company")}</label>
                <input className={inp} value={f.company} onChange={(e) => set("company", e.target.value)} />
              </div>
              <div className={fld}>
                <label className={lbl} style={lblStyle}>{tr("residence")}</label>
                <input className={inp} value={f.residency} onChange={(e) => set("residency", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {activeTab === "sales" && (
          <>
            <div className={fld}>
              <label className={lbl} style={lblStyle}>{tr("engSpec")}</label>
              <select className={sel} value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
                <option value="">{tr("unselected")}</option>
                {specialties.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              </select>
            </div>
            <div className={grid2}>
              <div className={fld}>
                <label className={lbl} style={lblStyle}>{tr("gradYear")}</label>
                <input className={inp} dir="ltr" inputMode="numeric" value={f.grad_year}
                  onChange={(e) => set("grad_year", e.target.value)} />
              </div>
              <div className={fld}>
                <label className={lbl} style={lblStyle}>{tr("affiliateCode")}</label>
                <input className={inp} dir="ltr" value={f.affiliate_code} placeholder={tr("optional")}
                  onChange={(e) => set("affiliate_code", e.target.value)} />
              </div>
            </div>
            <div className={fld}>
              <label className={lbl} style={lblStyle}>{tr("source")}</label>
              <input className={inp} value={f.source} placeholder={tr("sourcePlaceholder")}
                onChange={(e) => set("source", e.target.value)} />
            </div>
            <div className={fld}>
              <label className={lbl} style={lblStyle}>{tr("lmsStatus")}</label>
              <select className={sel} value={f.lms_status} onChange={(e) => set("lms_status", e.target.value)}>
                <option value="">{tr("unselected")}</option>
                <option value="active">{tr("lmsActive")}</option>
                <option value="pending">{tr("lmsPending")}</option>
                <option value="none">{tr("lmsNone")}</option>
              </select>
            </div>
          </>
        )}

        {activeTab === "terms" && (
          <div className="flex items-center gap-4 p-5 rounded-xl" style={{ border: "1px solid var(--line)", background: terms ? "rgba(24,169,87,.08)" : "var(--muted-soft)" }}>
            <button type="button" onClick={toggleTerms}
              className={"relative w-[44px] h-[24px] rounded-full transition-colors flex-shrink-0 " +
                (terms ? "bg-orange-500" : "")}
              style={terms ? undefined : { background: "var(--line)" }}>
              <span className={"absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200 " +
                (terms ? "left-[23px]" : "left-[3px]")} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold" style={{ color: terms ? "var(--green)" : "var(--ink)" }}>
                {terms ? tr("termsSigned") : tr("termsNotSigned")}
              </div>
              {terms && termsAt && (
                <div className="text-[12px] mt-1 font-num" style={{ color: "var(--muted)" }}>
                  {String(termsAt).replace("T", " ").slice(0, 16)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {err && (
        <div className="mt-5 text-[13px] text-red-400 bg-red-400/10 rounded-lg px-4 py-2.5 border border-red-400/20">
          {err}
        </div>
      )}
      {msg && (
        <div className="mt-5 text-[13px] text-green-400 bg-green-400/10 rounded-lg px-4 py-2.5 border border-green-400/20">
          {msg}
        </div>
      )}

      <div className="sticky bottom-0 w-full backdrop-blur-md p-4 mt-auto" style={{ background: "var(--surface)", borderTop: "1px solid var(--line)" }}>
        <button onClick={save}
          className="w-full h-[46px] bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[14px] tracking-wide rounded-lg active:scale-[.98] transition-all duration-150 shadow-lg shadow-orange-500/20">
          {tr("saveEdits")}
        </button>
      </div>
    </div>
  );
});

CustomerEdit.displayName = "CustomerEdit";
export default CustomerEdit;
