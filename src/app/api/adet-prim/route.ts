import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADET_PRIM_DEFAULTS, AdetPrimRow } from '@/lib/adet-prim-defaults'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// GET /api/adet-prim?yil=2026&ay=5
// Returns defaults merged with DB overrides for the given month
export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = parseInt(sp.get('yil') ?? String(new Date().getFullYear()))
  const ay  = parseInt(sp.get('ay')  ?? String(new Date().getMonth() + 1))

  // Start with defaults (kategori = null)
  const merged: Record<string, AdetPrimRow> = {}
  for (const r of ADET_PRIM_DEFAULTS) {
    merged[r.stokKodu] = { ...r, kategori: null }
  }

  // Fetch kategoriler from PHP API
  const phpUrl = process.env.PHP_API_URL
  if (phpUrl) {
    try {
      const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
      const response = await fetch(`${phpUrl}?${params}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 },
      })

      if (response.ok) {
        const selloutData = await response.json()
        if (Array.isArray(selloutData)) {
          // stok_kodu → kategori mapping
          const kategoriMap = new Map<string, string>()
          selloutData.forEach((row: any) => {
            const stokKodu = String(row.stok_kodu || '').trim()
            const kategori = String(row.kategori || row.kategori_adi || '').trim()
            if (stokKodu && kategori && !kategoriMap.has(stokKodu)) {
              kategoriMap.set(stokKodu, kategori)
            }
          })

          // Kategori bilgisini merge et
          for (const [stokKodu, kategori] of kategoriMap) {
            if (merged[stokKodu]) {
              merged[stokKodu].kategori = kategori
            }
          }
        }
      }
    } catch (e) {
      console.error('Kategori fetch error:', e)
    }
  }

  // Fetch overrides from DB
  try {
    const sb = getSupabase()
    const { data } = await sb
      .from('adet_prim_override')
      .select('stok_kodu, bayi_merch, kosullu_destek')
      .eq('yil', yil)
      .eq('ay', ay)

    if (data) {
      for (const row of data) {
        if (merged[row.stok_kodu]) {
          merged[row.stok_kodu] = {
            ...merged[row.stok_kodu],
            bayiMerch:    row.bayi_merch,
            kosulluDestek: row.kosullu_destek,
          }
        } else {
          merged[row.stok_kodu] = {
            stokKodu:     row.stok_kodu,
            kategori:     null,
            bayiMerch:    row.bayi_merch,
            kosulluDestek: row.kosullu_destek,
          }
        }
      }
    }
  } catch {
    // Table might not exist yet — use defaults
  }

  return NextResponse.json({ rows: Object.values(merged) })
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
