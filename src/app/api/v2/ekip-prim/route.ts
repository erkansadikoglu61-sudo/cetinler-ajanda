import { NextResponse } from 'next/server'
import {
  SELLOUT_GROUPS, PRIM_SUP, PRIM_JR, PRIM_MERCH, namesMatch, donemdeAktif,
  type SelloutGroup,
} from '@/lib/sellout'
import { computeSelloutPrimForMonth, type NPKisiPrim } from '@/lib/nihaiPrim'
import type { Profile } from '@/lib/supabase'
import { altKullanicilar } from '@/lib/v2/nokta'
import {
  v2Istek, donemSatirlari, merchDetay, donemGecerli, buDonem, HERKESI_GOREN, type V2Istek,
} from '@/lib/v2/sunucu'

// v2 — Süpervizör / Jr. Süpervizör / Çetinler Merch adet primi (kategori detaylı).
// Hesap v1 Sellout & Nihai Prim ile aynı motordan (lib/nihaiPrim).
// GET  ?donem=YYYY-MM[&gorunum=<profil id>]
// POST { donem, profil: [{ profile_id, grup, hedef }], merch: [{ merch_name, grup, hedef }] }
//      Yönetici: herkes. Süpervizör: kendisi, Jr'ları ve ekibindeki Çetinler Merch'ler
//      (v1 "Hedef Gir" yetkisiyle aynı roller).

export const maxDuration = 300

const KATEGORI_PRIMI: Record<NPKisiPrim['tip'], Record<SelloutGroup, number> | null> = {
  'Süpervizör': PRIM_SUP, 'Jr. Süpervizör': PRIM_JR, 'Çetinler Merch': PRIM_MERCH, 'BSY': null,
}

interface Hesap {
  kisiler: NPKisiPrim[]
}

async function hesapla(ctx: V2Istek, donem: string): Promise<Hesap> {
  const [pRes, mRes, satirlar, md] = await Promise.all([
    ctx.sb.from('sellout_targets_profile').select('profile_id, grup, hedef').eq('donem', donem),
    ctx.sb.from('sellout_targets_merch').select('merch_name, grup, hedef').eq('donem', donem),
    donemSatirlari(donem),
    merchDetay(),
  ])
  const kisiler = computeSelloutPrimForMonth({
    periodRows: satirlar,
    profileTargets: (pRes.data ?? []) as { profile_id: string; grup: string; hedef: number }[],
    merchTargets: (mRes.data ?? []) as { merch_name: string; grup: string; hedef: number }[],
    merchDetay: md,
    team: ctx.profiller as unknown as Profile[],
    donem,
  }).filter(k => donemdeAktif(k.ad, donem))
  return { kisiler }
}

/** Görüntüleyen kullanıcının görebileceği kişiler (hiyerarşi) */
function gorunurKisiler(ctx: V2Istek, kisiler: NPKisiPrim[]): NPKisiPrim[] {
  const ben = ctx.ben
  if (HERKESI_GOREN.includes(ben.role)) return kisiler
  const altlar = altKullanicilar(ben, ctx.profiller, ctx.links)
  const supAdlari = [...(ben.role === 'sup' ? [ben.full_name] : []), ...altlar.filter(a => a.role === 'sup').map(a => a.full_name)]
  const jrAdlari = [...(ben.role === 'jr' ? [ben.full_name] : []), ...altlar.filter(a => a.role === 'jr').map(a => a.full_name)]
  const profilIdleri = new Set([ben.id, ...altlar.map(a => a.id)])
  const icinde = (ad: string | undefined, liste: string[]) => !!ad && liste.some(x => namesMatch(x, ad))
  return kisiler.filter(k => {
    if (k.selfProfileId) return profilIdleri.has(k.selfProfileId)
    if (ben.role === 'merch') return namesMatch(k.ad, ben.full_name)
    return icinde(k.ownerSupAd, supAdlari) || icinde(k.ownerJrAd, jrAdlari)
  })
}

