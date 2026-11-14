import { NextResponse } from 'next/server'
import { altKullanicilar } from '@/lib/v2/nokta'
import { v2Istek, HERKESI_GOREN, type V2Istek } from '@/lib/v2/sunucu'

// v2 — Talepler: eksik şube talebi ve hatalı bilgi bildirimi.
// GET    → yönetici/İK/yönetim: tümü; diğerleri: kendi talepleri + alt kullanıcılarının talepleri
// POST   { tip, cari_adi?, sube_adi?, aciklama, ilgili_id? } → talep oluştur
// PATCH  { id, durum, cevap? } → yönetici ya da talebi açanın üstü kapatır
// Tablo: v2_talepler (v2_talepler_migration.sql)

const TIPLER = new Set(['eksik_sube', 'hatali_bilgi'])
const DURUMLAR = new Set(['acik', 'cozuldu', 'reddedildi'])

function tabloYok(msg: string, code?: string) {
  return code === '42P01' || code === 'PGRST205' || /v2_talepler/.test(msg) && /exist|find/i.test(msg)
}
const tabloHatasi = () => NextResponse.json(
  { error: 'Talepler tablosu henüz oluşturulmadı (v2_talepler_migration.sql çalıştırılmalı).', tabloYok: true },
  { status: 503 },
)

/** Bu kullanıcının görebileceği/kapatabileceği talep sahipleri (null = herkes) */
function sorumluOlduklari(ctx: V2Istek): Set<string> | null {
  if (HERKESI_GOREN.includes(ctx.ben.role)) return null
  return new Set([ctx.ben.id, ...altKullanicilar(ctx.ben, ctx.profiller, ctx.links).map(a => a.id)])
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const kapsam = sorumluOlduklari(ctx)
  let q = ctx.sb.from('v2_talepler').select('*').order('created_at', { ascending: false }).limit(200)
  if (kapsam) q = q.in('olusturan_id', [...kapsam])
  const { data, error } = await q
  if (error) return tabloYok(error.message, error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })

  const ad = (id: string | null) => (id ? ctx.profiller.find(p => p.id === id)?.full_name ?? '' : '')
  const kapatabilir = (olusturan: string) =>
    ctx.rol === 'admin' || (olusturan !== ctx.ben.id && (kapsam?.has(olusturan) ?? false))
  return NextResponse.json({
    talepler: (data ?? []).map(t => ({
      ...t,
      olusturan_adi: ad(t.olusturan_id),
      ilgili_adi: ad(t.ilgili_id),
      cozen_adi: ad(t.cozen_id),
      kapatabilir: kapatabilir(t.olusturan_id),
    })),
  })
}

export async function POST(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as
    { tip?: string; cari_adi?: string; sube_adi?: string; aciklama?: string; ilgili_id?: string } | null
  const aciklama = (b?.aciklama ?? '').trim().slice(0, 1000)
  if (!b || !TIPLER.has(b.tip ?? '') || !aciklama) {
    return NextResponse.json({ error: 'Açıklama gerekli' }, { status: 400 })
  }
  // ilgili kişi: kendisi ya da alt kullanıcısı
  const kapsam = sorumluOlduklari(ctx)
  const ilgili = b.ilgili_id && (!kapsam || kapsam.has(b.ilgili_id)) ? b.ilgili_id : ctx.ben.id
  const { error } = await ctx.sb.from('v2_talepler').insert({
    tip: b.tip,
    olusturan_id: ctx.kullaniciId,
    ilgili_id: ilgili,
    cari_adi: (b.cari_adi ?? '').trim().slice(0, 200) || null,
    sube_adi: (b.sube_adi ?? '').trim().slice(0, 200) || null,
    aciklama,
  })
  if (error) return tabloYok(error.message, error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as { id?: string; durum?: string; cevap?: string } | null
  if (!b?.id || !DURUMLAR.has(b.durum ?? '')) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const { data: t, error: e1 } = await ctx.sb.from('v2_talepler').select('olusturan_id').eq('id', b.id).single()
  if (e1 || !t) return e1 && tabloYok(e1.message, e1.code) ? tabloHatasi() : NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
  const kapsam = sorumluOlduklari(ctx)
  const yetkili = ctx.rol === 'admin' || (t.olusturan_id !== ctx.kullaniciId && (kapsam?.has(t.olusturan_id) ?? false))
  if (!yetkili) return NextResponse.json({ error: 'Bu talebi kapatma yetkiniz yok' }, { status: 403 })

  const { error } = await ctx.sb.from('v2_talepler').update({
    durum: b.durum,
    cevap: (b.cevap ?? '').trim().slice(0, 1000) || null,
    cozen_id: b.durum === 'acik' ? null : ctx.kullaniciId,
    updated_at: new Date().toISOString(),
  }).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
