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
  belgeNo?: string    // sevk: sipariş / irsaliye no (aynı belge iki kez yüklenmesin)
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

// Mağaza raporlarında şube adlarına eklenen ve karşılaştırmada yok sayılan kelimeler
const DURAK = new Set(['avm', 'sube', 'subesi', 'sb', 'magaza', 'magazasi'])
// Bu kelimeleri içeren kayıtlar (depo, teslimat, mobilya…) yalnızca birebir eşleşir
const ONEKSIZ = ['depo', 'teslimat', 'transfer', 'tamir', 'ofis', 'internet', 'mobilya']
// Kısaltmalar (iki taraf da aynı biçime çevrilir)
const TAKMA: Record<string, string> = { gop: 'gaziosmanpasa' }

function ilkKelime(s: string): string {
  return sade(s).split(' ')[0] ?? ''
}

/** "EVKUR ÇORLU 2 AVM ŞUBE" → "corlu2" (cari öneki, ekler, boşluk ve tireler atılır) */
export function subeKompakt(sube: string, cari: string): string {
  const t = sade(sube).split(' ').filter(Boolean)
  const k = ilkKelime(cari)
  if (k && t[0] === k && t.length > 1) t.shift()
  const ana = t.filter(x => !DURAK.has(x)).join('')
  return TAKMA[ana] ?? ana
}

/**
 * Dosya satırlarını B2B şubelerine eşler (toplu). Sıra:
 *  1. Şube kodu
 *  2. Aynı cari içinde birebir ad / kompakt ad (ekler, boşluk, tire, kısaltma farkı yok sayılır)
 *  3. Kalanlar için tek adaylı ön ek eşleşmesi ("AFYON KARAHISAR" → "AFYON", "BOZYAKA" → "BOZYAKA-İZMİR");
 *     2. adımda başka bir dosya şubesine verilmiş B2B şubeleri ve depo/teslimat kayıtları hariç.
 */
export function subeleriEsle(
  satirlar: { subeKod?: string; cariAdi?: string; subeAdi?: string }[],
  adaylar: SubeAday[],
  varsayilanCari?: string,
): (SubeAday | null)[] {
  const byKod = new Map<string, SubeAday>()
  for (const a of adaylar) if (a.subeKod) byKod.set(a.subeKod.trim().toUpperCase(), a)

  // Dosyadaki farklı (cari, şube) ikilileri
  const anahtar = (s: { cariAdi?: string; subeAdi?: string }) => `${ilkKelime(s.cariAdi || varsayilanCari || '')}||${sade(s.subeAdi)}`
  const grup = new Map<string, { cari: string; sube: string }>()
  for (const s of satirlar) {
    if (s.subeKod && byKod.has(s.subeKod.trim().toUpperCase())) continue
    if (!s.subeAdi) continue
    const k = anahtar(s)
    if (!grup.has(k)) grup.set(k, { cari: s.cariAdi || varsayilanCari || '', sube: s.subeAdi })
  }

  const havuz = (cari: string) => {
    const k = ilkKelime(cari)
    return k ? adaylar.filter(a => ilkKelime(a.cariAdi) === k) : adaylar
  }
  const sonuc = new Map<string, SubeAday>()
  const kullanilan = new Set<string>()
  // 2. birebir / kompakt
  for (const [k, g] of grup) {
    const h = havuz(g.cari)
    const tam = h.filter(a => sade(a.subeAdi) === sade(g.sube))
    const kk = subeKompakt(g.sube, g.cari)
    const aday = tam.length === 1 ? tam : h.filter(a => kk && subeKompakt(a.subeAdi, a.cariAdi) === kk)
    if (aday.length === 1) { sonuc.set(k, aday[0]); kullanilan.add(aday[0].subeKod || aday[0].subeAdi) }
  }
  // 3. ön ek (tek aday)
  for (const [k, g] of grup) {
    if (sonuc.has(k)) continue
    const ham = sade(g.sube)
    if (ONEKSIZ.some(w => ham.includes(w))) continue
    const kk = subeKompakt(g.sube, g.cari)
    if (kk.length < 4) continue
    const aday = havuz(g.cari).filter(a => {
      if (kullanilan.has(a.subeKod || a.subeAdi)) return false
      const ak = subeKompakt(a.subeAdi, a.cariAdi)
      return ak.length >= 4 && (ak.startsWith(kk) || kk.startsWith(ak))
    })
    if (aday.length === 1) { sonuc.set(k, aday[0]); kullanilan.add(aday[0].subeKod || aday[0].subeAdi) }
  }

  return satirlar.map(s => {
    if (s.subeKod) {
      const a = byKod.get(s.subeKod.trim().toUpperCase())
      if (a) return a
    }
    return s.subeAdi ? sonuc.get(anahtar(s)) ?? null : null
  })
}

