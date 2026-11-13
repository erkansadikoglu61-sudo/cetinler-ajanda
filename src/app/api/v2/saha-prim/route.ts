import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gorunurNoktalar, sadeAd } from '@/lib/v2/nokta'
import { noktaModeli } from '@/lib/v2/noktaModel'
import { v2Istek, donemGecerli, buDonem, HERKESI_GOREN } from '@/lib/v2/sunucu'
import { GET as bayiMerchPrimGet } from '@/app/api/bayi-merch-prim/route'

// v2 — Bayi Merch ve Destek Personeli hakedişleri (şube bazlı, salt okunur).
//  - Bayi Merch: v1 /api/bayi-merch-prim motoru (özel kurallar, EKSTRA çarpan dahil)
//  - Destek: destek_hakedis (v1 Destek Personelleri Hakediş ekranında onaylanan tutarlar)
// Görünürlük: kişinin Şubelerim'deki şubeleri (lib/v2/nokta gorunurNoktalar).

export const maxDuration = 300

interface SahaKisi { ad: string; hakedis: number; adet?: number }
interface SahaSube {
  key: string
  cariAdi: string
  subeAdi: string
  bayiMerch: SahaKisi[]
  destek: SahaKisi[]
  toplam: number
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req, ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr'])
  if (ctx instanceof NextResponse) return ctx
  const sp = new URL(req.url).searchParams
  const donem = donemGecerli(sp.get('donem')) ? sp.get('donem')! : buDonem()
  const [yil, ay] = donem.split('-').map(Number)

  const sbSrv = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )

  try {
    const [bayiRes, destekRes, model] = await Promise.all([
      bayiMerchPrimGet(new Request(`http://v2.local/api/bayi-merch-prim?yil=${yil}&ay=${ay}`)),
      sbSrv.from('destek_hakedis').select('cari_adi, sube_adi, merch_adi, hakedis').eq('yil', yil).eq('ay', ay),
      noktaModeli(),
    ])
    const bayiJson = await bayiRes.json() as {
      rows?: { cariAdi: string; subeAdi: string; bayiMerch: string; primHakdis: number; satisAdet: number }[]
      error?: string
    }
    if (!bayiRes.ok) throw new Error(bayiJson.error || 'Bayi Merch primi alınamadı')

    // Görünür şubeler (cari + şube adı anahtarı)
    const herkes = HERKESI_GOREN.includes(ctx.ben.role)
    const gorunur = herkes ? null : new Set(
      gorunurNoktalar(model.noktalar, ctx.ben, ctx.profiller, ctx.links)
        .map(n => `${sadeAd(n.cariAdi)}||${sadeAd(n.subeAdi)}`),
    )

    const subeler = new Map<string, SahaSube>()
    const subeAl = (cari: string, sube: string): SahaSube | null => {
      const key = `${sadeAd(cari)}||${sadeAd(sube)}`
      if (gorunur && !gorunur.has(key)) return null
      let s = subeler.get(key)
      if (!s) { s = { key, cariAdi: cari, subeAdi: sube, bayiMerch: [], destek: [], toplam: 0 }; subeler.set(key, s) }
      return s
    }

    for (const r of bayiJson.rows ?? []) {
      if (!(r.primHakdis > 0)) continue
      const s = subeAl(r.cariAdi, r.subeAdi)
      if (!s) continue
      const mevcut = s.bayiMerch.find(k => sadeAd(k.ad) === sadeAd(r.bayiMerch))
      if (mevcut) { mevcut.hakedis += r.primHakdis; mevcut.adet = (mevcut.adet ?? 0) + r.satisAdet }
      else s.bayiMerch.push({ ad: r.bayiMerch, hakedis: r.primHakdis, adet: r.satisAdet })
      s.toplam += r.primHakdis
    }
    for (const d of destekRes.data ?? []) {
      const tutar = Number(d.hakedis) || 0
      if (!(tutar > 0)) continue
      const s = subeAl(d.cari_adi ?? '', d.sube_adi ?? '')
      if (!s) continue
      s.destek.push({ ad: d.merch_adi ?? '', hakedis: tutar })
      s.toplam += tutar
    }

    const liste = [...subeler.values()].sort((a, b) =>
      a.cariAdi.localeCompare(b.cariAdi, 'tr') || a.subeAdi.localeCompare(b.subeAdi, 'tr'))
    return NextResponse.json({
      donem,
      subeler: liste,
      ozet: {
        bayiMerch: liste.reduce((t, s) => t + s.bayiMerch.reduce((u, k) => u + k.hakedis, 0), 0),
        destek: liste.reduce((t, s) => t + s.destek.reduce((u, k) => u + k.hakedis, 0), 0),
        kisi: liste.reduce((t, s) => t + s.bayiMerch.length + s.destek.length, 0),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
