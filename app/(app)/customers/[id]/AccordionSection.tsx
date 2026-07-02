"use client";
import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AccordionSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc${open ? " open" : ""}`}>
      <button type="button" className="acc-h" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="acc-t">{title}</span>
        {badge != null && <span className="acc-badge">{badge}</span>}
        <motion.span
          className="acc-chev"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="acc-b">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
