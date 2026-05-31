import { NextResponse } from 'next/server'
import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const MERCH_URL = 'http://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

// Column indices in the HTML table
const COL = {
  MERCH_PERSONEL: 0,
  CARI_ISIM:      1,
  SUBE_ADI:       2,
  STOK_ADI:       3,
  STOK_KODU:      4,
  SATILAN_ADET:   6,
  SUPERVISOR_ADI: 9,
  DONEM:          12,
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

interface HakdisRow {
  supervizor:   string
  cariAdi:      string
  subeAdi:      string
  bayiMerch:    string
  primHakdis:   number
  satisAdet:    number
}

export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = parseInt(sp.get('yil') ?? String(new Date().getFullYear()))
  const ay  = parseInt(sp.get('ay')  ?? String(new Date().getMonth() + 1))
  const donem = `${yil}-${String(ay).padStart(2, '0')}`

  // 1. Fetch prim rates (DB overrides + defaults)
  const primMap = new Map<string, number | null>()
  for (const r of ADET_PRIM_DEFAULTS) {
    primMap.set(r.stokKodu, r.bayiMerch)
  }
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await sb
      .from('adet_prim_override')
      .select('stok_kodu, bayi_merch')
      .eq('yil', yil)
      .eq('ay', ay)
    if (data) {
      for (const row of data) {
        primMap.set(row.stok_kodu, row.bayi_merch)
      }
    }
  } catch { /* use defaults */ }

  // 2. Fetch external HTML (cached 15 min at Next.js data cache)
  let html = ''
  try {
    const res = await fetch(MERCH_URL, {
      next: { revalidate: 900 },
      headers: { 'Accept-Encoding': 'gzip, deflate' },
    })
    html = await res.text()
  } catch (e) {
    return NextResponse.json({ error: 'Dış kaynak alınamadı: ' + String(e) }, { status: 500 })
  }

  // 3. Parse HTML table rows
  // Rows are separated by </tr> — split and process each
  const parts = html.split('</tr>')
  const aggMap = new Map<string, { supervizor: string; cariAdi: string; subeAdi: string; bayiMerch: string; primHakdis: number; satisAdet: number }>()

  const tdRe = /<td[^>]*>(.*?)<\/td>/g

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part.includes('<td')) continue

    const cells: string[] = []
    let m: RegExpExecArray | null
    tdRe.lastIndex = 0
    while ((m = tdRe.exec(part)) !== null) {
      cells.push(decodeHtml(m[1]))
    }
    if (cells.length < 13) continue

    // Filter by donem
    if (cells[COL.DONEM] !== donem) continue

    const stokKodu    = cells[COL.STOK_KODU].toUpperCase()
    const satisAdet   = parseFloat(cells[COL.SATILAN_ADET]) || 0
    const bayiMerchPrim = primMap.get(stokKodu) ?? null
    const prim        = bayiMerchPrim != null ? satisAdet * bayiMerchPrim : 0

    const key = `${cells[COL.SUPERVISOR_ADI]}||${cells[COL.CARI_ISIM]}||${cells[COL.SUBE_ADI]}||${cells[COL.MERCH_PERSONEL]}`

    const existing = aggMap.get(key)
    if (existing) {
      existing.primHakdis += prim
      existing.satisAdet  += satisAdet
    } else {
      aggMap.set(key, {
        supervizor:  cells[COL.SUPERVISOR_ADI],
        cariAdi:     cells[COL.CARI_ISIM],
        subeAdi:     cells[COL.SUBE_ADI],
        bayiMerch:   cells[COL.MERCH_PERSONEL],
        primHakdis:  prim,
        satisAdet:   satisAdet,
      })
    }
  }

  const rows: HakdisRow[] = [...aggMap.values()]
    .sort((a, b) => b.primHakdis - a.primHakdis)

  return NextResponse.json({ rows, donem })
}
