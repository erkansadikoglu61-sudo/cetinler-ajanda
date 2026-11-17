// Sellout ▸ Şube Takibi — şube stok / sevk ortak yardımcıları (istemci + sunucu).
// Kalan = milat stoğu + milattan SONRAKİ sevkler − milattan SONRAKİ satışlar
// (milat günü sayım günüdür; o günün satış ve sevkleri sayıma dahil kabul edilir).

import { normalizeName } from '@/lib/sellout'

export interface StokSatir {
  subeKod?: string
  cariAdi?: string
  subeAdi?: string
  stokKodu: string
  stokAdi?: string
  kalan?: number
  bekleyen?: number
  adet?: number
  tarih?: string      // YYYY-MM-DD
}

export function sade(s: string | null | undefined): string {
  return normalizeName(String(s ?? '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 'gg.aa.yyyy' / 'yyyy-aa-gg' / Excel seri tarihi → 'yyyy-aa-gg' */
export function isoTarih(v: unknown): string {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

function sayi(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n) : 0
}

type Alan = keyof StokSatir

/** Başlık metninden alan adı (bulunamazsa null) */
function alanBul(h: string): Alan | null {
  const s = sade(h)
  if (!s) return null
  const kod = /\bkod/.test(s)
  if ((s.includes('sube') || s.includes('magaza')) && kod) return 'subeKod'
  if (s.includes('sube') || s.includes('magaza')) return 'subeAdi'
  if ((s.includes('cari') || s.includes('musteri') || s.includes('bayi')) && !kod) return 'cariAdi'
  if (s.includes('bekleyen')) return 'bekleyen'
  if (s.includes('kalan') || s.includes('mevcut') || s === 'stok' || s === 'stok adet' || s === 'stok adedi' || s === 'stok miktari') return 'kalan'
  if ((s.includes('stok') || s.includes('urun') || s.includes('malzeme') || s.includes('model')) && kod) return 'stokKodu'
  if (s === 'model') return 'stokKodu'
  if (s.includes('stok') || s.includes('urun') || s.includes('malzeme') || s.includes('aciklama')) return 'stokAdi'
  if (s.includes('tarih')) return 'tarih'
  if (s.includes('adet') || s.includes('miktar')) return 'adet'
  return null
}

export interface OkumaSonucu {
  satirlar: StokSatir[]
  kolonlar: Partial<Record<Alan, string>>
  hata?: string
}

/** Excel'in ilk sayfasından (dizi dizisi) stok/sevk satırlarını okur. */
export function satirlariOku(raw: unknown[][], tip: 'stok' | 'sevk'): OkumaSonucu {
  // Başlık satırı: ilk 15 satırda stok kodu kolonu olan ilk satır
  let hi = -1
  let harita: Partial<Record<Alan, number>> = {}
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const m: Partial<Record<Alan, number>> = {}
    ;(raw[i] ?? []).forEach((h, c) => {
      const a = alanBul(String(h ?? ''))
      if (a && m[a] === undefined) m[a] = c
    })
    if (m.stokKodu !== undefined) { hi = i; harita = m; break }
  }
  if (hi < 0) return { satirlar: [], kolonlar: {}, hata: 'Başlık satırında stok/ürün kodu kolonu bulunamadı.' }
  if (harita.subeKod === undefined && harita.subeAdi === undefined) {
    return { satirlar: [], kolonlar: {}, hata: 'Şube (veya şube kodu) kolonu bulunamadı.' }
  }
  if (tip === 'stok' && harita.kalan === undefined) {
    return { satirlar: [], kolonlar: {}, hata: 'Kalan / stok kolonu bulunamadı.' }
  }
  if (tip === 'sevk' && harita.adet === undefined) {
    return { satirlar: [], kolonlar: {}, hata: 'Adet / miktar kolonu bulunamadı.' }
  }
  const basliklar = raw[hi] ?? []
  const kolonlar: Partial<Record<Alan, string>> = {}
  for (const [a, c] of Object.entries(harita)) kolonlar[a as Alan] = String(basliklar[c as number] ?? '')

  const al = (r: unknown[], a: Alan) => (harita[a] === undefined ? undefined : r[harita[a]!])
  const satirlar: StokSatir[] = []
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue
    const stokKodu = String(al(r, 'stokKodu') ?? '').trim()
    if (!stokKodu) continue
    const subeKod = String(al(r, 'subeKod') ?? '').trim()
    const subeAdi = String(al(r, 'subeAdi') ?? '').trim()
    if (!subeKod && !subeAdi) continue
    satirlar.push({
      subeKod: subeKod || undefined,
      subeAdi: subeAdi || undefined,
      cariAdi: String(al(r, 'cariAdi') ?? '').trim() || undefined,
      stokKodu,
      stokAdi: String(al(r, 'stokAdi') ?? '').trim() || undefined,
      kalan: tip === 'stok' ? sayi(al(r, 'kalan')) : undefined,
      bekleyen: tip === 'stok' ? sayi(al(r, 'bekleyen')) : undefined,
      adet: tip === 'sevk' ? sayi(al(r, 'adet')) : undefined,
      tarih: harita.tarih !== undefined ? isoTarih(al(r, 'tarih')) || undefined : undefined,
    })
  }
  return { satirlar, kolonlar }
}

// ── Şube eşleştirme (sunucu) ──────────────────────────────────
export interface SubeAday { subeKod: string; cariAdi: string; subeAdi: string }

/** Dosyadaki şubeyi B2B şubesine eşler: önce şube kodu, sonra (cari içinde) şube adı. */
export function subeEslestirici(adaylar: SubeAday[]) {
  const byKod = new Map<string, SubeAday>()
  for (const a of adaylar) if (a.subeKod) byKod.set(a.subeKod.trim().toUpperCase(), a)
  const ilkKelime = (s: string) => sade(s).split(' ')[0] ?? ''
  const govde = (sube: string, cari: string) => {
    const s = sade(sube)
    const k = ilkKelime(cari)
    return k && s.startsWith(k + ' ') ? s.slice(k.length + 1) : s
  }
  return (satir: { subeKod?: string; cariAdi?: string; subeAdi?: string }, varsayilanCari?: string): SubeAday | null => {
    if (satir.subeKod) {
      const a = byKod.get(satir.subeKod.trim().toUpperCase())
      if (a) return a
    }
    if (!satir.subeAdi) return null
    const cari = satir.cariAdi || varsayilanCari || ''
    const cariK = ilkKelime(cari)
    const havuz = cariK ? adaylar.filter(a => ilkKelime(a.cariAdi) === cariK) : adaylar
    const hedefTam = sade(satir.subeAdi)
    const tam = havuz.filter(a => sade(a.subeAdi) === hedefTam)
    if (tam.length === 1) return tam[0]
    const hedefGovde = govde(satir.subeAdi, cari)
    const g = havuz.filter(a => govde(a.subeAdi, a.cariAdi) === hedefGovde)
    return g.length === 1 ? g[0] : null
  }
}
