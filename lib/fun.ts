// جمل الترحيب اليومية + مسارات صور القطة — مكوّنات المرح في CRM-NIQAT
// معزول تماماً: لا يلمس أي بيانات أو صلاحيات.

export const CATS: string[] = [
  "/cats/cat-1.svg",
  "/cats/cat-2.svg",
  "/cats/cat-3.svg",
  "/cats/cat-4.svg",
  "/cats/cat-5.svg",
  "/cats/cat-6.svg",
  "/cats/cat-7.svg",
];

// 30 جملة يومية — عربي + إنجليزي مخلوطين، تُختار عشوائياً كل يوم
export const DAILY_QUOTES: string[] = [
  "I am not lazy, I am on energy saving mode.",
  "Work until your bank account looks like a phone number.",
  "Nothing is impossible — the word itself says \u201CI'm possible\u201D.",
  "If you can't find the sunshine, be the sunshine.",
  "Coffee in one hand, confidence in the other. Let's do this!",
  "Another day, another lead to convert. Let's make it count.",
  "Your biggest competition is who you were yesterday. Beat that version.",
  "Success is just a series of small wins. Start with the first one today.",
  "Complexity is the enemy of execution. Keep it simple and move forward.",
  "Be the person who makes everyone else's job easier today.",
  "Stop looking for inspiration. You are the inspiration.",
  "You don't chase success; you define it.",
  "It's an honor to work with someone as talented and dedicated as you.",
  "Your dedication is what separates us from the rest. Keep being amazing.",
  "Congrats! You made it to work. Now let's survive the next 8 hours.",
  "You don't just manage clients — you manage chaos like a pro.",
  "القهوة مش بتخليك ذكي، بس بتخليك تستحملنا… وده في حد ذاته إنجاز عظيم!",
  "يوم الخميس مش مجرد يوم، ده حلم بنعيش عشانه من يوم الأحد.",
  "شكراً إنك معانا.",
  "لا تقارن نفسك بالآخرين، قارن نفسك بنسختك بالأمس، واحرص أن تكون أفضل اليوم.",
  "الثقة بالنفس هي الوقود الحقيقي لكل إنجاز، ابدأ يومك مؤمناً أنك قادر على فعل المستحيل.",
  "الفرص العظيمة لا تأتي للذين ينتظرونها، بل للذين يصنعونها بجدية وإصرار في كل لحظة.",
  "هي الدنيا كدا.",
  "دعنا ننسى أخطاء الماضي ونبدأ بارتكاب أخطاء جديدة!",
  "كأنّ القهوة خُلقت لتكون حُبّاً ورضا لكل الأوقات.",
  "ما تفسده الحياة… تصلحه القهوة.",
  "صباح الخير يا كبير.",
  "صباح الخير يا فنان.",
  "صباح الخير.",
  "القهوة والسخرية… هما بس اللي مصحّينا لحد دلوقتي.",
];

// قطة عشوائية
export function randomCat(): string {
  return CATS[Math.floor(Math.random() * CATS.length)];
}
