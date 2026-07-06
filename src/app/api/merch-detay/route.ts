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
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

    const response = await fetch(phpUrl, {
      next: { revalidate: 900 }, // 15 dakika cache
    })

    if (!response.ok) {
      return NextResponse.json({ error: `PHP API returned ${response.status}` }, { status: 500 })
    }

    const htmlText = await response.text()
    const merchList: MerchDetay[] = []

    // HTML table parse
    const trMatches = htmlText.match(/<tr>[\s\S]*?<\/tr>/gi) || []

    for (let i = 1; i < trMatches.length; i++) {
      const tr = trMatches[i]
      const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []

      if (tdMatches.length >= 11) {
        const cells = tdMatches.map(td => decodeHtml(td.replace(/<\/?td[^>]*>/gi, '')))

        // Index mapping (görünen veriye göre)
        // 0: Merch Adı
        // 1: Merch ID
        // 2: Merch Grubu (Bayi Merch / Çetinler Merch / Destek Personeli)
        // 3: Cari Kod
        // 4: Cari Adı
        // 5: Şube Kod
        // 6: Şube Adı
        // 7: IBAN
        // 8: BSY Kod
        // 9: BSY Adı
        // 10: Supervisor Adı

        merchList.push({
          merch_adi: cells[0] || '',
          merch_id: cells[1] || '',
          merch_grubu: cells[2] || '',
          cari_kod: cells[3] || '',
          cari_adi: cells[4] || '',
          sube_kod: cells[5] || '',
          sube_adi: cells[6] || '',
          iban: cells[7] || '',
          bsy_kod: cells[8] || '',
          bsy_adi: cells[9] || '',
          sup_adi: cells[10] || '',
        })
      }
    }

    return NextResponse.json({
      count: merchList.length,
      data: merchList
    })
  } catch (error) {
    console.error('Merch detay fetch error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