/** Tek satırlık eşleştirici (geriye uyum) */
export function subeEslestirici(adaylar: SubeAday[]) {
  return (satir: { subeKod?: string; cariAdi?: string; subeAdi?: string }, varsayilanCari?: string): SubeAday | null =>
    subeleriEsle([satir], adaylar, varsayilanCari)[0]
}

// ── Sipariş onay e-postası / görseli (OCR metni) → sevk satırları ──
export interface SiparisOkuma {
  siparisNo: string
  cariAdi: string
  subeAdi: string
  tarih: string          // YYYY-MM-DD (onay tarihi, yoksa sipariş tarihi)
  satirlar: { stokKodu: string; stokAdi: string; adet: number }[]
  toplam: number | null  // belgedeki "Toplam" (kontrol için)
}

const KOD = /^[A-Z0-9][A-Z0-9\-./]{2,}$/
function kodMu(s: string): boolean {
  return KOD.test(s) && /\d/.test(s) && /[A-Z]/.test(s) && !/^\d{1,2}[./]\d{1,2}[./]\d{4}/.test(s)
}

function alanDegeri(metin: string, re: RegExp): string {
  const m = metin.match(re)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

/** Tek sipariş metnini çözer (OCR ya da e-postadan kopyalanan metin). */
function tekSiparis(metin: string): SiparisOkuma | null {
  const t = metin.replace(/\r/g, '')
  const siparisNo = alanDegeri(t, /Sipari[sşŞ]\s*no\s*[:;]\s*([A-Z0-9-]+)/i)
  const cariAdi = alanDegeri(t, /Cari\s*[:;]\s*([^\n]+)/i)
  const subeAdi = alanDegeri(t, /(?:Ş|S|\$)ube\s*[:;]\s*([^\n]+)/i)
  const tarihHam = alanDegeri(t, /Onay\s*tarihi\s*[:;]\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
    || alanDegeri(t, /Sipari[sşŞ]\s*tarihi\s*[:;]\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
  const toplamHam = alanDegeri(t, /Toplam\s*[:|]?\s*(\d[\d.]*)\s*$/im)

  const satirlar: SiparisOkuma['satirlar'] = []
  const lines = t.split('\n').map(l => l.replace(/[|¦]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const parcalar = lines[i].split(' ')
    const kod = parcalar[0].toUpperCase()
    if (!kodMu(kod)) continue
    let geri = parcalar.slice(1)
    let adet: number | null = null
    if (geri.length && /^\d{1,5}$/.test(geri[geri.length - 1])) {
      adet = parseInt(geri[geri.length - 1])
      geri = geri.slice(0, -1)
    } else {
      // Ad iki satıra taşmış olabilir: sonraki 2 satırda (kod olmayan) sondaki sayıyı ara
      for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
        const p = lines[j].split(' ')
        if (kodMu(p[0].toUpperCase()) || /^toplam/i.test(lines[j])) break
        if (/^\d{1,5}$/.test(p[p.length - 1])) { adet = parseInt(p[p.length - 1]); break }
      }
    }
    if (adet === null || adet <= 0) continue
    satirlar.push({ stokKodu: kod, stokAdi: geri.join(' '), adet })
  }
  if (satirlar.length === 0) return null
  return {
    siparisNo,
    cariAdi,
    subeAdi,
    tarih: isoTarih(tarihHam),
    satirlar,
    toplam: toplamHam ? parseInt(toplamHam.replace(/\./g, '')) : null,
  }
}

/** Metinde bir ya da birden çok sipariş olabilir ("Sipariş no" ile ayrılır). */
export function siparisMetniOku(metin: string): SiparisOkuma[] {
  const parcalar = metin.split(/(?=Sipari[sşŞ]\s*no\s*[:;])/i).filter(p => p.trim())
  return parcalar.map(tekSiparis).filter((x): x is SiparisOkuma => !!x)
}
