import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'

export const dynamic = 'force-dynamic'

const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'
const MERCH_URL     = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

interface CariSube {
  cari_adi: string
  sube_adi: string
  bsy_adi:  string
  bsy_kod:  string
  sup_adi:  string
  jr_adi:   string
}

export async function GET() {
  try {
    // 1. Ana kaynak: BSY / Cari / Şube (başlık ismine göre — kolon sırası
    //    değişse de bozulmaz). Kolonlar: BSY_KODU, BSY_ADI, CARI_KOD,
    //    CARI_ADI, SUBE_KOD, SUBE_ADI
    const { rows: csRows } = parseHtmlTableByHeader(await fetchPhpHtml(CARI_SUBE_URL))

    // 2. Zenginleştirme: merch-detay'dan SUBE_KODU → { SUPERVIZOR, JR_SUPERVIZOR }
    //    Başlık ismine göre okunur; export'a kolon eklendiğinde (ör. MERCH_TC_NO)
    //    sabit indeksler kaydığından sup/jr boş kalıp Sup/Jr'ın şube listesi
    //    boşalıyordu — bu yüzden isimle eşleştiriyoruz.
    const supJrMap = new Map<string, { sup: string; jr: string }>()
    try {
      const { rows: mdRows } = parseHtmlTableByHeader(await fetchPhpHtml(MERCH_URL))
      for (const r of mdRows) {
        const subeKod = (r['SUBE_KODU'] ?? '').trim()
        if (!subeKod || supJrMap.has(subeKod)) continue
        supJrMap.set(subeKod, {
          sup: (r['SUPERVIZOR'] ?? '').trim(),
          jr:  (r['JR_SUPERVIZOR'] ?? '').trim(),
        })
      }
    } catch { /* sup/jr olmadan devam et */ }

    // 3. Birleştir
    const seen = new Set<string>()
    const data: CariSube[] = []
    for (const r of csRows) {
      const cari_adi = (r['CARI_ADI'] ?? '').trim()
      if (!cari_adi) continue
      const sube_kod = (r['SUBE_KOD'] ?? '').trim()
      const sube_adi = (r['SUBE_ADI'] ?? '').trim()

      const key = `${cari_adi}||${sube_adi}`
      if (seen.has(key)) continue
      seen.add(key)

      const enrich = supJrMap.get(sube_kod)
      data.push({
        cari_adi,
        sube_adi,
        bsy_adi: (r['BSY_ADI'] ?? '').trim(),
        bsy_kod: (r['BSY_KODU'] ?? '').trim(),
        sup_adi: enrich?.sup || '',
        jr_adi:  enrich?.jr  || '',
      })
    }

    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
