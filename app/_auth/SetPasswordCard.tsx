"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "invite" | "recovery";

export default function SetPasswordCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabaseRef = useRef<any>(null);
  const [lang, setLang] = useState<"ar" | "en">("en");
  const [ready, setReady] = useState(false);       // اتفعّل اللينك وفيه جلسة صالحة
  const [linkError, setLinkError] = useState("");   // اللينك منتهي/غلط
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    const supabase = supabaseRef.current;
    // صفحة الدعوة/الاستعادة إنجليزي دايماً (الموظف الجديد لسه مالوش تفضيل لغة)
    setLang("en");

    (async () => {
      try {
        // نعتمد فقط على التحقق من الجلسة اللي ملف الـ callback في السيرفر عملها
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) { 
          setReady(true); 
        } else {
          // لو مفيش جلسة، يبقى اللينك مش سليم أو المستخدم مادخلش صح
          setLinkError("expired");
        }
      } catch (e: any) { 
        setLinkError(e?.message || "error"); 
      }
    })();
  }, []);

  const T = {
    appSub: lang === "ar" ? "نظام إدارة العملاء" : "Customer Management System",
    title: mode === "invite"
      ? (lang === "ar" ? "أهلاً بيك — اختر كلمة السر" : "Welcome — set your password")
      : (lang === "ar" ? "تعيين كلمة سر جديدة" : "Set a new password"),
    sub: mode === "invite"
      ? (lang === "ar" ? "دي أول مرة تدخل — حدّد كلمة سر عشان تكمّل" : "First time in — choose a password to continue")
      : (lang === "ar" ? "اكتب كلمة السر الجديدة بتاعتك" : "Enter your new password"),
    pass: lang === "ar" ? "كلمة السر" : "Password",
    pass2: lang === "ar" ? "تأكيد كلمة السر" : "Confirm password",
    reqTitle: lang === "ar" ? "شروط كلمة السر:" : "Password requirements:",
    reqs: lang === "ar"
      ? ["١٢ حرف على الأقل", "حرف كبير وحرف صغير", "رقم ورمز (مثل !@#$)", "متكونش كلمة سر مسرّبة معروفة"]
      : ["At least 12 characters", "Upper & lower case letters", "A number and a symbol (e.g. !@#$)", "Not a known leaked password"],
    mismatch: lang === "ar" ? "كلمتا السر مش متطابقتين" : "Passwords don't match",
    btn: mode === "invite" ? (lang === "ar" ? "تفعيل الحساب والدخول" : "Activate & sign in") : (lang === "ar" ? "حفظ كلمة السر" : "Save password"),
    okTitle: lang === "ar" ? "تمّ بنجاح ✓" : "Done ✓",
    okSub: lang === "ar" ? "جارٍ تحويلك للنظام..." : "Redirecting you to the system...",
    linkExpired: lang === "ar" ? "اللينك ده منتهي أو مستخدم قبل كده. اطلب لينك جديد." : "This link is expired or already used. Request a new one.",
    backToLogin: lang === "ar" ? "الرجوع لتسجيل الدخول" : "Back to sign in",
    checking: lang === "ar" ? "جارٍ التحقق من اللينك..." : "Verifying link...",
    weakHint: lang === "ar" ? "كلمة السر ضعيفة أو مسرّبة — جرّب واحدة أقوى." : "Password is too weak or leaked — try a stronger one.",
  };

  async function submit() {
    setErr("");
    if (pw.length < 12) { setErr(T.reqs[0]); return; }
    if (pw !== pw2) { setErr(T.mismatch); return; }
    setLoading(true);
    const { error } = await supabaseRef.current.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      setErr(/weak|leaked|pwned|short|characters|strength/i.test(error.message) ? T.weakHint : error.message);
      return;
    }
    setDone(true);
    setTimeout(() => { router.push("/"); router.refresh(); }, 1200);
  }

  return (
    <div className="login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-cat" src="/cats/cat-6.svg" alt="" aria-hidden="true" />
      <div className="login-card" dir={lang === "ar" ? "rtl" : "ltr"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="logo" style={{ textAlign: "center" }}><img src="/logo.png" alt="NIQAT" /></div>
        <div className="appname" style={{ textAlign: "center" }}>CRM-NIQAT</div>
        <div className="appname-sub" style={{ textAlign: "center" }}>{T.appSub}</div>

        {done ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(24,169,87,.14)", color: "#18A957", display: "grid", placeItems: "center", margin: "8px auto 14px" }}>
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2>{T.okTitle}</h2><p className="sub">{T.okSub}</p>
          </div>
        ) : linkError ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <h2>{T.title}</h2>
            <p style={{ color: "var(--red)", fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 18px" }}>{T.linkExpired}</p>
            <a href="/login" className="btn ghost" style={{ width: "100%", justifyContent: "center" }}>{T.backToLogin}</a>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13.5 }}>{T.checking}</div>
        ) : (
          <>
            <h2>{T.title}</h2>
            <p className="sub">{T.sub}</p>

            <div className="fld">
              <label>{T.pass}</label>
              <input className="inp" type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="fld">
              <label>{T.pass2}</label>
              <input className="inp" type="password" dir="ltr" value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            </div>

            <div style={{ background: "var(--muted-soft)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 5 }}>{T.reqTitle}</div>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                {T.reqs.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>

            {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

            <button onClick={submit} disabled={loading} className="btn" style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "..." : T.btn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
