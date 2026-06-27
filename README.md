# نقاط CRM — تطبيق Next.js

تطبيق إدارة عملاء نقاط، متصل بقاعدة بيانات Supabase.

## التشغيل محلياً
1. `npm install`
2. تأكد إن ملف `.env.local` فيه رابط المشروع والمفتاح (موجودين).
3. `npm run dev` ثم افتح http://localhost:3000

## النشر على Vercel
1. ارفع المشروع على GitHub.
2. ادخل vercel.com → New Project → اختر الريبو.
3. في Environment Variables أضف:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## أول مستخدم (أدمن)
- من Supabase → Authentication → Users → Add user (مع Auto confirm).
- بعدها يتعمل له profile تلقائياً، ويتم رفعه أدمن.