function hedefYetkisi(ctx: V2Istek): boolean {
  return ctx.rol === 'admin' || (ctx.rol === 'sup' && ctx.ben.id === ctx.kullaniciId)
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const sp = new URL(req.url).searchParams
  const donem = donemGecerli(sp.get('donem')) ? sp.get('donem')! : buDonem()
  try {
    const { kisiler } = await hesapla(ctx, donem)
    const sira: Record<string, number> = { 'Süpervizör': 0, 'Jr. Süpervizör': 1, 'Çetinler Merch': 2 }
    const sonuc = gorunurKisiler(ctx, kisiler)
      .map(k => {
        const kp = KATEGORI_PRIMI[k.tip]
        return {
          key: k.selfProfileId ? `p:${k.selfProfileId}` : `m:${k.ad}`,
          tip: k.tip,
          ad: k.ad,
          profileId: k.selfProfileId ?? null,
          ownerSupAd: k.ownerSupAd ?? null,
          ownerJrAd: k.ownerJrAd ?? null,
          prim: k.prim,
          kategoriler: (k.kategoriler ?? []).map(c => ({
            ...c,
            kategoriPrimi: kp?.[c.grup as SelloutGroup] ?? 0,
            oran: c.hedef > 0 ? c.gerc / c.hedef : null,
          })),
        }
      })
      .sort((a, b) => (sira[a.tip] ?? 9) - (sira[b.tip] ?? 9) || a.ad.localeCompare(b.ad, 'tr'))
    return NextResponse.json({ donem, gruplar: SELLOUT_GROUPS, kisiler: sonuc, hedefGirebilir: hedefYetkisi(ctx) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const ctx = await v2Istek(req, ['admin', 'sup'])
  if (ctx instanceof NextResponse) return ctx
  if (!hedefYetkisi(ctx)) return NextResponse.json({ error: 'Hedef girme yetkiniz yok' }, { status: 403 })
  const body = await req.json().catch(() => null) as {
    donem?: string
    profil?: { profile_id: string; grup: string; hedef: number }[]
    merch?: { merch_name: string; grup: string; hedef: number }[]
  } | null
  if (!body || !donemGecerli(body.donem ?? null)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  const donem = body.donem!
  const gruplar = new Set<string>(SELLOUT_GROUPS)

  try {
    // Yalnızca görebildiği kişilere hedef girebilir
    const { kisiler } = await hesapla(ctx, donem)
    const gorunur = gorunurKisiler(ctx, kisiler)
    const profilIdleri = new Set(gorunur.filter(k => k.selfProfileId).map(k => k.selfProfileId!))
    const merchler = new Map(gorunur.filter(k => k.tip === 'Çetinler Merch').map(k => [k.ad, k]))

    const temiz = (h: number) => Math.max(0, Math.round(Number(h) || 0))
    const pSatir = []
    for (const t of body.profil ?? []) {
      if (!profilIdleri.has(t.profile_id) || !gruplar.has(t.grup)) {
        return NextResponse.json({ error: 'Bu kişiye hedef girilemez' }, { status: 403 })
      }
      pSatir.push({ donem, profile_id: t.profile_id, grup: t.grup, hedef: temiz(t.hedef), entered_by: ctx.kullaniciId })
    }
    const mSatir = []
    for (const t of body.merch ?? []) {
      const m = merchler.get(t.merch_name)
      if (!m || !gruplar.has(t.grup)) return NextResponse.json({ error: 'Bu kişiye hedef girilemez' }, { status: 403 })
      mSatir.push({
        donem, merch_name: t.merch_name, supervisor_name: m.ownerSupAd ?? null,
        grup: t.grup, hedef: temiz(t.hedef), entered_by: ctx.kullaniciId,
      })
    }
    if (pSatir.length) {
      const { error } = await ctx.sb.from('sellout_targets_profile').upsert(pSatir, { onConflict: 'donem,profile_id,grup' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (mSatir.length) {
      const { error } = await ctx.sb.from('sellout_targets_merch').upsert(mSatir, { onConflict: 'donem,merch_name,grup' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: pSatir.length + mSatir.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
