import { NextResponse } from 'next/server'

const MERCH_URL = 'http://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

const COL = { CARI_ISIM: 1, SUBE_ADI: 2, MERCH_TIPI: 14 }

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').trim()
}

export async function GET() {
  let html = ''
  try {
    const res = await fetch(MERCH_URL, { next: { revalidate: 900 }, headers: { 'Accept-Encoding': 'gzip, deflate' } })
    html = await res.text()
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const cariSet = new Set<string>()
  const subeSet = new Set<string>()
  const tdRe = /<td[^>]*>(.*?)<\/td>/g
  const parts = html.split('</tr>')

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part.includes('<td')) continue
    const cells: string[] = []
    let m: RegExpExecArray | null
    tdRe.lastIndex = 0
    while ((m = tdRe.exec(part)) !== null) cells.push(decodeHtml(m[1]))
    if (cells.length < 15) continue
    if (cells[COL.MERCH_TIPI] !== 'Bayi Merch') continue
    if (cells[COL.CARI_ISIM]) cariSet.add(cells[COL.CARI_ISIM])
    if (cells[COL.SUBE_ADI])  subeSet.add(cells[COL.SUBE_ADI])
  }

  return NextResponse.json({
    cariOptions: [...cariSet].sort(),
    subeOptions: [...subeSet].sort(),
  })
}
