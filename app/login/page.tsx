"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("بيانات الدخول غير صحيحة"); return; }
    router.push("/"); router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "var(--bg)" }}>
      <div className="card" style={{ width: "100%", maxWidth: 380, padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="نقاط" style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 10 }} />
          <div className="appname">CRM-NIQAT</div>
          <div className="appname-sub">نظام إدارة العملاء</div>
        </div>

        <div className="fld">
          <label>البريد الإلكتروني</label>
          <input className="inp num" type="email" dir="ltr" value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label>كلمة المرور</label>
          <input className="inp" type="password" dir="ltr" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") signIn(); }} />
        </div>

        {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <button onClick={signIn} disabled={loading} className="btn" style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "..." : "تسجيل الدخول"}
        </button>
      </div>
    </div>
  );
}
