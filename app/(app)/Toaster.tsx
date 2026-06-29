"use client";
import { useEffect, useState } from "react";

export default function Toaster() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => {
    let timer: any;
    const onToast = (e: any) => {
      setMsg(e.detail || "تم");
      setShow(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShow(false), 2600);
    };
    window.addEventListener("niqat-toast", onToast as any);
    return () => { window.removeEventListener("niqat-toast", onToast as any); clearTimeout(timer); };
  }, []);
  return (
    <div className={"toast" + (show ? " show" : "")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 18, height: 18 }}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>{msg}</span>
    </div>
  );
}
