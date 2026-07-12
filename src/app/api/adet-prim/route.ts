import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { AdetPrimRow } from '@/lib/adet-prim-defaults'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// GET /api/adet-prim?yil=2026&ay=5
// Returns data from SAHA.xlsx "Adet Primleri" sheet + kategoriler from PHP
export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = parseInt(sp.get('yil') ?? String(new Date().getFullYear()))
  const ay  = parseInt(sp.get('ay')  ?? String(new Date().getMonth() + 1))

  try {
    const sb = getSupabase()

    // 1. SAHA.xlsx'den Adet Primleri sayfasını çek
    const { data: excelData, error: excelError } = await sb.storage
      .from('bsy-excel')
      .download('SAHA.xlsx')

    if (excelError) {
      console.error('Excel download error:', excelError)
      return NextResponse.json({ rows: [] })
    }

    const buffer = Buffer.from(await excelData.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })

    if (!wb.SheetNames.includes('Adet Primleri')) {
      console.error('Adet Primleri sheet not found. Available sheets:', wb.SheetNames)
      return NextResponse.json({ rows: [] })
    }

    const ws = wb.Sheets['Adet Primleri']
    const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (jsonData.length < 2) {
      return NextResponse.json({ rows: [] })
    }

    // 2. Header mapping — başlık satırını bul (ilk 5 satırda tara)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const rowStr = jsonData[i].map((c: any) => String(c ?? '').toLowerCase()).join(' ')
      if (rowStr.includes('stok') && (rowStr.includes('kod') || rowStr.includes('kategori'))) {
        headerRowIdx = i
        break
      }
    }

    const headerRow = jsonData[headerRowIdx]
    const cols: { [key: string]: number } = {}

    headerRow.forEach((h: any, c: number) => {
      const hs = String(h ?? '').toLowerCase().trim()
      if (hs.includes('marka')) cols['marka'] = c
      if (hs.includes('kategori')) cols['kategori'] = c
      if (hs.includes('stok') && hs.includes('kod')) cols['stokKodu'] = c
      if (hs.includes('bayi') && hs.includes('merch')) cols['bayiMerch'] = c
      if (hs.includes('koşullu') || hs.includes('kosullu') || hs.includes('destek')) cols['kosulluDestek'] = c
    })

    // 3. Parse rows
    const primData: Record<string, AdetPrimRow> = {}

    for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
      const row = jsonData[r]
      if (!row || row.length === 0) continue

      const stokKodu = cols['stokKodu'] >= 0 ? String(row[cols['stokKodu']] ?? '').trim() : ''
      const kategori = cols['kategori'] >= 0 ? String(row[cols['kategori']] ?? '').trim() : ''
      const bayiMerch = cols['bayiMerch'] >= 0 ? parseFloat(String(row[cols['bayiMerch']] ?? '0')) || null : null
      const kosulluDestek = cols['kosulluDestek'] >= 0 ? parseFloat(String(row[cols['kosulluDestek']] ?? '0')) || null : null

      if (stokKodu) {
        primData[stokKodu] = {
          stokKodu,
          kategori: kategori || null,
          bayiMerch,
          kosulluDestek
        }
      }
    }

    // 4. Fetch kategoriler from PHP API (eğer Excel'de yoksa)
    const phpUrl = process.env.PHP_API_URL
    if (phpUrl) {
      try {
        const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
        const response = await fetch(`${phpUrl}?${params}`, {
          next: { revalidate: 900 }, // 15 dakika cache
        })

        if (response.ok) {
          const htmlText = await response.text()
          const kategoriMap = new Map<string, string>()
          const trMatches = htmlText.match(/<tr>[\s\S]*?<\/tr>/gi) || []

          for (let i = 1; i < trMatches.length; i++) {
            const tr = trMatches[i]
            const tdMatches = tr.match(/<td>([\s\S]*?)<\/td>/gi) || []

            if (tdMatches.length >= 6) {
              const stokKodu = tdMatches[4]?.replace(/<\/?td>/gi, '').trim()
              const grupAciklama = tdMatches[5]?.replace(/<\/?td>/gi, '').trim()

              if (stokKodu && grupAciklama && !kategoriMap.has(stokKodu)) {
                kategoriMap.set(stokKodu, grupAciklama)
              }
            }
          }

          // Kategori bilgisini merge et (sadece Excel'de yoksa)
          for (const [stokKodu, kategori] of kategoriMap) {
            if (primData[stokKodu] && !primData[stokKodu].kategori) {
              primData[stokKodu].kategori = kategori
            }
          }
        }
      } catch (e) {
        console.error('PHP kategori fetch error:', e)
      }
    }

    // 5. Fetch DB overrides (kullanıcı düzenlemeleri)
    try {
      const { data: overrides } = await sb
        .from('adet_prim_override')
        .select('stok_kodu, bayi_merch, kosullu_destek')
        .eq('yil', yil)
        .eq('ay', ay)

      if (overrides) {
        for (const row of overrides) {
          if (primData[row.stok_kodu]) {
            primData[row.stok_kodu] = {
              ...primData[row.stok_kodu],
              bayiMerch:     row.bayi_merch,
              kosulluDestek: row.kosullu_destek,
            }
          } else {
            primData[row.stok_kodu] = {
              stokKodu:      row.stok_kodu,
              kategori:      null,
              bayiMerch:     row.bayi_merch,
              kosulluDestek: row.kosullu_destek,
            }
          }
        }
      }
    } catch (e) {
      console.error('DB override fetch error:', e)
    }

    return NextResponse.json({ rows: Object.values(primData) })
  } catch (e) {
    console.error('Adet prim API error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/adet-prim
// Body: { yil, ay, rows: [{stokKodu, bayiMerch, kosulluDestek}] }
// Upserts per-month overrides
export async function PUT(req: Request) {
  try {
    const body = await req.json() as {
      yil:  number
      ay:   number
      rows: { stokKodu: string; bayiMerch: number | null; kosulluDestek: number | null }[]
    }

    const sb = getSupabase()
    const upsertRows = body.rows.map(r => ({
      stok_kodu:     r.stokKodu,
      yil:           body.yil,
      ay:            body.ay,
      bayi_merch:    r.bayiMerch,
      kosullu_destek: r.kosulluDestek,
      updated_at:    new Date().toISOString(),
    }))

    const { error } = await sb
      .from('adet_prim_override')
      .upsert(upsertRows, { onConflict: 'stok_kodu,yil,ay' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
