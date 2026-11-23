import { NextResponse } from 'next/server'
import { altKullanicilar } from '@/lib/v2/nokta'
import { v2Istek, HERKESI_GOREN, type V2Istek } from '@/lib/v2/sunucu'
import { bildirimGonder } from '@/lib/v2/bildirim'

// v2 — Talepler: eksik şube talebi ve hatalı bilgi bildirimi.
// GET    → yönetici/İK/yönetim: tümü; diğerleri: kendi talepleri + alt kullanıcılarının talepleri
// POST   { tip, cari_adi?, sube_adi?, aciklama, ilgili_id? } → talep oluştur
// PATCH  { id, durum, cevap? } → yönetici; talebin ilgili olduğu kişinin kendisi ve bağlı olduğu
//          Jr / süpervizör; ya da talebi açanın üstü kapatır
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

/** Kişinin bağlı olduğu Jr ve süpervizör (manager_id zinciri, süpervizörde durur) */
function bagliUstler(ctx: V2Istek, kisiId: string): string[] {
  const ustler: string[] = []
  let p = ctx.profiller.find(x => x.id === kisiId)
  for (let i = 0; i < 3 && p && p.role !== 'sup' && p.manager_id; i++) {
    const ust = ctx.profiller.find(x => x.id === p!.manager_id)
    if (!ust || (ust.role !== 'jr' && ust.role !== 'sup')) break
    ustler.push(ust.id)
    p = ust
  }
  return ustler
}

/** Ben bu kişinin kendisi ya da bağlı olduğu Jr / süpervizör müyüm? */
function kisidenSorumlu(ctx: V2Istek, kisiId: string | null): boolean {
  if (!kisiId) return false
  return kisiId === ctx.ben.id || bagliUstler(ctx, kisiId).includes(ctx.ben.id)
}

function kapatabilirMi(ctx: V2Istek, kapsam: Set<string> | null, t: { olusturan_id: string; ilgili_id: string | null }): boolean {
  return ctx.rol === 'admin'
    || kisidenSorumlu(ctx, t.ilgili_id)
    || (t.olusturan_id !== ctx.ben.id && (kapsam?.has(t.olusturan_id) ?? false))
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const kapsam = sorumluOlduklari(ctx)
  const { data, error } = await ctx.sb.from('v2_talepler').select('*')
    .order('created_at', { ascending: false }).limit(kapsam ? 1000 : 200)
  if (error) return tabloYok(error.message, error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })
  // Görünür: kendi açtıkları + alt kullanıcılarının açtıkları + kendisi/bağlı kişileri hakkındakiler
  const gorunur = (data ?? []).filter(t => !kapsam
    || kapsam.has(t.olusturan_id)
    || kisidenSorumlu(ctx, t.olusturan_id)
    || kisidenSorumlu(ctx, t.ilgili_id)).slice(0, 200)

  const ad = (id: string | null) => (id ? ctx.profiller.find(p => p.id === id)?.full_name ?? '' : '')
  return NextResponse.json({
    talepler: gorunur.map(t => ({
      ...t,
      olusturan_adi: ad(t.olusturan_id),
      ilgili_adi: ad(t.ilgili_id),
      cozen_adi: ad(t.cozen_id),
      kapatabilir: kapatabilirMi(ctx, kapsam, t),
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

  // Bildirim: ilgili kişi, bağlı olduğu Jr / süpervizör, üstü + yöneticiler (talebi açan hariç)
  const ilgiliP = ctx.profiller.find(p => p.id === ilgili)
  const ustId = ilgiliP?.role === 'sup'
    ? ctx.links.find(l => l.sup_id === ilgiliP.id)?.bsy_id
    : ilgiliP?.manager_id ?? undefined
  const alicilar = [
    ilgili, ...bagliUstler(ctx, ilgili),
    ...(ustId ? [ustId] : []),
    ...ctx.profiller.filter(p => p.role === 'admin').map(p => p.id),
  ].filter((id, i, a) => id !== ctx.kullaniciId && a.indexOf(id) === i)
  const acan = ctx.profiller.find(p => p.id === ctx.kullaniciId)?.full_name ?? ''
  await bildirimGonder(ctx.sb, alicilar, {
    baslik: b.tip === 'eksik_sube' ? 'Eksik şube talebi' : 'Hatalı bilgi bildirimi',
    govde: `${acan}: ${[b.cari_adi, b.sube_adi].filter(Boolean).join(' / ') || aciklama.slice(0, 120)}`,
    url: '/v2',
  }).catch(() => 0)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as { id?: string; durum?: string; cevap?: string } | null
  if (!b?.id || !DURUMLAR.has(b.durum ?? '')) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const { data: t, error: e1 } = await ctx.sb.from('v2_talepler').select('olusturan_id, ilgili_id').eq('id', b.id).single()
  if (e1 || !t) return e1 && tabloYok(e1.message, e1.code) ? tabloHatasi() : NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
  const kapsam = sorumluOlduklari(ctx)
  const yetkili = kapatabilirMi(ctx, kapsam, t)
  if (!yetkili) return NextResponse.json({ error: 'Bu talebi kapatma yetkiniz yok' }, { status: 403 })

  const { error } = await ctx.sb.from('v2_talepler').update({
    durum: b.durum,
    cevap: (b.cevap ?? '').trim().slice(0, 1000) || null,
    cozen_id: b.durum === 'acik' ? null : ctx.kullaniciId,
    updated_at: new Date().toISOString(),
  }).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bildirim: talebi açana sonucu
  if (b.durum !== 'acik' && t.olusturan_id !== ctx.kullaniciId) {
    await bildirimGonder(ctx.sb, [t.olusturan_id], {
      baslik: b.durum === 'cozuldu' ? 'Talebiniz çözüldü' : 'Talebiniz reddedildi',
      govde: (b.cevap ?? '').trim().slice(0, 140) || 'Ayrıntılar Şubelerim ▸ Talepler\'de.',
      url: '/v2',
    }).catch(() => 0)
  }
  return NextResponse.json({ ok: true })
}
