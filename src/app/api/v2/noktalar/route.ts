import { NextResponse } from 'next/server'
import { gorunurNoktalar, sadeAd, altKullanicilar } from '@/lib/v2/nokta'
import { noktaModeli } from '@/lib/v2/noktaModel'
import { v2Istek } from '@/lib/v2/sunucu'
import { namesMatch } from '@/lib/sellout'

// v2 — tek "şube → kullanıcılar" kaynağı (model: lib/v2/noktaModel).
// Görünürlük sunucuda uygulanır (lib/v2/nokta gorunurNoktalar); istemciye
// yalnızca görebildiği noktalar gider. IBAN yalnızca kişinin kendi kaydında döner.

export const maxDuration = 300

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const yenile = new URL(req.url).searchParams.get('yenile') === '1'
  const { ben, profiller, links } = ctx

  try {
    const model = await noktaModeli(yenile)
    const noktalar = gorunurNoktalar(model.noktalar, ben, profiller, links)

    // Hesabım kimlik kartı
    const ust = ben.role === 'sup'
      ? profiller.find(p => p.id === links.find(l => l.sup_id === ben.id)?.bsy_id)
      : ben.manager_id ? profiller.find(p => p.id === ben.manager_id) : undefined
    const merchKaydi = model.merchKayitlari.filter(m => namesMatch(m.ad, ben.full_name))
    const iban = merchKaydi.map(m => m.iban).find(i => /^TR\d{24}$/i.test(i.replace(/\s/g, ''))) ?? ''
    const altlar = altKullanicilar(ben, profiller, links)

    return NextResponse.json({
      kullanici: {
        id: ben.id,
        ad: ben.full_name,
        rol: ben.role,
        ust: ust?.full_name ?? null,
        altlar: altlar.map(a => ({ id: a.id, ad: a.full_name, rol: a.role })),
        iban,
        merchId: merchKaydi.find(m => m.merchId)?.merchId ?? '',
      },
      noktalar,
      ozet: {
        nokta: noktalar.length,
        cari: new Set(noktalar.map(n => sadeAd(n.cariAdi))).size,
        kendi: noktalar.filter(n => n.kapsam === 'kendi').length,
        ekip: noktalar.filter(n => n.kapsam === 'ekip').length,
      },
      // Yalnızca admin: veri tutarlılığı (v2 "karmaşa" listesi)
      kontrol: ctx.rol === 'admin' ? {
        toplamNokta: model.noktalar.length,
        bsySiz: model.noktalar.filter(n => !n.bsyKod && !n.bsyAdi).length,
        supSiz: model.noktalar.filter(n => n.sups.length === 0).length,
        subeKodsuz: model.noktalar.filter(n => !n.subeKod).length,
        eslesmeyenDestek: model.eslesmeyenDestek,
      } : undefined,
      guncelleme: new Date(model.zaman).toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
