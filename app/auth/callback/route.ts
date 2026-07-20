import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // الصفحة اللي هيتحول عليها بعد نجاح التفعيل
  const next = searchParams.get('next') ?? '/accept-invite'

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options })
        },
      },
    }
  )

  // 1) روابط الإيميل (دعوة / استعادة / تأكيد) — الطريقة الصحيحة: verifyOtp بالـ token_hash
  //    دي مش محتاجة code verifier، فبتشتغل حتى لو المستخدم فتح اللينك من متصفح جديد.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  // 2) روابط OAuth / PKCE اللي بدأت من نفس المتصفح — exchangeCodeForSession
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  // 3) لو فشل كل ده → صفحة خطأ واضحة (مش صفحة الدخول)
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
