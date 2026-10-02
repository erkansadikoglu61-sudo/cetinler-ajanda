import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { loadAdetPrimRates } from '@/lib/adetPrimRates'

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

    // 1-3. Oranlar: SAHA.xlsx "Adet Primleri" + ay bazlı adet_prim_override.
    // Ortak fonksiyon — Prim Ödeme (bayi-merch-prim) ve prim-analiz de aynısını kullanır.
    const primData = await loadAdetPrimRates(sb, yil, ay)

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
