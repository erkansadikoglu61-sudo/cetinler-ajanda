import { NextResponse } from 'next/server'
import { gorunurNoktalar, altKullanicilar, cariyeGoreGrupla } from '@/lib/v2/nokta'
import { noktaModeli } from '@/lib/v2/noktaModel'
import { v2Istek } from '@/lib/v2/sunucu'

// v2 Ajanda — görev penceresinin şube listesi.
// Şubelerim ile AYNI kaynak ve AYNI kural: görev kime açılıyorsa (kisi) onun
// Şubelerim'inde gördüğü her şube seçilebilir. kisi: kendisi ya da alt kullanıcısı
// (yönetici herkes için).
// GET ?kisi=<profil id>[&gorunum=<profil id>]

export const maxDuration = 300

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const kisiId = new URL(req.url).searchParams.get('kisi') || ctx.ben.id
  const izinli = kisiId === ctx.ben.id
    || ctx.rol === 'admin'
    || altKullanicilar(ctx.ben, ctx.profiller, ctx.links).some(a => a.id === kisiId)
  if (!izinli) return NextResponse.json({ error: 'Bu kişi için görev açılamaz' }, { status: 403 })
  const kisi = ctx.profiller.find(p => p.id === kisiId)
  if (!kisi) return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 })

  try {
    const model = await noktaModeli()
    const gruplar = cariyeGoreGrupla(gorunurNoktalar(model.noktalar, kisi, ctx.profiller, ctx.links))
    return NextResponse.json({
      kisi: kisi.full_name,
      gruplar: gruplar.map(g => ({
        cariAdi: g.cariAdi,
        subeler: g.noktalar.map(n => ({ key: n.key, subeAdi: n.subeAdi, subeKod: n.subeKod })),
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
