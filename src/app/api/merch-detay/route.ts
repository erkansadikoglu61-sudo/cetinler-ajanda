import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    // export_merch_detay.php'den tüm merch bilgilerini çek
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

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

      if (tdMatches.length >= 12) {
        const cells = tdMatches.map(td => decodeHtml(td.replace(/<\/?td[^>]*>/gi, '')))

        // export_merch_detay.php column mapping (Excel'deki sıraya göre):
        // 0: MERCH_ADI
        // 1: MERCH_ID
        // 2: MERCH_TIPI (Bayi Merch / Çetinler Merch)
        // 3: CARI_KODU
        // 4: CARI_ISIM
        // 5: SUBE_KODU
        // 6: SUBE_ADI
        // 7: IBAN
        // 8: BSY_KODU
        // 9: BSY_ADI
        // 10: SUPERVIZOR
        // 11: JR_SUPERVIZOR

        const merchAdi = cells[0] || ''
        const merchId = cells[1] || ''
        const merchTipi = cells[2] || ''
        const cariKod = cells[3] || ''
        const cariAdi = cells[4] || ''
        const subeKod = cells[5] || ''
        const subeAdi = cells[6] || ''
        const iban = cells[7] || ''
        const bsyKod = cells[8] || ''
        const bsyAdi = cells[9] || ''
        const supAdi = cells[10] || ''
        const jrSupAdi = cells[11] || ''

        if (!merchAdi) continue

        // Unique key: merch_adi + cari_kod
        const key = `${merchAdi}||${cariKod}`

        if (!merchMap.has(key)) {
          merchMap.set(key, {
            merch_adi: merchAdi,
            merch_id: merchId,
            merch_grubu: merchTipi,
            cari_kod: cariKod,
            cari_adi: cariAdi,
            sube_kod: subeKod,
            sube_adi: subeAdi,
            iban: iban,
            bsy_kod: bsyKod,
            bsy_adi: bsyAdi,
            sup_adi: jrSupAdi || supAdi, // Jr varsa onu, yoksa Sup'ı kullan
          })
        }
      }
    }

    // Destek Personeli'ni Supabase'den ekle
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: destekData } = await supabase
        .from('field_personnel')
        .select('merch_adi, merch_grubu, cari_adi, sube_adi, sup_adi, bsy_adi')
        .eq('merch_grubu', 'Destek Personeli')

      if (destekData) {
        destekData.forEach(d => {
          const key = `${d.merch_adi}||${d.cari_adi}`
          if (!merchMap.has(key)) {
            merchMap.set(key, {
              merch_adi: d.merch_adi || '',
              merch_id: '',
              merch_grubu: 'Destek Personeli',
              cari_kod: '',
              cari_adi: d.cari_adi || '',
              sube_kod: '',
              sube_adi: d.sube_adi || '',
              iban: '',
              bsy_kod: '',
              bsy_adi: d.bsy_adi || '',
              sup_adi: d.sup_adi || '',
            })
          }
        })
      }
    } catch (dbError) {
      console.warn('Destek Personeli fetch hatası:', dbError)
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
