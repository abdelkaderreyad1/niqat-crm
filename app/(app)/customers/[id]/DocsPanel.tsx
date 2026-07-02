"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Doc = { id: string; url: string; name: string; at: string };

export default function DocsPanel({
  customerId, initial, tableMissing,
}: {
  customerId: string; initial: Doc[]; tableMissing: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);
  const isImg = (n: string) => /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(n) || /image/i.test(n);

  const upload = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    const path = `docs/${customerId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); toast("تعذّر رفع الملف"); return; }
    const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
    const url = pub.publicUrl;
    const { data, error } = await supabase.from("customer_docs")
      .insert({ customer_id: customerId, url, name: file.name }).select("id,created_at").single();
    setBusy(false);
    if (error) { toast("اترفع بس تعذّر حفظه"); return; }
    setDocs((d) => [{ id: data!.id, url, name: file.name, at: String(data!.created_at || "").slice(0, 10) }, ...d]);
    setFile(null);
    toast("تم رفع المستند");
  }, [file, customerId, supabase]);

  async function del(id: string) {
    if (!confirm("حذف المستند؟")) return;
    setDocs((d) => d.filter((x) => x.id !== id));
    const { error } = await supabase.from("customer_docs").delete().eq("id", id);
    if (error) { toast("تعذّر الحذف"); router.refresh(); }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t" style={{ margin: 0 }}>المستندات</div>
      {tableMissing ? (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
          شغّل ملف <b>customer_docs.sql</b> في Supabase عشان قسم المستندات يشتغل.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
            <label className="addshot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
              {file ? file.name : "اختر ملف / صورة"}
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <button className="btn" type="button" disabled={!file || busy} onClick={upload}>
              {busy ? "بيرفع..." : "رفع"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {docs.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد مستندات بعد.</div>}
            {docs.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                {isImg(d.name) ? (
                  <button type="button" onClick={() => setPreview(d)} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "start" }}>
                    <img src={d.url} alt={d.name} style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: "var(--blue)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🖼️ {d.name}</span>
                  </button>
                ) : (
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontWeight: 600, color: "var(--blue)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {d.name}</a>
                )}
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fe)" }}>{d.at}</span>
                <button className="x" type="button" onClick={() => del(d.id)} title="حذف" style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {preview && (
        <>
          <div className="scrim show" onClick={() => setPreview(null)} />
          <div className="modal show" role="dialog" aria-modal="true" style={{ width: "min(680px,94%)" }}>
            <div className="modal-h">
              <h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.name}</h3>
              <button className="x" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="modal-b" style={{ textAlign: "center" }}>
              <img src={preview.url} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10 }} />
            </div>
            <div className="modal-f">
              <a href={preview.url} target="_blank" rel="noreferrer" className="btn ghost" style={{ textDecoration: "none" }}>فتح بالحجم الكامل</a>
              <button className="btn" type="button" style={{ marginInlineStart: "auto" }} onClick={() => setPreview(null)}>تمام</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
