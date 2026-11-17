import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'
import { noktaModeli } from '@/lib/v2/noktaModel'
import { subeEslestirici, type StokSatir } from '@/lib/subeStok'

// Sellout ▸ Şube Takibi — şube stok (milat) ve sevk kayıtları.
// GET    → { stok, sevk, yuklemeler }  (giriş yapmış herkes; ekran kendi şubelerini süzer)
// POST   { tip: 'stok' | 'sevk', satirlar, milat?, tarih?, cari?, onizleme? }  (yalnızca yönetici)
//        stok: dosyadaki şubelerin eski stok kayıtları silinir, yenileri yazılır (milat = seçilen tarih)
//        sevk: yeni yükleme olarak eklenir (tarih kolonu yoksa seçilen tarih)
//        onizleme: true → yazmadan eşleşme özeti döner
// DELETE { yukleme_id } → bir sevk yüklemesini geri al (yalnızca yönetici)

export const maxDuration = 120

const TUM = ['admin', 'bsy', 'sup', 'jr', 'merch', 'manager', 'ik']

function istemci(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
  )
}

const tabloYok = (code?: string) => code === '42P01' || code === 'PGRST205'
const tabloHatasi = () => NextResponse.json(
  { error: 'Stok tabloları henüz oluşturulmadı (sube_stok_migration.sql çalıştırılmalı).', tabloYok: true },
  { status: 503 },
)

