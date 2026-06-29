import "./globals.css";
import type { Metadata } from "next";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "نقاط CRM",
  description: "نظام إدارة عملاء نقاط",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
