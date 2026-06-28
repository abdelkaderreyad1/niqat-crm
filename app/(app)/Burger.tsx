"use client";
export default function Burger() {
  return (
    <button
      className="burger"
      aria-label="القائمة"
      onClick={() => document.getElementById("sb")?.classList.toggle("open")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
