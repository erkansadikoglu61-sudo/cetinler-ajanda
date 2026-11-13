import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'
import { GRUP_NORMALIZE, namesMatch } from '@/lib/sellout'
import { computeSelloutPrimForMonth, type PrimTip, type NPMerchDetay } from '@/lib/nihaiPrim'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'
import { MERCH_DETAY_URL } from '@/lib/selloutData'
import type { Profile } from '@/lib/supabase'
import { bsyAdetDurum, bsyAdetHesapla } from '@/lib/v2/bsyAdetPrim'
import { v2Istek, donemSatirlari } from '@/lib/v2/sunucu'
import { GET as nihaiBsyGet } from '@/app/api/nihai-prim-bsy/route'

// v2 — Hesabım: bu ayın anlık hakedişi + son 3 ay (ödendi / bekliyor).
// Rakamlar v1 Nihai Prim Listesi ile aynı kaynaktan hesaplanır:
//  - Süpervizör / Jr / Çetinler Merch: lib/nihaiPrim computeSelloutPrimForMonth
//  - BSY: ciro primi (/api/nihai-prim-bsy motoru); Kasım 2026+ adet primi
//    simülasyonu yanında gösterilir, 2027 Ocak'tan itibaren adet primi esas alınır.
//  - Ek prim: nihai_prim_ek; ödeme durumu: nihai_prim_odeme.

export const maxDuration = 300

const ROL_TIP: Record<string, PrimTip> = {
  bsy: 'BSY', sup: 'Süpervizör', jr: 'Jr. Süpervizör', merch: 'Çetinler Merch',
}

const pad = (n: number) => String(n).padStart(2, '0')

function sonAylar(adet: number): { yil: number; ay: number; donem: string }[] {
  const d = new Date()
  const out = []
  for (let i = 0; i < adet; i++) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ yil: t.getFullYear(), ay: t.getMonth() + 1, donem: `${t.getFullYear()}-${pad(t.getMonth() + 1)}` })
  }
  return out
}

