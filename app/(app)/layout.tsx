import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavLinks from "./NavLinks";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, team, can_see_finance")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-l border-line p-4 hidden md:block">
        <div className="flex items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="نقاط" className="h-10 w-auto" />
          <span className="text-xs font-bold text-muted num">CRM</span>
        </div>
        <NavLinks canFinance={!!profile?.can_see_finance} />
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-line px-5 py-3 flex items-center justify-between">
          <div className="text-sm text-muted">
            {profile?.full_name || user.email}
            <span className="mx-2 text-line">|</span>
            <span className="text-brand font-bold">{profile?.team || "—"}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              خروج
            </button>
          </form>
        </header>
        <main className="p-5 flex-1">{children}</main>
      </div>
    </div>
  );
}
