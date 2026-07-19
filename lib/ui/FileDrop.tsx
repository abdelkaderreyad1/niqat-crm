"use client";
import { useState, type ReactNode, type CSSProperties } from "react";

/**
 * غلاف رفع ملفات بالسحب والإفلات + الاختيار من الجهاز.
 * بيلفّ المحتوى (نص/أيقونة) في <label> فيه input مخفي، وبيضيف
 * منطقة إفلات مع تمييز بصري عند السحب فوقها.
 */
export default function FileDrop({
  onFile, accept = "image/*", multiple = false, disabled = false,
  children, className, style,
}: {
  onFile: (f: File) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [drag, setDrag] = useState(false);

  function emit(files: FileList | null) {
    if (!files || !files.length) return;
    if (multiple) Array.from(files).forEach((f) => onFile(f));
    else onFile(files[0]);
  }

  return (
    <label
      className={className}
      style={{
        ...style,
        cursor: disabled ? "not-allowed" : "pointer",
        outline: drag ? "2px dashed var(--brand)" : undefined,
        outlineOffset: 2,
        background: drag ? "var(--brand-soft)" : style?.background,
        transition: "background .12s, outline .12s",
      }}
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); e.stopPropagation(); setDrag(true); }}
      onDragEnter={(e) => { if (disabled) return; e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault(); e.stopPropagation(); setDrag(false);
        emit(e.dataTransfer?.files || null);
      }}
    >
      {children}
      <input
        type="file" accept={accept} multiple={multiple} disabled={disabled}
        style={{ display: "none" }}
        onChange={(e) => { emit(e.target.files); e.currentTarget.value = ""; }}
      />
    </label>
  );
}
