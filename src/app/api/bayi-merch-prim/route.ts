import { NextResponse } from 'next/server'
import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const MERCH_URL = 'http://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

// Column indices in the HTML table
// 0:MERCH_PERSONEL 1:CARI_ISIM 2:SUBE_ADI 3:STOK_ADI 4:STOK_KODU
// 5:GRUP_ACIKLAMA  6:SATILAN_ADET 7:GRUP_KODU 8:BEKLENEN_CIRO
// 9:SUPERVISOR_ADI 10:CARI_KOD 11:SUBE_KOD 12:DONEM 13:TARIH
// 14:MERCH_TIPI ("Bayi Merch" | "Çetinler Merch") 15:SV_TIPI 16:BSY
const COL = {
  MERCH_PERSONEL: 0,
  CARI_ISIM:      1,
  SUBE_ADI:       2,
  STOK_ADI:       3,
  STOK_KODU:      4,
  SATILAN_ADET:   6,
  GRUP_KODU:      7,
  SUPERVISOR_ADI: 9,
  DONEM:          12,
  TARIH:          13,
  MERCH_TIPI:     14,
  BSY_KOD:        16,
} as const

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

interface HakdisRow {
  supervizor:   string
  cariAdi:      string
  subeAdi:      string
  bayiMerch:    string
  primHakdis:   number
  satisAdet:    number
  bsyKod:       string   // PHP kolonundan gelen BSY kodu (KB1, IB1, vb.)
}

