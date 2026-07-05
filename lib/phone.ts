// تطبيع أرقام الموبايل — بند 4
// خانة كود دولة منفصلة + كشف تلقائي للكود لو المستخدم كتب الرقم كامل.
// الأكواد الأجنبية تُحترم؛ الأرقام المصرية المحلية تتحوّل لـ +20.

export type Country = { code: string; dial: string; nameAr: string; nameEn: string; flag: string };

// الدول الشائعة لعملاء نقاط (مصر افتراضي أولاً)
export const COUNTRIES: Country[] = [
  { code: "EG", dial: "20", nameAr: "مصر", nameEn: "Egypt", flag: "🇪🇬" },
  { code: "SA", dial: "966", nameAr: "السعودية", nameEn: "Saudi Arabia", flag: "🇸🇦" },
  { code: "AE", dial: "971", nameAr: "الإمارات", nameEn: "UAE", flag: "🇦🇪" },
  { code: "KW", dial: "965", nameAr: "الكويت", nameEn: "Kuwait", flag: "🇰🇼" },
  { code: "QA", dial: "974", nameAr: "قطر", nameEn: "Qatar", flag: "🇶🇦" },
  { code: "BH", dial: "973", nameAr: "البحرين", nameEn: "Bahrain", flag: "🇧🇭" },
  { code: "OM", dial: "968", nameAr: "عُمان", nameEn: "Oman", flag: "🇴🇲" },
  { code: "SD", dial: "249", nameAr: "السودان", nameEn: "Sudan", flag: "🇸🇩" },
  { code: "JO", dial: "962", nameAr: "الأردن", nameEn: "Jordan", flag: "🇯🇴" },
  { code: "LB", dial: "961", nameAr: "لبنان", nameEn: "Lebanon", flag: "🇱🇧" },
  { code: "IQ", dial: "964", nameAr: "العراق", nameEn: "Iraq", flag: "🇮🇶" },
  { code: "LY", dial: "218", nameAr: "ليبيا", nameEn: "Libya", flag: "🇱🇾" },
  { code: "PS", dial: "970", nameAr: "فلسطين", nameEn: "Palestine", flag: "🇵🇸" },
  { code: "SY", dial: "963", nameAr: "سوريا", nameEn: "Syria", flag: "🇸🇾" },
  { code: "YE", dial: "967", nameAr: "اليمن", nameEn: "Yemen", flag: "🇾🇪" },
  { code: "MA", dial: "212", nameAr: "المغرب", nameEn: "Morocco", flag: "🇲🇦" },
  { code: "DZ", dial: "213", nameAr: "الجزائر", nameEn: "Algeria", flag: "🇩🇿" },
  { code: "TN", dial: "216", nameAr: "تونس", nameEn: "Tunisia", flag: "🇹🇳" },
  { code: "TR", dial: "90", nameAr: "تركيا", nameEn: "Turkey", flag: "🇹🇷" },
  { code: "GB", dial: "44", nameAr: "بريطانيا", nameEn: "UK", flag: "🇬🇧" },
  { code: "US", dial: "1", nameAr: "أمريكا/كندا", nameEn: "USA/Canada", flag: "🇺🇸" },
];

export const DEFAULT_DIAL = "20"; // مصر

/**
 * مفتاح مقارنة موحّد للرقم — آخر 9 أرقام (الجزء المميّز).
 * بيحل مشكلة اختلاف الصيغ: 01147666096 و 201147666096 و +201147666096
 * كلهم بيطلّعوا نفس المفتاح "147666096". يُستخدم في كشف التكرار.
 */
export function phoneKey(raw: string): string {
  const digits = toAsciiDigits(raw).replace(/\D/g, "");
  if (!digits) return "";
  // آخر 9 أرقام (كافية للتمييز، وبتتجاهل اختلاف الكود/الصفر البادئ)
  return digits.length > 9 ? digits.slice(-9) : digits;
}

// أطول-كود-أولاً عشان الكشف يبقى دقيق (مثلاً 971 قبل 97)
const DIALS_BY_LEN = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

// تحويل الأرقام العربية/الفارسية لإنجليزية + شيل أي حاجة مش رقم
function toAsciiDigits(s: string): string {
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return (s || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] || d).replace(/[^\d+]/g, "");
}

/**
 * تطبيع رقم كامل → صيغة دولية نظيفة "+<code><number>".
 * @param raw الرقم اللي المستخدم كتبه (ممكن يكون محلي أو دولي)
 * @param defaultDial كود الدولة الافتراضي لو الرقم محلي (افتراضي مصر 20)
 */
export function normalizePhone(raw: string, defaultDial: string = DEFAULT_DIAL): string {
  let s = toAsciiDigits(raw);
  if (!s) return "";

  // صيغة 00 الدولية → +
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // لو بدأ بـ + : رقم دولي صريح، نحترمه زي ما هو (بعد التنظيف)
  if (s.startsWith("+")) return "+" + s.slice(1).replace(/\D/g, "");

  // رقم بيبدأ بصفر (محلي) → نشيل الصفر ونحط الكود الافتراضي
  if (s.startsWith("0")) return "+" + defaultDial + s.replace(/^0+/, "");

  // كشف تلقائي: لو الرقم بيبدأ بكود دولة معروف (والباقي طوله معقول) → نحترمه
  for (const c of DIALS_BY_LEN) {
    if (s.startsWith(c.dial)) {
      const rest = s.slice(c.dial.length);
      // نتأكد إن الباقي طوله منطقي (7-12) عشان ما نغلطش في أرقام محلية بتصادف تبدأ بنفس الكود
      if (rest.length >= 7 && rest.length <= 12) return "+" + c.dial + rest;
    }
  }

  // مش محلي بصفر ومش بكود معروف → نفترض إنه محلي بالكود الافتراضي
  return "+" + defaultDial + s;
}

/**
 * دمج كود مختار + رقم مكتوب → صيغة دولية.
 * لو المستخدم كتب رقم كامل بكوده في خانة الرقم، الكشف التلقائي بياخد الأولوية.
 */
export function combineDialAndNumber(dial: string, number: string): string {
  const s = toAsciiDigits(number);
  if (!s) return "";
  // لو المستخدم كتب الرقم كامل (بـ + أو 00 أو كود معروف) → طبّعه مباشرة
  if (s.startsWith("+") || s.startsWith("00")) return normalizePhone(number, dial);
  // رقم محلي بصفر → نستخدم الكود المختار
  if (s.startsWith("0")) return "+" + dial + s.replace(/^0+/, "");
  // كشف تلقائي: بدأ بكود معروف والباقي منطقي؟
  for (const c of DIALS_BY_LEN) {
    if (s.startsWith(c.dial)) {
      const rest = s.slice(c.dial.length);
      if (rest.length >= 7 && rest.length <= 12) return "+" + c.dial + rest;
    }
  }
  // غير كده: رقم عادي بالكود المختار
  return "+" + dial + s;
}
