"use client";
import { useState, useEffect } from "react";
import { randomCat } from "@/lib/fun";

// حالة فارغة لطيفة: قطة عشوائية + جملة فان.
// تستقبل النص جاهزاً (مترجم) من الصفحة عبر prop.
export default function EmptyState({ text }: { text: string }) {
  const [cat, setCat] = useState("");
  useEffect(() => { setCat(randomCat()); }, []);
  return (
    <div className="empty empty-cat">
      {cat && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="empty-cat-img" src={cat} alt="" aria-hidden="true" />
      )}
      <b>{text}</b>
    </div>
  );
}
