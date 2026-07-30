import { NextResponse } from 'next/server'
import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const MERCH_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

export interface PrimAnalizRow {
  stokKodu:   string
  stokAdi:    string
  cariAdi:    string
  subeAdi:    string
  bsyKod:     string
  supervizor: string
  prim:       number
  marka:      'Electrolux' | 'Relux'
}

export async function GET(req: Request) {
  const sp    = new URL(req.url).searchParams
  const yil   = parseInt(sp.get('yil') ?? String(new Date().getFullYear()))
  const ay    = parseInt(sp.get('ay')  ?? String(new Date().getMonth() + 1))
  const donem = `${yil}-${String(ay).padStart(2, '0')}`

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Prim oranları: defaults → override
  const primMap = new Map<string, number | null>()
  for (const r of ADET_PRIM_DEFAULTS) primMap.set(r.stokKodu, r.bayiMerch)
  try {
    const { data } = await sb
      .from('adet_prim_override')
      .select('stok_kodu, bayi_merch')
      .eq('yil', yil).eq('ay', ay)
    if (data) for (const row of data) primMap.set(row.stok_kodu, row.bayi_merch)
  } catch { /* use defaults */ }

  // Özel prim kuralları
  interface OzelPrimRow {
    stok_kodu:       string[] | null
    grup_kodu:       string[] | null
    cari_adi:        string[] | null
    sube_adi:        string[] | null
    bayi_merch:      number | null
    prim_carpan:     number | null
    tarih_baslangic: string | null
    tarih_bitis:     string | null
  }
  let ozelPrimRows: OzelPrimRow[] = []
  try {
    const { data } = await sb
      .from('prim_ozel')
      .select('stok_kodu, grup_kodu, cari_adi, sube_adi, bayi_merch, prim_carpan, tarih_baslangic, tarih_bitis')
      .or(`tarih_bitis.is.null,tarih_bitis.gte.${donem}-01`)
      .or(`tarih_baslangic.is.null,tarih_baslangic.lte.${donem}-28`)
    if (data) ozelPrimRows = data as OzelPrimRow[]
  } catch { /* skip */ }

  const normStr = (s: string) => (s || '').trim().toLowerCase()
    .replace(/İ/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, ' ')

  function findOzelRule(stokKodu: string, grupKodu: string, cariAdi: string, subeAdi: string): OzelPrimRow | undefined {
    for (const rule of ozelPrimRows) {
      const stokOk = !rule.stok_kodu || rule.stok_kodu.some(s => s.toUpperCase() === stokKodu.toUpperCase())
      const grupOk = !rule.grup_kodu || (rule.stok_kodu?.length ? stokOk : rule.grup_kodu.some(g => g.toUpperCase() === grupKodu.toUpperCase()))
      const cariOk = !rule.cari_adi  || rule.cari_adi.some(c => normStr(c) === normStr(cariAdi))
      const subeOk = !rule.sube_adi  || rule.sube_adi.some(s => normStr(s) === normStr(subeAdi))
      const ruleFrom = rule.tarih_baslangic ? rule.tarih_baslangic.slice(0, 7) : null
      const ruleTo   = rule.tarih_bitis     ? rule.tarih_bitis.slice(0, 7)     : null
      const basOk  = !ruleFrom || ruleFrom <= donem
      const bitOk  = !ruleTo   || ruleTo   >= donem
      if (stokOk && grupOk && cariOk && subeOk && basOk && bitOk) return rule
    }
    return undefined
  }

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

  const parts = html.split('</tr>')
  const tdRe = /<td[^>]*>(.*?)<\/td>/g
  // Aggregate by cariAdi + subeAdi + stokKodu (preserve stok detail)
  const aggMap = new Map<string, PrimAnalizRow>()

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part.includes('<td')) continue

    const cells: string[] = []
    let m: RegExpExecArray | null
    tdRe.lastIndex = 0
    while ((m = tdRe.exec(part)) !== null) cells.push(decodeHtml(m[1]))
    if (cells.length < 15) continue
    if (cells[COL.DONEM] !== donem) continue
    if (cells[COL.MERCH_TIPI] !== 'Bayi Merch') continue

    const stokKodu  = cells[COL.STOK_KODU].toUpperCase()
    const stokAdi   = cells[COL.STOK_ADI]  || ''
    const grupKodu  = cells[COL.GRUP_KODU]?.toUpperCase() || ''
    const tarih     = cells[COL.TARIH] || ''
    const satisAdet = parseFloat(cells[COL.SATILAN_ADET]) || 0
    const standardRate = primMap.get(stokKodu) ?? null

    const ozelRule = findOzelRule(stokKodu, grupKodu, cells[COL.CARI_ISIM], cells[COL.SUBE_ADI])
    let rate: number | null
    if (ozelRule) {
      if (ozelRule.prim_carpan != null && standardRate != null) rate = standardRate * ozelRule.prim_carpan
      else if (ozelRule.bayi_merch != null) rate = (standardRate ?? 0) + ozelRule.bayi_merch
      else rate = standardRate
    } else {
      rate = standardRate
    }
    const prim = rate != null ? satisAdet * rate : 0
    if (prim === 0) continue

    const marka: 'Electrolux' | 'Relux' = /relux/i.test(stokAdi) ? 'Relux' : 'Electrolux'
    const key = `${cells[COL.CARI_ISIM]}||${cells[COL.SUBE_ADI]}||${stokKodu}`

    const existing = aggMap.get(key)
    if (existing) {
      existing.prim += prim
    } else {
      aggMap.set(key, {
        stokKodu,
        stokAdi,
        cariAdi:    cells[COL.CARI_ISIM],
        subeAdi:    cells[COL.SUBE_ADI],
        bsyKod:     cells[COL.BSY_KOD] ?? '',
        supervizor: cells[COL.SUPERVISOR_ADI],
        prim,
        marka,
      })
    }
  }

  const rows: PrimAnalizRow[] = [...aggMap.values()]
  return NextResponse.json({ rows, donem })
}