async function hepsi<T>(sorgu: (bas: number, son: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>) {
  const out: T[] = []
  for (let bas = 0; ; bas += 1000) {
    const { data, error } = await sorgu(bas, bas + 999)
    if (error) return { data: out, error }
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return { data: out, error: null }
  }
}

export async function GET(req: Request) {
  const user = await requireRole(req, TUM)
  if (user instanceof NextResponse) return user
  const sb = istemci(req)
  const [stok, sevk] = await Promise.all([
    hepsi(( b, s) => sb.from('sube_stok').select('sube_key, stok_kodu, stok_adi, kalan, bekleyen, milat').range(b, s)),
    hepsi((b, s) => sb.from('sube_sevk').select('yukleme_id, sube_key, stok_kodu, stok_adi, adet, tarih, created_at').range(b, s)),
  ])
  if (stok.error) return tabloYok(stok.error.code) ? tabloHatasi() : NextResponse.json({ error: stok.error.message }, { status: 500 })
  if (sevk.error) return tabloYok(sevk.error.code) ? tabloHatasi() : NextResponse.json({ error: sevk.error.message }, { status: 500 })

  const yuk = new Map<string, { yukleme_id: string; created_at: string; satir: number; adet: number; ilkTarih: string; sonTarih: string }>()
  for (const r of sevk.data as { yukleme_id: string; created_at: string; adet: number; tarih: string }[]) {
    const y = yuk.get(r.yukleme_id) ?? { yukleme_id: r.yukleme_id, created_at: r.created_at, satir: 0, adet: 0, ilkTarih: r.tarih, sonTarih: r.tarih }
    y.satir++; y.adet += r.adet
    if (r.tarih < y.ilkTarih) y.ilkTarih = r.tarih
    if (r.tarih > y.sonTarih) y.sonTarih = r.tarih
    yuk.set(r.yukleme_id, y)
  }
  return NextResponse.json({
    stok: stok.data,
    sevk: sevk.data,
    yuklemeler: [...yuk.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  })
}

export async function POST(req: Request) {
  const user = await requireRole(req, ['admin'])
  if (user instanceof NextResponse) return user
  const b = await req.json().catch(() => null) as {
    tip?: 'stok' | 'sevk'; satirlar?: StokSatir[]; milat?: string; tarih?: string; cari?: string; onizleme?: boolean
  } | null
  const tarihOk = (t?: string) => !!t && /^\d{4}-\d{2}-\d{2}$/.test(t)
  if (!b || (b.tip !== 'stok' && b.tip !== 'sevk') || !Array.isArray(b.satirlar) || b.satirlar.length === 0) {
    return NextResponse.json({ error: 'Dosyada satır bulunamadı' }, { status: 400 })
  }
  if (b.tip === 'stok' && !tarihOk(b.milat)) return NextResponse.json({ error: 'Milat tarihi gerekli' }, { status: 400 })
  if (b.satirlar.length > 50000) return NextResponse.json({ error: 'Dosya çok büyük (en fazla 50.000 satır)' }, { status: 400 })

  const model = await noktaModeli()
  const esle = subeEslestirici(model.noktalar.map(n => ({ subeKod: n.subeKod, cariAdi: n.cariAdi, subeAdi: n.subeAdi })))

  const eslesen: { sube_key: string; cari_adi: string; sube_adi: string; s: StokSatir }[] = []
  const eslesmeyen = new Map<string, number>()
  let tarihsiz = 0
  for (const s of b.satirlar) {
    const a = esle(s, b.cari)
    if (!a || !a.subeKod) {
      const k = [s.cariAdi, s.subeKod, s.subeAdi].filter(Boolean).join(' / ')
      eslesmeyen.set(k, (eslesmeyen.get(k) ?? 0) + 1)
      continue
    }
    if (b.tip === 'sevk' && !tarihOk(s.tarih) && !tarihOk(b.tarih)) { tarihsiz++; continue }
    eslesen.push({ sube_key: a.subeKod, cari_adi: a.cariAdi, sube_adi: a.subeAdi, s })
  }
  // Daha önce yüklenmiş belgeler (sipariş no) tekrar sayılmaz
  const belgeler = [...new Set(b.satirlar.map(s => s.belgeNo?.trim()).filter((x): x is string => !!x))]
  const oncekiBelgeler: string[] = []
  if (b.tip === 'sevk' && belgeler.length) {
    const { data, error } = await istemci(req).from('sube_sevk').select('belge_no').in('belge_no', belgeler)
    if (!error) for (const r of data ?? []) if (r.belge_no && !oncekiBelgeler.includes(r.belge_no)) oncekiBelgeler.push(r.belge_no)
  }
  if (oncekiBelgeler.length) {
    for (let i = eslesen.length - 1; i >= 0; i--) {
      if (eslesen[i].s.belgeNo && oncekiBelgeler.includes(eslesen[i].s.belgeNo!.trim())) eslesen.splice(i, 1)
    }
  }
  const subeSayisi = new Set(eslesen.map(e => e.sube_key)).size
  const ozet = {
    toplamSatir: b.satirlar.length,
    eslesenSatir: eslesen.length,
    subeSayisi,
    toplamAdet: eslesen.reduce((t, e) => t + (b.tip === 'stok' ? (e.s.kalan ?? 0) : (e.s.adet ?? 0)), 0),
    tarihsiz,
    oncekiBelgeler,
    eslesmeyen: [...eslesmeyen.entries()].map(([sube, satir]) => ({ sube, satir })).sort((x, y) => y.satir - x.satir),
  }
  if (b.onizleme || eslesen.length === 0) return NextResponse.json({ ok: true, onizleme: true, ...ozet })

  const sb = istemci(req)
  if (b.tip === 'stok') {
    // Aynı şube + ürün dosyada birden çok satırsa toplanır
    const birlesik = new Map<string, { sube_key: string; cari_adi: string; sube_adi: string; stok_kodu: string; stok_adi: string | null; kalan: number; bekleyen: number }>()
    for (const e of eslesen) {
      const k = `${e.sube_key}||${e.s.stokKodu.toUpperCase()}`
      const c = birlesik.get(k) ?? { sube_key: e.sube_key, cari_adi: e.cari_adi, sube_adi: e.sube_adi, stok_kodu: e.s.stokKodu.toUpperCase(), stok_adi: e.s.stokAdi ?? null, kalan: 0, bekleyen: 0 }
      c.kalan += e.s.kalan ?? 0
      c.bekleyen += e.s.bekleyen ?? 0
      birlesik.set(k, c)
    }
    const subeler = [...new Set(eslesen.map(e => e.sube_key))]
    for (let i = 0; i < subeler.length; i += 200) {
      const { error } = await sb.from('sube_stok').delete().in('sube_key', subeler.slice(i, i + 200))
      if (error) return tabloYok(error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })
    }
    const satirlar = [...birlesik.values()].map(r => ({ ...r, milat: b.milat, yukleyen: user.id }))
    for (let i = 0; i < satirlar.length; i += 1000) {
      const { error } = await sb.from('sube_stok').insert(satirlar.slice(i, i + 1000))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const yukleme_id = crypto.randomUUID()
    let satirlar: Record<string, unknown>[] = eslesen.map(e => ({
      yukleme_id, sube_key: e.sube_key, cari_adi: e.cari_adi, sube_adi: e.sube_adi,
      stok_kodu: e.s.stokKodu.toUpperCase(), stok_adi: e.s.stokAdi ?? null,
      adet: e.s.adet ?? 0, tarih: tarihOk(e.s.tarih) ? e.s.tarih : b.tarih, yukleyen: user.id,
      belge_no: e.s.belgeNo?.trim() || null,
    }))
    let belgeKolonu = true
    for (let i = 0; i < satirlar.length; i += 1000) {
      let { error } = await sb.from('sube_sevk').insert(satirlar.slice(i, i + 1000))
      if (error && belgeKolonu && /belge_no/.test(error.message)) {
        // belge_no kolonu henüz eklenmemiş → onsuz kaydet
        belgeKolonu = false
        satirlar = satirlar.map(({ belge_no: _b, ...r }) => r)
        ;({ error } = await sb.from('sube_sevk').insert(satirlar.slice(i, i + 1000)))
      }
      if (error) return tabloYok(error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, onizleme: false, ...ozet })
}

export async function DELETE(req: Request) {
  const user = await requireRole(req, ['admin'])
  if (user instanceof NextResponse) return user
  const b = await req.json().catch(() => null) as { yukleme_id?: string } | null
  if (!b?.yukleme_id) return NextResponse.json({ error: 'yukleme_id gerekli' }, { status: 400 })
  const { error } = await istemci(req).from('sube_sevk').delete().eq('yukleme_id', b.yukleme_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
