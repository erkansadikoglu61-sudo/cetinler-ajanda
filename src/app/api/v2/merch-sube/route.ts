import { NextResponse } from 'next/server'
import { gorunurNoktalar, type V2Nokta, type V2Profil } from '@/lib/v2/nokta'
import { noktaModeli } from '@/lib/v2/noktaModel'
import { v2Istek, type V2Istek } from '@/lib/v2/sunucu'
import { namesMatch } from '@/lib/sellout'
import {
  merchSubeSecimleri, merchSecimleriniUygula, merchiYonetebilir, merchinUstleri, merchSubeTabloYok,
} from '@/lib/v2/merchSube'

// v2 — Çetinler Merch görev şubeleri (tablo: v2_merch_sube, v2_merch_sube_migration.sql)
// GET                      → yönetebildiğim merch'ler ve şu anki şubeleri
// GET ?merch=<id>          → o merch için seçenekler (Jr / süpervizörünün şubeleri + tüm şubeler)
// PUT { merch_id, keys[] } → şubeleri değiştir (boş liste = B2B kaydına dön)
// Yetki: merch'in kendisi, bağlı olduğu Jr / süpervizör, yönetici.

export const maxDuration = 300

const tabloHatasi = () => NextResponse.json(
  { error: 'Merch şube tablosu henüz oluşturulmadı (v2_merch_sube_migration.sql çalıştırılmalı).', tabloYok: true },
  { status: 503 },
)

const kisa = (n: V2Nokta) => ({ key: n.key, subeKod: n.subeKod, cariAdi: n.cariAdi, subeAdi: n.subeAdi })

async function hazirla(ctx: V2Istek) {
  const [model, secimler] = await Promise.all([noktaModeli(), merchSubeSecimleri(ctx.sb)])
  const uygulanmis = merchSecimleriniUygula(model.noktalar, secimler, ctx.profiller)
  const yonetebilir = (m: V2Profil) =>
    m.role === 'merch' && (ctx.rol === 'admin' || merchiYonetebilir(ctx.ben, m, ctx.profiller, model.noktalar, uygulanmis))
  return { model, secimler, uygulanmis, yonetebilir }
}

export async function GET(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const merchId = new URL(req.url).searchParams.get('merch')
  try {
    const { model, secimler, uygulanmis, yonetebilir } = await hazirla(ctx)

    if (!merchId) {
      // Yönetici kendi görünümündeyse tüm merch'ler; diğerleri yönetebildikleri
      const adaylar = ctx.profiller.filter(p => p.role === 'merch'
        && (ctx.ben.role === 'admin' ? true : ctx.ben.id === p.id || (['sup', 'jr'].includes(ctx.ben.role) && yonetebilir(p))))
      return NextResponse.json({
        merchler: adaylar.map(p => ({
          id: p.id,
          ad: p.full_name,
          kaynak: secimler.has(p.id) ? 'elle' : 'b2b',
          subeler: uygulanmis.filter(n => n.cetinlerMerch.some(k => namesMatch(k.ad, p.full_name))).map(kisa),
        })),
      })
    }

    const merch = ctx.profiller.find(p => p.id === merchId)
    if (!merch || merch.role !== 'merch') return NextResponse.json({ error: 'Merch bulunamadı' }, { status: 404 })
    if (!yonetebilir(merch)) return NextResponse.json({ error: 'Bu merch için yetkiniz yok' }, { status: 403 })

    // Öneri: merch'in Jr / süpervizörünün şubeleri
    const ustler = merchinUstleri(model.noktalar, merch)
    const ustProfiller = ctx.profiller.filter(p =>
      (p.role === 'sup' && ustler.sups.some(a => namesMatch(a, p.full_name)))
      || (p.role === 'jr' && ustler.jrs.some(a => namesMatch(a, p.full_name)))
      || p.id === merch.manager_id)
    const oneriKeys = new Set<string>()
    for (const u of ustProfiller) {
      for (const n of gorunurNoktalar(uygulanmis, u, ctx.profiller, ctx.links)) oneriKeys.add(n.key)
    }
    return NextResponse.json({
      merch: { id: merch.id, ad: merch.full_name },
      kaynak: secimler.has(merch.id) ? 'elle' : 'b2b',
      secili: uygulanmis.filter(n => n.cetinlerMerch.some(k => namesMatch(k.ad, merch.full_name))).map(n => n.key),
      b2b: model.noktalar.filter(n => n.cetinlerMerch.some(k => namesMatch(k.ad, merch.full_name))).map(n => n.key),
      oneri: [...oneriKeys],
      ustler: ustProfiller.map(p => p.full_name),
      tum: model.noktalar.map(kisa),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as { merch_id?: string; keys?: unknown } | null
  const keys = Array.isArray(b?.keys) ? [...new Set((b!.keys as unknown[]).filter((k): k is string => typeof k === 'string'))] : null
  if (!b?.merch_id || !keys || keys.length > 50) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const merch = ctx.profiller.find(p => p.id === b.merch_id)
  if (!merch || merch.role !== 'merch') return NextResponse.json({ error: 'Merch bulunamadı' }, { status: 404 })
  try {
    const { model, yonetebilir } = await hazirla(ctx)
    if (!yonetebilir(merch)) return NextResponse.json({ error: 'Bu merch için yetkiniz yok' }, { status: 403 })
    const byKey = new Map(model.noktalar.map(n => [n.key, n]))
    const satirlar = keys.map(k => byKey.get(k)).filter((n): n is V2Nokta => !!n).map(n => ({
      merch_id: merch.id, sube_key: n.key, sube_kod: n.subeKod || null, cari_adi: n.cariAdi, sube_adi: n.subeAdi,
      ekleyen_id: ctx.kullaniciId,
    }))
    if (satirlar.length !== keys.length) return NextResponse.json({ error: 'Bazı şubeler bulunamadı, sayfayı yenileyin' }, { status: 400 })

    const sil = await ctx.sb.from('v2_merch_sube').delete().eq('merch_id', merch.id)
    if (sil.error) return merchSubeTabloYok(sil.error.message, sil.error.code) ? tabloHatasi() : NextResponse.json({ error: sil.error.message }, { status: 500 })
    if (satirlar.length > 0) {
      const ek = await ctx.sb.from('v2_merch_sube').insert(satirlar)
      if (ek.error) return NextResponse.json({ error: ek.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, kaynak: satirlar.length ? 'elle' : 'b2b' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