export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = parseInt(sp.get('yil') ?? String(new Date().getFullYear()))
  const ay  = parseInt(sp.get('ay')  ?? String(new Date().getMonth() + 1))
  const donem = `${yil}-${String(ay).padStart(2, '0')}`

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Genel prim oranları: defaults → adet_prim_override ile üzerine yaz
  const primMap = new Map<string, number | null>()
  for (const r of ADET_PRIM_DEFAULTS) {
    primMap.set(r.stokKodu, r.bayiMerch)
  }
  try {
    const { data } = await sb
      .from('adet_prim_override')
      .select('stok_kodu, bayi_merch')
      .eq('yil', yil)
      .eq('ay', ay)
    if (data) {
      for (const row of data) {
        primMap.set(row.stok_kodu, row.bayi_merch)
      }
    }
  } catch { /* use defaults */ }

  // 2. Özel prim kuralları (prim_ozel) — cari/şube/stok bazlı overrides
  interface OzelPrimRow {
    stok_kodu:        string[] | null
    grup_kodu:        string[] | null
    cari_adi:         string[] | null
    sube_adi:         string[] | null
    bayi_merch:       number | null
    prim_carpan:      number | null
    tarih_baslangic:  string | null   // 'YYYY-MM-DD'
    tarih_bitis:      string | null   // 'YYYY-MM-DD'
  }
  let ozelPrimRows: OzelPrimRow[] = []
  try {
    // ay filtresi yok — tüm yıl kurallarını çek, tarih aralığıyla eşleştir
    const { data } = await sb
      .from('prim_ozel')
      .select('stok_kodu, grup_kodu, cari_adi, sube_adi, bayi_merch, prim_carpan, tarih_baslangic, tarih_bitis')
      .eq('yil', yil)
    if (data) ozelPrimRows = data as OzelPrimRow[]
  } catch { /* ignore */ }

  // Dönemin ilk ve son günü (tarih karşılaştırması için)
  const donemIlk = `${yil}-${String(ay).padStart(2,'0')}-01`
  const nextMonth = ay === 12 ? `${yil + 1}-01-01` : `${yil}-${String(ay + 1).padStart(2,'0')}-01`
  // Son gün: bir sonraki ayın ilk gününden 1 gün önce (string karşılaştırma)
  const donemSon = new Date(new Date(nextMonth).getTime() - 86400000)
    .toISOString().slice(0, 10)

  /** Bir satır için prim_ozel'de eşleşen kuralı bul (tarih aralığı kontrolü dahil) */
  function findOzelRule(stokKodu: string, grupKodu: string, cariAdi: string, subeAdi: string, tarih: string): OzelPrimRow | undefined {
    for (const rule of ozelPrimRows) {
      const stokOk = !rule.stok_kodu || rule.stok_kodu.some(s => s.toUpperCase() === stokKodu.toUpperCase())
      const grupOk = !rule.grup_kodu || rule.grup_kodu.some(g => g.toUpperCase() === grupKodu.toUpperCase())
      const cariOk = !rule.cari_adi  || rule.cari_adi.some(c => c === cariAdi)
      const subeOk = !rule.sube_adi  || rule.sube_adi.some(s => s === subeAdi)
      // Tarih aralığı: satış tarihi kural aralığında mı?
      const basOk = !rule.tarih_baslangic || rule.tarih_baslangic <= tarih
      const bitOk = !rule.tarih_bitis     || rule.tarih_bitis     >= tarih
      if (stokOk && grupOk && cariOk && subeOk && basOk && bitOk) return rule
    }
    return undefined
  }

  // 2. Fetch external HTML (cached 15 min at Next.js data cache)
  let html = ''
  try {
    const res = await fetch(MERCH_URL, {
      next: { revalidate: 900 },
      headers: { 'Accept-Encoding': 'gzip, deflate' },
    })
    html = await res.text()
  } catch (e) {
    return NextResponse.json({ error: 'Dış kaynak alınamadı: ' + String(e) }, { status: 500 })
  }

  // 3. Parse HTML table rows
  // Rows are separated by </tr> — split and process each
  const parts = html.split('</tr>')
  const aggMap = new Map<string, { supervizor: string; cariAdi: string; subeAdi: string; bayiMerch: string; primHakdis: number; satisAdet: number; bsyKod: string }>()

  const tdRe = /<td[^>]*>(.*?)<\/td>/g

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part.includes('<td')) continue

    const cells: string[] = []
    let m: RegExpExecArray | null
    tdRe.lastIndex = 0
    while ((m = tdRe.exec(part)) !== null) {
      cells.push(decodeHtml(m[1]))
    }
    if (cells.length < 15) continue

    // Filter by donem
    if (cells[COL.DONEM] !== donem) continue

    // Only include "Bayi Merch" — skip "Çetinler Merch"
    if (cells[COL.MERCH_TIPI] !== 'Bayi Merch') continue

    const stokKodu  = cells[COL.STOK_KODU].toUpperCase()
    const grupKodu  = cells[COL.GRUP_KODU]?.toUpperCase() || ''
    const tarih     = cells[COL.TARIH] || ''
    const satisAdet = parseFloat(cells[COL.SATILAN_ADET]) || 0
    const standardRate = primMap.get(stokKodu) ?? null

    // Özel kural varsa uygula
    const ozelRule = findOzelRule(stokKodu, grupKodu, cells[COL.CARI_ISIM], cells[COL.SUBE_ADI], tarih)
    let bayiMerchPrim: number | null
    if (ozelRule) {
      if (ozelRule.prim_carpan != null && standardRate != null) {
        // Çarpan: standart oran × N
        bayiMerchPrim = standardRate * ozelRule.prim_carpan
      } else if (ozelRule.bayi_merch != null) {
        // Ek prim: standart oran + ekstra tutar (bayi_merch, REPLACE değil ADDITIVE)
        bayiMerchPrim = (standardRate ?? 0) + ozelRule.bayi_merch
      } else {
        bayiMerchPrim = standardRate
      }
    } else {
      bayiMerchPrim = standardRate
    }
    const prim = bayiMerchPrim != null ? satisAdet * bayiMerchPrim : 0

    const key = `${cells[COL.SUPERVISOR_ADI]}||${cells[COL.CARI_ISIM]}||${cells[COL.SUBE_ADI]}||${cells[COL.MERCH_PERSONEL]}`

    const existing = aggMap.get(key)
    if (existing) {
      existing.primHakdis += prim
      existing.satisAdet  += satisAdet
    } else {
      aggMap.set(key, {
        supervizor:  cells[COL.SUPERVISOR_ADI],
        cariAdi:     cells[COL.CARI_ISIM],
        subeAdi:     cells[COL.SUBE_ADI],
        bayiMerch:   cells[COL.MERCH_PERSONEL],
        primHakdis:  prim,
        satisAdet:   satisAdet,
        bsyKod:      cells[COL.BSY_KOD] ?? '',
      })
    }
  }

  const rows: HakdisRow[] = [...aggMap.values()]
    .sort((a, b) => b.primHakdis - a.primHakdis)

  return NextResponse.json({ rows, donem })
}
