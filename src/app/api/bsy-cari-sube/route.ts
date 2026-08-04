import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'
const MERCH_URL     = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

function parseRows(html: string): string[][] {
  const trs = html.match(/<tr>[\s\S]*?<\/tr>/gi) || []
  const out: string[][] = []
  for (let i = 1; i < trs.length; i++) {
    const cells = (trs[i].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [])
      .map(td => decodeHtml(td.replace(/<\/?t[dh][^>]*>/gi, '')))
    if (cells.length > 0) out.push(cells)
  }
  return out
}

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
    // 1. Ana kaynak: BSY / Cari / Şube (tam liste)
    //    Kolonlar: 0 BSY_KODU, 1 BSY_ADI, 2 CARI_KOD, 3 CARI_ADI, 4 SUBE_KOD, 5 SUBE_ADI
    const csRes = await fetch(CARI_SUBE_URL, { next: { revalidate: 900 } })
    if (!csRes.ok) {
      return NextResponse.json({ error: `Kaynak hatası: ${csRes.status}` }, { status: 502 })
    }
    const csRows = parseRows(await csRes.text())

    // 2. Zenginleştirme: merch-detay'dan sube_kod → { sup_adi, jr_adi }
    //    merch-detay kolonları: 5 SUBE_KODU, 10 SUPERVIZOR, 11 JR_SUPERVIZOR
    const supJrMap = new Map<string, { sup: string; jr: string }>()
    try {
      const mdRes = await fetch(MERCH_URL, { next: { revalidate: 900 } })
      if (mdRes.ok) {
        const mdRows = parseRows(await mdRes.text())
        for (const c of mdRows) {
          if (c.length < 12) continue
          const subeKod = (c[5] || '').trim()
          if (!subeKod) continue
          if (!supJrMap.has(subeKod)) {
            supJrMap.set(subeKod, { sup: (c[10] || '').trim(), jr: (c[11] || '').trim() })
          }
        }
      }
    } catch { /* sup/jr olmadan devam et */ }

    // 3. Birleştir
    const seen = new Set<string>()
    const data: CariSube[] = []
    for (const c of csRows) {
      if (c.length < 6) continue
      const bsy_kod  = (c[0] || '').trim()
      const bsy_adi  = (c[1] || '').trim()
      const cari_adi = (c[3] || '').trim()
      const sube_kod = (c[4] || '').trim()
      const sube_adi = (c[5] || '').trim()
      if (!cari_adi) continue

      const enrich = supJrMap.get(sube_kod)
      const key = `${cari_adi}||${sube_adi}`
      if (seen.has(key)) continue
      seen.add(key)

      data.push({
        cari_adi, sube_adi, bsy_adi, bsy_kod,
        sup_adi: enrich?.sup || '',
        jr_adi:  enrich?.jr  || '',
      })
    }

    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
