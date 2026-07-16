"use server";
import { createClient } from "@/lib/supabase/server";

type SP = { q?: string; stage?: string; owner?: string; company?: string; dip?: string; spec?: string; batch?: string; pay?: string };
const PAGE = 1000;
const CAP = 30000;
const CHUNK = 150;
const arr = (s?: string) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

// يجيب أرقام كل العملاء المطابقين للفلتر/البحث الحالي (مش الـ100 المعروضين بس).
// فلاتر متعددة القيم: داخل نفس الفلتر = OR، بين الفلاتر = AND.
export async function getSegmentPhones(f: SP): Promise<string[]> {
  const supabase = createClient();
  const q = (f?.q || "").trim();
  const dipVals = arr(f?.dip);
  const batchVals = arr(f?.batch);
  const payVals = arr(f?.pay);
  const stageVals = arr(f?.stage);
  const specVals = arr(f?.spec);
  const ownerVals = arr(f?.owner);
  const companyVals = arr(f?.company);

  // (1) لو فيه فلتر دبلومة/باتش/دفع → نحدّد أولاً IDs العملاء المرشّحين
  let idFilter: string[] | null = null;
  if (dipVals.length || batchVals.length || payVals.length) {
    const enrToCust = new Map<string, string>();
    for (let from = 0; from < CAP; from += PAGE) {
      let eq = supabase.from("enrollments").select("id,customer_id");
      if (dipVals.length) eq = eq.in("diploma_id", dipVals);
      if (batchVals.length) eq = eq.in("batch_id", batchVals);
      const { data } = await eq.range(from, from + PAGE - 1);
      const rows = (data as any[]) || [];
      for (const r of rows) if (r.customer_id) enrToCust.set(r.id, r.customer_id);
      if (rows.length < PAGE) break;
    }
    let candidate = new Set<string>(Array.from(enrToCust.values()));

    if (payVals.length) {
      const today = new Date().toISOString().slice(0, 10);
      const wantBal = payVals.includes("bal");
      const wantDue = payVals.includes("due");
      const wantOver = payVals.includes("overdue") || payVals.includes("over");
      const payIds = new Set<string>();
      const scan = (rows: any[]) => {
        for (const i of rows) {
          const cid = enrToCust.get(i.enrollment_id); if (!cid) continue;
          const paid = !!i.paid_at || i.status === "paid"; if (paid) continue;
          if (wantBal) payIds.add(cid);                                   // أي قسط غير مدفوع = عليه متبقّي
          if (wantDue && i.due_date) payIds.add(cid);
          if (wantOver && i.due_date && i.due_date < today) payIds.add(cid);
        }
      };
      if (dipVals.length || batchVals.length) {
        const enrIds = Array.from(enrToCust.keys());
        for (let c = 0; c < enrIds.length; c += CHUNK) {
          const { data } = await supabase.from("installments")
            .select("enrollment_id,amount,paid_at,due_date,status").in("enrollment_id", enrIds.slice(c, c + CHUNK));
          scan((data as any[]) || []);
        }
      } else {
        for (let from = 0; from < CAP; from += PAGE) {
          const { data } = await supabase.from("installments")
            .select("enrollment_id,amount,paid_at,due_date,status").range(from, from + PAGE - 1);
          const rows = (data as any[]) || []; scan(rows);
          if (rows.length < PAGE) break;
        }
      }
      candidate = (dipVals.length || batchVals.length)
        ? new Set(Array.from(candidate).filter((x) => payIds.has(x)))
        : payIds;
    }
    idFilter = Array.from(candidate);
    if (idFilter.length === 0) return [];
  }

  // (2) نجيب الأرقام مع فلاتر أعمدة العميل (deleted/مؤرشف/بحث/مرحلة/تخصص/مسؤول/شركة)
  const applyCols = (cq: any) => {
    cq = cq.eq("deleted", false).not("archived", "is", true);
    if (q) cq = cq.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
    if (stageVals.length) cq = cq.in("stage", stageVals);
    if (specVals.length) cq = cq.in("specialty_id", specVals);
    if (companyVals.length) cq = cq.in("company", companyVals);
    if (ownerVals.length) {
      const hasNone = ownerVals.includes("none");
      const ids = ownerVals.filter((v) => v !== "none");
      if (hasNone && ids.length) cq = cq.or(`owner_id.is.null,owner_id.in.(${ids.join(",")})`);
      else if (hasNone) cq = cq.is("owner_id", null);
      else cq = cq.in("owner_id", ids);
    }
    return cq;
  };

  const phones: string[] = [];
  if (idFilter) {
    for (let c = 0; c < idFilter.length; c += CHUNK) {
      const { data } = await applyCols(supabase.from("customers").select("phone1")).in("id", idFilter.slice(c, c + CHUNK));
      for (const r of (data as any[]) || []) if (r.phone1) phones.push(r.phone1);
    }
  } else {
    for (let from = 0; from < CAP; from += PAGE) {
      const { data } = await applyCols(supabase.from("customers").select("phone1"))
        .order("created_at", { ascending: false }).range(from, from + PAGE - 1);
      const rows = (data as any[]) || [];
      for (const r of rows) if (r.phone1) phones.push(r.phone1);
      if (rows.length < PAGE) break;
    }
  }
  return Array.from(new Set(phones));
}