let mdCache: { at: number; rows: NPMerchDetay[] } | null = null
async function merchDetay(): Promise<NPMerchDetay[]> {
  if (mdCache && Date.now() - mdCache.at < 10 * 60 * 1000) return mdCache.rows
  const { rows } = parseHtmlTableByHeader(await fetchPhpHtml(MERCH_DETAY_URL))
  const out = rows.map(r => ({
    merch_adi: (r['MERCH_ADI'] ?? '').trim(),
    merch_grubu: (r['MERCH_TIPI'] ?? '').trim(),
    sup_adi: (r['SUPERVIZOR'] ?? '').trim(),
    jr_adi: (r['JR_SUPERVIZOR'] ?? '').trim(),
  })).filter(r => r.merch_adi)
  mdCache = { at: Date.now(), rows: out }
  return out
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const tip = ROL_TIP[ctx.ben.role]
  const aylar = sonAylar(4)
  if (!tip) return NextResponse.json({ tip: null, aylar: [] })

  // Ödeme / ek prim kayıtları service role ile okunur (v1 uçlarıyla aynı)
  const sbSrv = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const yillar = [...new Set(aylar.map(a => a.yil))]

  try {
    const [odemeRes, ekRes] = await Promise.all([
      sbSrv.from('nihai_prim_odeme').select('yil, ay, kullanici_tipi, kullanici_adi, odendi, odeme_tarihi')
        .in('yil', yillar).eq('kullanici_tipi', tip),
      sbSrv.from('nihai_prim_ek').select('yil, ay, kullanici_tipi, kullanici_adi, tutar')
        .in('yil', yillar).eq('kullanici_tipi', tip),
    ])
    const benimMi = (ad: string) => namesMatch(ad, ctx.ben.full_name)
    const odemeler = (odemeRes.data ?? []).filter(r => benimMi(r.kullanici_adi))
    const ekler = (ekRes.data ?? []).filter(r => benimMi(r.kullanici_adi))

    // Ay bazında hesaplanan prim
    const primByDonem = new Map<string, number>()
    const adetSimByDonem = new Map<string, number>()

    if (tip === 'BSY') {
      // Ciro primi (yıl bazında tek Excel okuması)
      for (const y of yillar) {
        if (aylar.every(a => a.yil !== y || bsyAdetDurum(a.donem) === 'canli')) continue
        try {
          const res = await nihaiBsyGet(new Request(`http://v2.local/api/nihai-prim-bsy?yil=${y}`))
          const json = await res.json() as { rows?: { bsyAdi: string; aylar: Record<number, number> }[] }
          const r = (json.rows ?? []).find(x => benimMi(x.bsyAdi))
          for (const a of aylar) if (a.yil === y && r) primByDonem.set(a.donem, Number(r.aylar[a.ay]) || 0)
        } catch { /* ciro primi alınamadı */ }
      }
      // Adet primi (simülasyon / canlı)
      const kod = (BSY_NAME_TO_KOD[ctx.ben.full_name.toLocaleLowerCase('tr')] ?? '').toUpperCase()
      for (const a of aylar) {
        const durum = bsyAdetDurum(a.donem)
        if (durum === 'yok' || !kod) continue
        const [hRes, satirlar] = await Promise.all([
          ctx.sb.from('sellout_targets_profile').select('grup, hedef').eq('donem', a.donem).eq('profile_id', ctx.ben.id),
          donemSatirlari(a.donem),
        ])
        const h: Record<string, number> = {}
        for (const t of hRes.data ?? []) h[t.grup] = Number(t.hedef) || 0
        const g: Record<string, number> = {}
        for (const r of satirlar) {
          if ((r.bsy ?? '').trim().toUpperCase() !== kod) continue
          const grup = GRUP_NORMALIZE[r.grup_aciklama]
          if (grup) g[grup] = (g[grup] ?? 0) + r.satilan_adet
        }
        const prim = bsyAdetHesapla(h, g).toplamPrim
        if (durum === 'canli') primByDonem.set(a.donem, prim)
        else adetSimByDonem.set(a.donem, prim)
      }
    } else {
      const md = await merchDetay()
      for (const a of aylar) {
        const [pRes, mRes, satirlar] = await Promise.all([
          ctx.sb.from('sellout_targets_profile').select('profile_id, grup, hedef').eq('donem', a.donem),
          ctx.sb.from('sellout_targets_merch').select('merch_name, grup, hedef').eq('donem', a.donem),
          donemSatirlari(a.donem),
        ])
        const kisiler = computeSelloutPrimForMonth({
          periodRows: satirlar,
          profileTargets: (pRes.data ?? []) as { profile_id: string; grup: string; hedef: number }[],
          merchTargets: (mRes.data ?? []) as { merch_name: string; grup: string; hedef: number }[],
          merchDetay: md,
          team: ctx.profiller as unknown as Profile[],
          donem: a.donem,
        })
        const ben = kisiler.find(k => k.tip === tip && (k.selfProfileId ? k.selfProfileId === ctx.ben.id : benimMi(k.ad)))
        primByDonem.set(a.donem, ben?.prim ?? 0)
      }
    }

    const buAy = aylar[0].donem
    const sonuc = aylar.map(a => {
      const prim = Math.round((primByDonem.get(a.donem) ?? 0) * 100) / 100
      const ekPrim = ekler.filter(e => e.yil === a.yil && e.ay === a.ay).reduce((t, e) => t + (Number(e.tutar) || 0), 0)
      const od = odemeler.find(o => o.yil === a.yil && o.ay === a.ay)
      const durum = a.donem === buAy ? 'devam' : od?.odendi ? 'odendi' : 'bekliyor'
      return {
        donem: a.donem, yil: a.yil, ay: a.ay,
        prim, ekPrim, toplam: prim + ekPrim,
        durum, odemeTarihi: od?.odendi ? od.odeme_tarihi : null,
        adetSimulasyon: adetSimByDonem.has(a.donem) ? adetSimByDonem.get(a.donem)! : null,
      }
    })

    return NextResponse.json({ tip, aylar: sonuc })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
