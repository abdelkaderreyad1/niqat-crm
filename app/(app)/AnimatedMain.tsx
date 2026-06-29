"use client";
import { usePathname } from "next/navigation";

export default function AnimatedMain({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div key={path} className="enter">{children}</div>;
}
