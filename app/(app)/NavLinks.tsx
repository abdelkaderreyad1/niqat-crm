"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/pipeline", label: "المراحل" },
  { href: "/customers", label: "العملاء" },
  { href: "/support", label: "الدعم" },
];

export default function NavLinks() {
  const path = usePathname() || "/";
  return (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={
              "block px-3 py-2 rounded-lg text-sm font-bold transition " +
              (active ? "bg-brand text-white shadow-sm" : "text-ink hover:bg-brand-soft")
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
