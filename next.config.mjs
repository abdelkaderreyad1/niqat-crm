/** @type {import('next').NextConfig} */

// سياسة أمان المحتوى (CSP) — تسمح بـ Supabase (REST + Realtime) وخطوط Google
const supabaseHost = "https://isuuwseyxetshrhmhpda.supabase.co";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",                              // Next.js hydration
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  // Tailwind + خطوط Google
  `img-src 'self' data: blob: ${supabaseHost}`,                     // صور + مرفقات Supabase
  "font-src 'self' data: https://fonts.gstatic.com",                // ملفات خطوط Google
  `connect-src 'self' ${supabaseHost} wss://isuuwseyxetshrhmhpda.supabase.co`,
  "frame-ancestors 'none'",                                         // بديل قوي لـ X-Frame-Options
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy",   value: csp },
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
