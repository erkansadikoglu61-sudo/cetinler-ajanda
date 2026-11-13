import { NextResponse } from 'next/server'
import { BSY_NAME_TO_KOD, PRIM_EXCLUDED_BSYS, bsyDonemdeGorunur } from '@/lib/bsy'
import { GRUP_NORMALIZE, namesMatch } from '@/lib/sellout'
import {
  BSY_ADET_KATEGORILER, BSY_ADET_PARAMS, bsyAdetDurum, bsyAdetHesapla,
} from '@/lib/v2/bsyAdetPrim'
import { v2Istek, donemSatirlari, donemGecerli, buDonem } from '@/lib/v2/sunucu'
import type { V2Profil } from '@/lib/v2/nokta'

// v2 — BSY adet primi.
// GET  ?donem=YYYY-MM[&gorunum=<profil id>]
//      Yönetici / İK / Yönetim: tüm BSY'ler; BSY: yalnızca kendisi.
// POST { donem, hedefler: [{ profile_id, grup, hedef }] } — yalnızca yönetici.
// Hedefler sellout_targets_profile tablosunda (BSY profil id'siyle) tutulur;
// Süpervizör/Jr hedefleriyle aynı yapı, ayrı tablo gerekmez.

export const maxDuration = 300

const KATEGORI_SET = new Set(BSY_ADET_KATEGORILER.map(k => k.grup))

function primliBsylar(profiller: V2Profil[], donem: string): (V2Profil & { kod: string })[] {
  const [y, m] = donem.split('-').map(Number)
  return profiller
    .filter(p => p.role === 'bsy')
    .map(p => ({ ...p, kod: BSY_NAME_TO_KOD[p.full_name.toLocaleLowerCase('tr')] ?? '' }))
    .filter(p => p.kod)
    .filter(p => !PRIM_EXCLUDED_BSYS.some(x => namesMatch(x, p.full_name)))
    .filter(p => bsyDonemdeGorunur(p.full_name, y, m))
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const sp = new URL(req.url).searchParams
  const donem = donemGecerli(sp.get('donem')) ? sp.get('donem')! : buDonem()

  const tumBsylar = primliBsylar(ctx.profiller, donem)
  const herkesi = ['admin', 'ik', 'manager'].includes(ctx.ben.role)
  const bsylar = herkesi ? tumBsylar : tumBsylar.filter(b => b.id === ctx.ben.id)

  try {
    const [hedefRes, satirlar] = await Promise.all([
      bsylar.length
        ? ctx.sb.from('sellout_targets_profile').select('profile_id, grup, hedef')
            .eq('donem', donem).in('profile_id', bsylar.map(b => b.id))
        : Promise.resolve({ data: [] as { profile_id: string; grup: string; hedef: number }[] }),
      bsylar.length ? donemSatirlari(donem) : Promise.resolve([]),
    ])

    // Gerçekleşme: satırın BSY kodu (oluştuğu andaki BSY; Evkur dönem kuralı dahil)
    const gercByKod = new Map<string, Record<string, number>>()
    for (const r of satirlar) {
      const grup = GRUP_NORMALIZE[r.grup_aciklama]
      if (!grup || !KATEGORI_SET.has(grup)) continue
      const kod = (r.bsy ?? '').trim().toUpperCase()
      if (!kod) continue
      let g = gercByKod.get(kod)
      if (!g) { g = {}; gercByKod.set(kod, g) }
      g[grup] = (g[grup] ?? 0) + r.satilan_adet
    }

    const hedefler = (hedefRes.data ?? []) as { profile_id: string; grup: string; hedef: number }[]
    const sonuc = bsylar.map(b => {
      const h: Record<string, number> = {}
      for (const t of hedefler) if (t.profile_id === b.id) h[t.grup] = Number(t.hedef) || 0
      const hesap = bsyAdetHesapla(h, gercByKod.get(b.kod.toUpperCase()) ?? {})
      return { profileId: b.id, ad: b.full_name, kod: b.kod, ...hesap }
    }).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))

    return NextResponse.json({
      donem,
      durum: bsyAdetDurum(donem),
      params: BSY_ADET_PARAMS,
      kategoriler: BSY_ADET_KATEGORILER,
      bsylar: sonuc,
      hedefGirebilir: ctx.rol === 'admin',
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const ctx = await v2Istek(req, ['admin'])
  if (ctx instanceof NextResponse) return ctx
  const body = await req.json().catch(() => null) as
    { donem?: string; hedefler?: { profile_id: string; grup: string; hedef: number }[] } | null
  if (!body || !donemGecerli(body.donem ?? null) || !Array.isArray(body.hedefler)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }
  const donem = body.donem!
  const gecerliIdler = new Set(primliBsylar(ctx.profiller, donem).map(b => b.id))
  const satirlar = []
  for (const t of body.hedefler) {
    const hedef = Math.round(Number(t.hedef))
    if (!gecerliIdler.has(t.profile_id) || !KATEGORI_SET.has(t.grup) || !(hedef >= 0)) {
      return NextResponse.json({ error: `Geçersiz hedef: ${t.grup}` }, { status: 400 })
    }
    satirlar.push({ donem, profile_id: t.profile_id, grup: t.grup, hedef, entered_by: ctx.kullaniciId })
  }
  if (satirlar.length === 0) return NextResponse.json({ ok: true, count: 0 })
  const { error } = await ctx.sb
    .from('sellout_targets_profile')
    .upsert(satirlar, { onConflict: 'donem,profile_id,grup' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: satirlar.length })
}
