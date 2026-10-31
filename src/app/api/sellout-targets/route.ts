import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sellout hedefleri. Yetki: Authorization: Bearer <oturum access_token>.
// Önceden giriş yapmadan okunup YAZILABİLİYORDU; artık
//   GET  → giriş yapmış her kullanıcı
//   POST → yalnızca admin / süpervizör (ekrandaki "Hedef Gir" ile aynı yetki)
// Token yalnızca kimlik doğrulamada kullanılır; sorgular önceki gibi aynı
// istemciyle yapılır (dönen veri, dolayısıyla prim hesapları değişmez).
async function authed(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return { sb, userId: data.user.id }
}

const yetkisiz = () => NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })

export async function GET(req: NextRequest) {
  const a = await authed(req)
  if (!a) return yetkisiz()
  const donem = req.nextUrl.searchParams.get('donem')
  if (!donem) return NextResponse.json({ error: 'donem gerekli' }, { status: 400 })

  const [pRes, mRes] = await Promise.all([
    a.sb.from('sellout_targets_profile').select('*').eq('donem', donem),
    a.sb.from('sellout_targets_merch').select('*').eq('donem', donem),
  ])

  return NextResponse.json({
    profile_targets: pRes.data ?? [],
    merch_targets:   mRes.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const a = await authed(req)
  if (!a) return yetkisiz()
  const { data: prof } = await a.sb.from('profiles').select('role').eq('id', a.userId).single()
  if (prof?.role !== 'admin' && prof?.role !== 'sup') {
    return NextResponse.json({ error: 'Hedef girme yetkiniz yok' }, { status: 403 })
  }

  const { type, targets } = await req.json() as {
    type: 'profile' | 'merch'
    targets: Record<string, unknown>[]
  }

  if (type === 'profile') {
    const { error } = await a.sb
      .from('sellout_targets_profile')
      .upsert(targets, { onConflict: 'donem,profile_id,grup' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (type === 'merch') {
    const { error } = await a.sb
      .from('sellout_targets_merch')
      .upsert(targets, { onConflict: 'donem,merch_name,grup' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'Geçersiz type' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
