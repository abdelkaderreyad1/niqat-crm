import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthCodeError() {
  return (
    <div className="login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-cat" src="/cats/cat-6.svg" alt="" aria-hidden="true" />
      <div className="login-card" dir="rtl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="logo" style={{ textAlign: "center" }}><img src="/logo.png" alt="NIQAT" /></div>
        <div className="appname" style={{ textAlign: "center" }}>CRM-NIQAT</div>

        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <h2>اللينك مش شغّال</h2>
          <p style={{ color: "var(--red)", fontSize: 13.5, lineHeight: 1.7, margin: "10px 0 18px" }}>
            رابط الدعوة/الاستعادة منتهي أو اتستخدم قبل كده أو مش مكتمل.
            اطلب من المسؤول يبعتلك دعوة جديدة، وافتحها من نفس اللينك مباشرةً.
          </p>
          <Link href="/login" className="btn ghost" style={{ width: "100%", justifyContent: "center" }}>
            الرجوع لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
