import { NextResponse } from 'next/server'
import { GRUP_NORMALIZE, SELLOUT_GROUPS } from '@/lib/sellout'
import { gorunurNoktalar, sadeAd } from '@/lib/v2/nokta'
import { noktaModeli } from '@/lib/v2/noktaModel'
import { v2Istek, donemSatirlari, donemGecerli, buDonem, HERKESI_GOREN } from '@/lib/v2/sunucu'

// v2 Raporlar — Sellout: dönemin satış adetleri, şube ve kategori bazında.
// Görünürlük Şubelerim kuralıyla (satırın cari + şubesi kullanıcının şubelerinden biri olmalı).
// GET ?donem=YYYY-MM[&gorunum=<profil id>]

export const maxDuration = 300

interface SubeSatir {
  cariAdi: string
  subeAdi: string
  adetler: Record<string, number>
  toplam: number
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const sp = new URL(req.url).searchParams
  const donem = donemGecerli(sp.get('donem')) ? sp.get('donem')! : buDonem()

  try {
    const [satirlar, model] = await Promise.all([donemSatirlari(donem), noktaModeli()])
    const herkes = HERKESI_GOREN.includes(ctx.ben.role)
    const gorunur = herkes ? null : new Set(
      gorunurNoktalar(model.noktalar, ctx.ben, ctx.profiller, ctx.links)
        .map(n => `${sadeAd(n.cariAdi)}||${sadeAd(n.subeAdi)}`),
    )

    const subeler = new Map<string, SubeSatir>()
    const kategoriToplam: Record<string, number> = {}
    let genel = 0
    for (const r of satirlar) {
      const key = `${sadeAd(r.cari_isim)}||${sadeAd(r.sube_adi)}`
      if (gorunur && !gorunur.has(key)) continue
      const grup = GRUP_NORMALIZE[r.grup_aciklama] ?? (r.grup_aciklama || 'Diğer')
      let s = subeler.get(key)
      if (!s) { s = { cariAdi: r.cari_isim, subeAdi: r.sube_adi, adetler: {}, toplam: 0 }; subeler.set(key, s) }
      s.adetler[grup] = (s.adetler[grup] ?? 0) + r.satilan_adet
      s.toplam += r.satilan_adet
      kategoriToplam[grup] = (kategoriToplam[grup] ?? 0) + r.satilan_adet
      genel += r.satilan_adet
    }

    const kategoriler = [
      ...SELLOUT_GROUPS,
      ...Object.keys(kategoriToplam).filter(k => !(SELLOUT_GROUPS as readonly string[]).includes(k)),
    ]
    return NextResponse.json({
      donem,
      kategoriler,
      kategoriToplam,
      genelToplam: genel,
      subeler: [...subeler.values()].sort((a, b) => b.toplam - a.toplam),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
