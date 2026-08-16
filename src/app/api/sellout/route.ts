import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader, num } from '@/lib/merchSatis'

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

function parseHtmlTable(html: string): SelloutRow[] {
  // Başlık ismine göre ayrıştır (kolon sırası değişse de bozulmaz)
  const { rows: rawRows } = parseHtmlTableByHeader(html)

  return rawRows.map(r => ({
    merch_personel: r['MERCH_PERSONEL'] ?? '',
    cari_isim:      r['CARI_ISIM'] ?? '',
    sube_adi:       r['SUBE_ADI'] ?? '',
    stok_adi:       r['STOK_ADI'] ?? '',
    stok_kodu:      r['STOK_KODU'] ?? '',
    grup_aciklama:  r['GRUP_ACIKLAMA'] ?? '',
    satilan_adet:   num(r['SATILAN_ADET']),
    grup_kodu:      r['GRUP_KODU'] ?? '',
    beklened_ciro:  num(r['BEKLENEN_CIRO']),
    supervisor_adi: r['SUPERVISOR_ADI'] ?? '',
    cari_kod:       r['CARI_KOD'] ?? '',
    sube_kod:       r['SUBE_KOD'] ?? '',
    donem:          r['DONEM'] ?? '',
    tarih:          r['TARIH'] ?? '',
    merch_tipi:     r['MERCH_TIPI'] ?? '',
    sv_tipi:        r['SV_TIPI'] ?? '',
    bsy:            r['BSY'] ?? '',
  }))
}

export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, {
      next: { revalidate: 1800 }, // 30 dakika
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
