import { NextResponse } from 'next/server'
import { loadSelloutRows } from '@/lib/selloutData'

export type { SelloutRow } from '@/lib/selloutData'

// 28MB PHP fetch + 62k satır parse soğuk çağrıda ~10sn sürüyor; varsayılan
// timeout'a takılıp 504 (→ boş sellout) üretmemesi için süreyi uzatıyoruz.
export const maxDuration = 300

// Satır yükleme ve Jr ataması: lib/selloutData (v2 uçlarıyla ortak).

export async function GET() {
  try {
    const rows = await loadSelloutRows()
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
