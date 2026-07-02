"use client";
import { useEffect, useState } from "react";

function waLink(phone?: string | null) {
  if (!phone) return null;
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  return "https://wa.me/" + (d.startsWith("0") ? "20" + d.slice(1) : d);
}

export default function DrawerFooter({ phone, canMessage }: { phone?: string | null; canMessage?: boolean }) {
  const [busy, setBusy] = useState(false);
  const wa = waLink(phone);

  useEffect(() => {
    const done = () => setBusy(false);
    window.addEventListener("niqat:customer-saved", done);
    return () => window.removeEventListener("niqat:customer-saved", done);
  }, []);

  function save() {
    setBusy(true);
    window.dispatchEvent(new CustomEvent("niqat:save-customer"));
    // safety timeout so the button never sticks on "saving"
    setTimeout(() => setBusy(false), 4000);
  }

  return (
    <div className="dr-foot">
      <button type="button" className="btn" onClick={save} disabled={busy} style={{ flex: 1 }}>
        {busy ? "جاري الحفظ…" : "حفظ التغييرات"}
      </button>
      {canMessage && wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="btn wa" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.6-4A8 8 0 1 1 20 11.5z" /></svg>
          واتساب
        </a>
      )}
    </div>
  );
}
