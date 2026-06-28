import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/pipeline", label: "المراحل" },
  { href: "/customers", label: "العملاء" }
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("full_name, team").eq("id", user.id).maybeSingle();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-l border-line p-4 hidden md:block">
        <div className="text-xl font-extrabold text-brand mb-6">نقاط CRM</div>
        <nav className="space-y-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-ink hover:bg-brand-soft">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-line px-5 py-3 flex items-center justify-between">
          <div className="text-sm text-muted">
            {profile?.full_name || user.email}
            <span className="mx-2 text-line">|</span>
            <span className="text-brand font-bold">{profile?.team || "—"}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-muted hover:text-ink">خروج</button>
          </form>
        </header>
        <main className="p-5 flex-1">{children}</main>
      </div>
    </div>
  );
}
