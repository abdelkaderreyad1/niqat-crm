"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabaseRef = useRef<any>(null);
  const [lang, setLang] = useState<"ar" | "en">("en");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    const m = document.cookie.match(/(?:^|;\s*)lang=(ar|en)/);
    if (m) setLang(m[1] as "ar" | "en");
  }, []);

  const T = {
    appSub: lang === "ar" ? "نظام إدارة العملاء" : "Customer Management System",
    title: lang === "ar" ? "نسيت كلمة السر" : "Forgot password",
    sub: lang === "ar" ? "اكتب إيميلك وهنبعتلك لينك لإعادة التعيين" : "Enter your email and we'll send you a reset link",
    email: lang === "ar" ? "البريد الإلكتروني" : "Email",
    btn: lang === "ar" ? "إرسال لينك الاستعادة" : "Send reset link",
    back: lang === "ar" ? "الرجوع لتسجيل الدخول" : "Back to sign in",
    sentTitle: lang === "ar" ? "بُعت اللينك ✓" : "Link sent ✓",
    sentSub: lang === "ar" ? "لو الإيميل مسجّل عندنا، هيوصلك لينك لإعادة تعيين كلمة السر. بصّ في الوارد (والـ Spam)." : "If the email is registered, a reset link is on its way. Check your inbox (and Spam).",
    needEmail: lang === "ar" ? "اكتب إيميلك الأول" : "Enter your email first",
  };

  async function send() {
    if (!email.trim()) { setErr(T.needEmail); return; }
    setErr(""); setLoading(true);
    const origin = window.location.origin;
    const { error } = await supabaseRef.current.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origin}/reset-password`,
    });
    setLoading(false);
    // ما بنكشفش إذا الإيميل موجود ولا لأ (أمان) — بنعرض نفس رسالة النجاح دايماً
    if (error && !/rate|limit/i.test(error.message)) { setErr(error.message); return; }
    setSent(true);
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

        {sent ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(24,169,87,.14)", color: "#18A957", display: "grid", placeItems: "center", margin: "8px auto 14px" }}>
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z" opacity="0" /><path d="m22 6-10 7L2 6" /><path d="M2 6h20v12H2z" /></svg>
            </div>
            <h2>{T.sentTitle}</h2>
            <p className="sub" style={{ lineHeight: 1.6 }}>{T.sentSub}</p>
            <a href="/login" className="btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>{T.back}</a>
          </div>
        ) : (
          <>
            <h2>{T.title}</h2>
            <p className="sub">{T.sub}</p>
            <div className="fld">
              <label>{T.email}</label>
              <input className="inp num" type="email" dir="ltr" placeholder="name@niqat.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            </div>
            {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
            <button onClick={send} disabled={loading} className="btn" style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "..." : T.btn}
            </button>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <a href="/login" style={{ color: "var(--muted)", fontSize: 12.5 }}>{T.back}</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
