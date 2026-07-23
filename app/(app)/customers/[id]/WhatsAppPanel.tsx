"use client";
import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type Tpl = { id: string; name: string; body: string };
type WatiTpl = { name: string; body: string; vars: number; params: string[]; status: string };
type Ctx = { name: string; phone1: string; diploma: string; batch: string; remaining: string };

function fill(text: string, c: Ctx) {
  return text
    .replace(/\{name\}/g, c.name || "")
    .replace(/\{diploma\}/g, c.diploma || "")
    .replace(/\{batch\}/g, c.batch || "")
    .replace(/\{remaining\}/g, c.remaining || "");
}
function waLink(phone: string, text: string) {
  const num = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "20");
  return `https://wa.me/${num}${text ? "?text=" + encodeURIComponent(text) : ""}`;
}

export default function WhatsAppPanel({
  customerId, meId, ctx, templates,
}: { customerId: string; meId: string; ctx: Ctx; templates: Tpl[] }) {
  const tr = useT();
  const [preview, setPreview] = useState<string>("");
  const [channel, setChannel] = useState<"sales" | "support">("sales");
  const [busy, setBusy] = useState(false);
  const [watiTpls, setWatiTpls] = useState<WatiTpl[]>([]);
  const [tplName, setTplName] = useState("");
  const [tplErr, setTplErr] = useState("");
  const [loadingTpls, setLoadingTpls] = useState(true);
  const [result, setResult] = useState<string>("");
  const [varMap, setVarMap] = useState<Record<string, string>>({});
  const [customVals, setCustomVals] = useState<Record<string, string>>({});

  const selParams = watiTpls.find((t) => t.name === tplName)?.params || [];
  useEffect(() => {
    const m: Record<string, string> = {};
    selParams.forEach((p, idx) => { m[p] = idx === 0 ? "name" : "custom"; });
    setVarMap(m); setCustomVals({});
  }, [tplName]);

  function resolveField(p: string): string {
    const f = varMap[p] || "name";
    if (f === "custom") return customVals[p] || "";
    if (f === "name") return (ctx.name || "").trim().split(/\s+/).slice(0, 2).join(" ");
    if (f === "phone") return ctx.phone1 || "";
    if (f === "diploma") return ctx.diploma || "";
    if (f === "batch") return ctx.batch || "";
    if (f === "remaining") return ctx.remaining || "";
    return "";
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/wa/templates");
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) { setTplErr(data.error || "تعذّر جلب القوالب"); setWatiTpls([]); }
        else { setWatiTpls(data.templates || []); setTplErr(""); }
      } catch (e: any) {
        if (alive) setTplErr(e?.message || "تعذّر جلب القوالب");
      } finally {
        if (alive) setLoadingTpls(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function api(payload: any) {
    setBusy(true); setResult("");
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, to: ctx.phone1, channel, customer_id: customerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(tr("waSendFailed") + (data.error || "")); setResult("err:" + (data.error || tr("waSendFailed"))); return; }
      toast(tr("waSent")); setResult("ok");
    } catch (e: any) {
      toast(tr("waSendFailed") + (e?.message || "")); setResult("err:" + (e?.message || ""));
    } finally { setBusy(false); }
  }

  const sendSession = (tpl: Tpl) => api({ mode: "session", text: fill(tpl.body, ctx) });
  const sendTemplate = () => {
    if (!tplName.trim()) return toast(tr("enterTplName"));
    const parameters = selParams.map((p) => ({ name: p, value: resolveField(p) }));
    api({ mode: "template", template_name: tplName.trim(), parameters });
  };

  if (!ctx.phone1) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">{tr("whatsapp")}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noMobile")}</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">{tr("whatsapp")}</div>

      {/* اختيار الرقم المُرسِل */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 700 }}>{tr("senderNo")}:</span>
        {(["sales", "support"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className="opt-chip"
            style={channel === c ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : undefined}>
            {tr(c === "sales" ? "senderSales" : "senderSupport")}
          </button>
        ))}
      </div>

      {/* قوالب النظام (نص حر — session، بيشتغل خلال 24 ساعة من آخر رسالة من العميل) */}
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{tr("waSessionNote")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
        {templates.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("noTemplates")}</span>}
        {templates.map((t) => (
          <button key={t.id} className="btn ghost" disabled={busy} style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
            onMouseEnter={() => setPreview(fill(t.body, ctx))} onMouseLeave={() => setPreview("")}
            onClick={() => sendSession(t)}>
            {t.name}
          </button>
        ))}
        <a className="btn wa" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
          href={waLink(ctx.phone1, "")} target="_blank" rel="noreferrer">{tr("openBlankChat")}</a>
      </div>
      {preview && (
        <div style={{ fontSize: 12.5, color: "var(--muted)", background: "rgba(24,169,87,.07)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", marginBottom: 10 }}>
          {preview}
        </div>
      )}

      {/* قالب WATI معتمد (بيشتغل أي وقت) — اختَر من قوالب حسابك */}
      <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 12 }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{tr("waTemplateNote")}</div>
        {tplErr ? (
          <div style={{ fontSize: 12, color: "var(--red)" }}>{tplErr}</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="inp" dir="ltr" value={tplName} onChange={(e) => setTplName(e.target.value)} disabled={loadingTpls || busy} style={{ flex: 1, minWidth: 180, height: 36 }}>
              <option value="">{loadingTpls ? tr("loadingTpls") : (watiTpls.length ? tr("chooseTpl") : tr("noWatiTpls"))}</option>
              {watiTpls.map((t) => (
                <option key={t.name} value={t.name}>{t.name}{t.vars > 0 ? ` (${t.vars})` : ""}</option>
              ))}
            </select>
            <button className="btn" disabled={busy || !tplName} onClick={sendTemplate} style={{ height: 36, flexShrink: 0 }}>{tr("sendTemplateBtn")}</button>
          </div>
        )}
        {selParams.length > 0 && (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "var(--muted-soft)" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8, fontWeight: 700 }}>{tr("tplVarsHint")}</div>
            {selParams.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span className="num" style={{ fontSize: 12, color: "var(--brand-d)", fontWeight: 800, minWidth: 44 }}>{`{{${p}}}`}</span>
                <select className="inp" value={varMap[p] || "name"} onChange={(e) => setVarMap((m) => ({ ...m, [p]: e.target.value }))} style={{ height: 32, flex: 1 }}>
                  <option value="name">{tr("varName")}</option>
                  <option value="phone">{tr("varPhone")}</option>
                  <option value="diploma">{tr("varDiploma")}</option>
                  <option value="batch">{tr("varBatch")}</option>
                  <option value="remaining">{tr("varRemaining")}</option>
                  <option value="custom">{tr("varCustom")}</option>
                </select>
                {varMap[p] === "custom" && (
                  <input className="inp" value={customVals[p] || ""} onChange={(e) => setCustomVals((c) => ({ ...c, [p]: e.target.value }))} placeholder={tr("varCustom")} style={{ height: 32, flex: 1 }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div style={{ fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: "8px 12px", marginTop: 10,
          background: result === "ok" ? "rgba(24,169,87,.1)" : "rgba(229,72,77,.1)",
          color: result === "ok" ? "var(--green)" : "var(--red)" }}>
          {result === "ok" ? tr("waSent") : result.replace(/^err:/, "")}
        </div>
      )}
    </div>
  );
}
