import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader } from '@/lib/merchSatis'

const MERCH_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

export async function GET() {
  let html = ''
  try {
    const res = await fetch(MERCH_URL, { next: { revalidate: 900 }, headers: { 'Accept-Encoding': 'gzip, deflate' } })
    html = await res.text()
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const cariSet  = new Set<string>()
  const subeSet  = new Set<string>()
  const grupSet  = new Set<string>()
  // grup_kodu -> Set<stok_kodu>
  const grupStokMap: Record<string, Set<string>> = {}

  const { rows } = parseHtmlTableByHeader(html)

  for (const row of rows) {
    if (row['MERCH_TIPI'] !== 'Bayi Merch') continue
    if (row['CARI_ISIM']) cariSet.add(row['CARI_ISIM'])
    if (row['SUBE_ADI'])  subeSet.add(row['SUBE_ADI'])
    const g = row['GRUP_KODU']
    const s = (row['STOK_KODU'] ?? '').toUpperCase()
    if (g) {
      grupSet.add(g)
      if (s) {
        if (!grupStokMap[g]) grupStokMap[g] = new Set()
        grupStokMap[g].add(s)
      }
    }
  }

  // Convert sets to sorted arrays
  const grupStokMapSorted: Record<string, string[]> = {}
  for (const [g, stokSet] of Object.entries(grupStokMap)) {
    grupStokMapSorted[g] = [...stokSet].sort()
  }

  return NextResponse.json({
    cariOptions:  [...cariSet].sort(),
    subeOptions:  [...subeSet].sort(),
    grupOptions:  [...grupSet].sort(),
    grupStokMap:  grupStokMapSorted,
  })
}
