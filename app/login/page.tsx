"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"ar" | "en">("en");

  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    const m = document.cookie.match(/(?:^|;\s*)lang=(ar|en)/);
    if (m) setLang(m[1] as "ar" | "en");
  }, []);

  const T = {
    appSub: lang === "ar" ? "نظام إدارة العملاء" : "Customer Management System",
    title: lang === "ar" ? "تسجيل الدخول" : "Sign In",
    sub: lang === "ar" ? "ادخل بياناتك للمتابعة" : "Enter your credentials to continue",
    emailLbl: lang === "ar" ? "البريد الإلكتروني" : "Email",
    passLbl: lang === "ar" ? "كلمة المرور" : "Password",
    btn: lang === "ar" ? "تسجيل الدخول" : "Sign In",
    err: lang === "ar" ? "بيانات الدخول غير صحيحة" : "Invalid login credentials",
    credit: lang === "ar" ? "تصميم وتنفيذ إدارة العمليات في نقاط" : "Designed & built by the Operations Department at NIQAT",
  };

  async function signIn() {
    if (!supabaseRef.current) { setErr("جارٍ التحميل…"); return; }
    setErr(""); setLoading(true);
    const { error } = await supabaseRef.current.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("بيانات الدخول غير صحيحة"); return; }
    router.push("/"); router.refresh();
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
        <h2>{T.title}</h2>
        <p className="sub">{T.sub}</p>

        <div className="fld">
          <label>{T.emailLbl}</label>
          <input className="inp num" type="email" dir="ltr" placeholder="name@niqat.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label>{T.passLbl}</label>
          <input className="inp" type="password" dir="ltr" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") signIn(); }} />
        </div>

        {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{T.err}</div>}

        <button onClick={signIn} disabled={loading} className="btn" style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "..." : T.btn}
        </button>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
          {T.credit}
        </div>
      </div>
    </div>
  );
}
