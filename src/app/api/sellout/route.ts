import { NextResponse } from 'next/server'

const SOURCE_URL =
  'http://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

export interface SelloutRow {
  merch_personel: string
  cari_isim: string
  sube_adi: string
  stok_adi: string
  stok_kodu: string
  grup_aciklama: string
  satilan_adet: number
  grup_kodu: string
  beklened_ciro: number
  supervisor_adi: string
  cari_kod: string
  sube_kod: string
  donem: string
  tarih: string
}

function parseHtmlTable(html: string): SelloutRow[] {
  const rows: SelloutRow[] = []

  // Her <tr>…</tr> bloğunu al
  const trMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]

  // İlk satır başlık (<th> içerir) – atla
  for (let i = 1; i < trMatches.length; i++) {
    const rowHtml = trMatches[i][1]

    // Her <td>…</td> içeriğini çıkar
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => m[1].replace(/<[^>]+>/g, '').trim()
    )

    if (cells.length < 14) continue

    rows.push({
      merch_personel: cells[0],
      cari_isim:      cells[1],
      sube_adi:       cells[2],
      stok_adi:       cells[3],
      stok_kodu:      cells[4],
      grup_aciklama:  cells[5],
      satilan_adet:   parseInt(cells[6]) || 0,
      grup_kodu:      cells[7],
      beklened_ciro:  parseFloat(cells[8].replace(',', '.')) || 0,
      supervisor_adi: cells[9],
      cari_kod:       cells[10],
      sube_kod:       cells[11],
      donem:          cells[12],
      tarih:          cells[13],
    })
  }

  return rows
}

export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, {
      // Vercel Data Cache – 30 dakika boyunca önbellekle
      next: { revalidate: 1800 },
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Kaynak sunucu hatası: ${res.status}` },
        { status: 502 }
      )
    }

    const html = await res.text()
    const rows = parseHtmlTable(html)

    return NextResponse.json({
      rows,
      count: rows.length,
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[sellout] fetch/parse hatası:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
