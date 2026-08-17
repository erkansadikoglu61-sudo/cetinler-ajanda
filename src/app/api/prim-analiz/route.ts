import { NextResponse } from 'next/server'
import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, num, fetchPhpHtml } from '@/lib/merchSatis'

export const maxDuration = 30

const MERCH_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

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
    // fetchPhpHtml: gövdeyi tam UTF-8 çözer (Türkçe karakter bozulmasını önler)
    html = await fetchPhpHtml(MERCH_URL)
  } catch (e) {
    return NextResponse.json({ error: 'Dış kaynak alınamadı: ' + String(e) }, { status: 500 })
  }

  const { rows: rawRows } = parseHtmlTableByHeader(html)
  // Aggregate by cariAdi + subeAdi + stokKodu (preserve stok detail)
  const aggMap = new Map<string, PrimAnalizRow>()

  for (const row of rawRows) {
    if (row['DONEM'] !== donem) continue
    if (row['MERCH_TIPI'] !== 'Bayi Merch') continue

    const cariIsim  = row['CARI_ISIM'] ?? ''
    const subeAdi   = row['SUBE_ADI'] ?? ''
    const stokKodu  = (row['STOK_KODU'] ?? '').toUpperCase()
    const stokAdi   = row['STOK_ADI'] || ''
    const grupKodu  = (row['GRUP_KODU'] ?? '').toUpperCase()
    const satisAdet = num(row['SATILAN_ADET'])
    const standardRate = primMap.get(stokKodu) ?? null

    const ozelRule = findOzelRule(stokKodu, grupKodu, cariIsim, subeAdi)
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

    // Marka, ürün adına göre değil GRUP_KODU'na göre belirlenir.
    // Kaynakta yalnızca RELUX ve EKEA (Electrolux) grupları var. Bazı Relux
    // ürünlerinin adında "relux" geçmiyor (ör. REP9548G/REP9548P, RRS9000);
    // ada bakınca yanlışlıkla Electrolux'e düşüyorlardı.
    const marka: 'Electrolux' | 'Relux' = grupKodu === 'RELUX' ? 'Relux' : 'Electrolux'
    const key = `${cariIsim}||${subeAdi}||${stokKodu}`

    const existing = aggMap.get(key)
    if (existing) {
      existing.prim += prim
    } else {
      aggMap.set(key, {
        stokKodu,
        stokAdi,
        cariAdi:    cariIsim,
        subeAdi:    subeAdi,
        bsyKod:     row['BSY'] ?? '',
        supervizor: row['SUPERVISOR_ADI'] ?? '',
        prim,
        marka,
      })
    }
  }

  const rows: PrimAnalizRow[] = [...aggMap.values()]
  return NextResponse.json({ rows, donem })
}
