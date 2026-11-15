import { NextResponse } from 'next/server'
import { v2Istek } from '@/lib/v2/sunucu'
import { bildirimHazirMi, VAPID_PUBLIC_KEY } from '@/lib/v2/bildirim'

// v2 — telefona bildirim aboneliği (oturumdaki kullanıcı için).
// GET    → { hazir, publicKey, aboneSayisi }
// POST   { endpoint, keys: { p256dh, auth }, cihaz? } → abone et
// DELETE { endpoint } → aboneliği kaldır

function tabloYok(code?: string) { return code === '42P01' || code === 'PGRST205' }

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const { count, error } = await ctx.sb.from('v2_push_abonelik')
    .select('id', { count: 'exact', head: true }).eq('profile_id', ctx.kullaniciId)
  return NextResponse.json({
    hazir: bildirimHazirMi(),
    tabloYok: tabloYok(error?.code),
    publicKey: VAPID_PUBLIC_KEY,
    aboneSayisi: count ?? 0,
  })
}

export async function POST(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as
    { endpoint?: string; keys?: { p256dh?: string; auth?: string }; cihaz?: string } | null
  if (!b?.endpoint || !b.keys?.p256dh || !b.keys?.auth || !/^https:\/\//.test(b.endpoint)) {
    return NextResponse.json({ error: 'Geçersiz abonelik' }, { status: 400 })
  }
  const { error } = await ctx.sb.from('v2_push_abonelik').upsert({
    profile_id: ctx.kullaniciId,
    endpoint: b.endpoint,
    p256dh: b.keys.p256dh,
    auth: b.keys.auth,
    cihaz: (b.cihaz ?? '').slice(0, 200) || null,
  }, { onConflict: 'endpoint' })
  if (error) {
    return NextResponse.json(
      { error: tabloYok(error.code) ? 'Bildirim tablosu henüz oluşturulmadı (v2_push_migration.sql).' : error.message },
      { status: tabloYok(error.code) ? 503 : 500 },
    )
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as { endpoint?: string } | null
  if (!b?.endpoint) return NextResponse.json({ error: 'endpoint gerekli' }, { status: 400 })
  await ctx.sb.from('v2_push_abonelik').delete().eq('endpoint', b.endpoint).eq('profile_id', ctx.kullaniciId)
  return NextResponse.json({ ok: true })
}
