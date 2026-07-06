import { NextResponse } from 'next/server'

interface MerchDetay {
  merch_adi: string
  merch_id: string
  merch_grubu: string
  cari_kod: string
  cari_adi: string
  sube_kod: string
  sube_adi: string
  iban: string
  bsy_kod: string
  bsy_adi: string
  sup_adi: string
}

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

export async function GET() {
  try {
    // Satış verisinden unique merch listesi çıkar (Çetinler Merch dahil)
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

    const response = await fetch(phpUrl, {
      next: { revalidate: 900 }, // 15 dakika cache
    })

    if (!response.ok) {
      return NextResponse.json({ error: `PHP API returned ${response.status}` }, { status: 500 })
    }

    const htmlText = await response.text()
    const merchMap = new Map<string, MerchDetay>()

    // HTML table parse
    const trMatches = htmlText.match(/<tr>[\s\S]*?<\/tr>/gi) || []

    for (let i = 1; i < trMatches.length; i++) {
      const tr = trMatches[i]
      const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []

      if (tdMatches.length >= 15) {
        const cells = tdMatches.map(td => decodeHtml(td.replace(/<\/?td[^>]*>/gi, '')))

        // export_merch_satis.php column mapping:
        // 0: MERCH_PERSONEL
        // 1: CARI_ISIM
        // 2: SUBE_ADI
        // 3: STOK_ADI
        // 4: STOK_KODU
        // 5: GRUP_ACIKLAMA
        // 6: SATILAN_ADET
        // 7: GRUP_KODU
        // 8: BEKLENEN_CIRO
        // 9: SUPERVISOR_ADI
        // 10: CARI_KOD
        // 11: SUBE_KOD
        // 12: DONEM
        // 13: TARIH
        // 14: MERCH_TIPI
        // 15: SV_TIPI (varsa)
        // 16: BSY_ADI (varsa)

        const merchAdi = cells[0] || ''
        const merchTipi = cells[14] || ''
        const cariKod = cells[10] || ''
        const cariAdi = cells[1] || ''
        const subeKod = cells[11] || ''
        const subeAdi = cells[2] || ''
        const supAdi = cells[9] || ''
        const bsyAdi = cells[16] || ''

        if (!merchAdi) continue

        // Unique key: merch_adi + cari_kod
        const key = `${merchAdi}||${cariKod}`

        if (!merchMap.has(key)) {
          merchMap.set(key, {
            merch_adi: merchAdi,
            merch_id: '',
            merch_grubu: merchTipi,
            cari_kod: cariKod,
            cari_adi: cariAdi,
            sube_kod: subeKod,
            sube_adi: subeAdi,
            iban: '',
            bsy_kod: '',
            bsy_adi: bsyAdi,
            sup_adi: supAdi,
          })
        }
      }
    }

    const merchList = Array.from(merchMap.values())

    return NextResponse.json({
      count: merchList.length,
      data: merchList
    })
  } catch (error) {
    console.error('Merch detay fetch error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
