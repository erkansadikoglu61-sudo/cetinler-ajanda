import { NextResponse } from 'next/server'

const SOURCE_URL =
  'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

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
  merch_tipi: string   // [14] 'Çetinler Merch' | diğer
  sv_tipi:    string   // [15] 'Kıdemli Supervisor' vb.
  bsy:        string   // [16] BSY kodu: KB1, IB1, IB2, MB1...
}

/** Yaygın HTML entity'lerini decode et (&amp; → & vb.) */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function parseHtmlTable(html: string): SelloutRow[] {
  const rows: SelloutRow[] = []

  // Her <tr>…</tr> bloğunu al
  const trMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]

  // İlk satır başlık (<th> içerir) – atla
  for (let i = 1; i < trMatches.length; i++) {
    const rowHtml = trMatches[i][1]

    // Her <td>…</td> içeriğini çıkar, HTML tag'lerini ve entity'leri temizle
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')).trim()
    )

    if (cells.length < 15) continue

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
      merch_tipi:     cells[14],
      sv_tipi:        cells[15] ?? '',
      bsy:            cells[16] ?? '',
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
