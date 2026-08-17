import { NextResponse } from 'next/server'
import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, num, fetchPhpHtml } from '@/lib/merchSatis'

export const maxDuration = 30

const MERCH_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

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

  const normStr = (s: string) => (s || '').trim().toLowerCase()
    .replace(/İ/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, ' ')

  /** Bir satır için prim_ozel'de eşleşen kuralı bul (donem bazlı tarih kontrolü) */
  function findOzelRule(stokKodu: string, grupKodu: string, cariAdi: string, subeAdi: string): OzelPrimRow | undefined {
    for (const rule of ozelPrimRows) {
      const stokOk = !rule.stok_kodu || rule.stok_kodu.some(s => s.toUpperCase() === stokKodu.toUpperCase())
      // Stok kodu belirtilmişse ve eşleşmişse grup kodunu atla
      const grupOk = !rule.grup_kodu || (rule.stok_kodu?.length ? stokOk : rule.grup_kodu.some(g => g.toUpperCase() === grupKodu.toUpperCase()))
      const cariOk = !rule.cari_adi  || rule.cari_adi.some(c => normStr(c) === normStr(cariAdi))
      const subeOk = !rule.sube_adi  || rule.sube_adi.some(s => normStr(s) === normStr(subeAdi))
      // Tarih aralığı: DONEM (YYYY-MM) bazlı karşılaştırma — PHP tarih formatına bağımsız
      const ruleFrom = rule.tarih_baslangic ? rule.tarih_baslangic.slice(0, 7) : null
      const ruleTo   = rule.tarih_bitis     ? rule.tarih_bitis.slice(0, 7)     : null
      const basOk = !ruleFrom || ruleFrom <= donem
      const bitOk = !ruleTo   || ruleTo   >= donem
      if (stokOk && grupOk && cariOk && subeOk && basOk && bitOk) return rule
    }
    return undefined
  }

  // 2. Fetch external HTML (cached 15 min at Next.js data cache)
  let html = ''
  try {
    // fetchPhpHtml: gövdeyi tam UTF-8 çözer (Türkçe karakter bozulmasını önler)
    html = await fetchPhpHtml(MERCH_URL)
  } catch (e) {
    return NextResponse.json({ error: 'Dış kaynak alınamadı: ' + String(e) }, { status: 500 })
  }

  // 3. Parse HTML table rows — başlık ismine göre ayrıştır
  const { rows: rawRows } = parseHtmlTableByHeader(html)
  const aggMap = new Map<string, { supervizor: string; cariAdi: string; subeAdi: string; bayiMerch: string; primHakdis: number; satisAdet: number; bsyKod: string }>()

  for (const row of rawRows) {
    // Filter by donem
    if (row['DONEM'] !== donem) continue

    // Only include "Bayi Merch" — skip "Çetinler Merch"
    if (row['MERCH_TIPI'] !== 'Bayi Merch') continue

    const merchPersonel = row['MERCH_PERSONEL'] ?? ''
    const cariIsim  = row['CARI_ISIM'] ?? ''
    const subeAdi   = row['SUBE_ADI'] ?? ''
    const stokKodu  = (row['STOK_KODU'] ?? '').toUpperCase()
    const grupKodu  = (row['GRUP_KODU'] ?? '').toUpperCase()
    const satisAdet = num(row['SATILAN_ADET'])
    const standardRate = primMap.get(stokKodu) ?? null

    // Özel kural varsa uygula
    const ozelRule = findOzelRule(stokKodu, grupKodu, cariIsim, subeAdi)
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

    const key = `${row['SUPERVISOR_ADI'] ?? ''}||${cariIsim}||${subeAdi}||${merchPersonel}`

    const existing = aggMap.get(key)
    if (existing) {
      existing.primHakdis += prim
      existing.satisAdet  += satisAdet
    } else {
      aggMap.set(key, {
        supervizor:  row['SUPERVISOR_ADI'] ?? '',
        cariAdi:     cariIsim,
        subeAdi:     subeAdi,
        bayiMerch:   merchPersonel,
        primHakdis:  prim,
        satisAdet:   satisAdet,
        bsyKod:      row['BSY'] ?? '',
      })
    }
  }

  const rows: HakdisRow[] = [...aggMap.values()]
    .sort((a, b) => b.primHakdis - a.primHakdis)

  return NextResponse.json({ rows, donem })
}
