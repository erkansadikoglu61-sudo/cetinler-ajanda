import { requireRole, ROLLER } from '@/lib/apiAuth'
import { NextResponse, after } from 'next/server'
import { fetchPhpHtml } from '@/lib/merchSatis'
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
        // Ortak PHP cache katmanı (bellek + Storage). Kategori yalnızca Excel'de
        // eksik olanları tamamlar → PHP 15 sn'de gelmezse beklemeden devam et;
        // çekim arka planda (after) sürer ve cache'i bir sonraki açılış için doldurur.
        const phpPromise = fetchPhpHtml(`${phpUrl}?${params}`)
        after(() => phpPromise.then(() => {}, () => {}))
        const htmlText = await Promise.race([
          phpPromise,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 15_000)),
        ])

        if (htmlText) {
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
// Body: { yil, ay, rows: [{stokKodu, kategori?, bayiMerch, kosulluDestek}] }
// Upserts per-month overrides
export async function PUT(req: Request) {
  const yetki = await requireRole(req, ROLLER.ADMIN)
  if (yetki instanceof NextResponse) return yetki
  try {
    const body = await req.json() as {
      yil:  number
      ay:   number
      rows: { stokKodu: string; kategori?: string | null; bayiMerch: number | null; kosulluDestek: number | null }[]
    }

    const sb = getSupabase()
    const upsertRows = body.rows.map(r => ({
      stok_kodu:     r.stokKodu,
      yil:           body.yil,
      ay:            body.ay,
      bayi_merch:    r.bayiMerch,
      kosullu_destek: r.kosulluDestek,
      kategori:      r.kategori?.trim() || null,
      updated_at:    new Date().toISOString(),
    }))

    let { error } = await sb
      .from('adet_prim_override')
      .upsert(upsertRows, { onConflict: 'stok_kodu,yil,ay' })
    // kategori kolonu henüz yoksa (migration çalışmadıysa) kategorisiz kaydet
    if (error && /kategori/i.test(error.message)) {
      ({ error } = await sb
        .from('adet_prim_override')
        .upsert(upsertRows.map(({ kategori: _k, ...r }) => r), { onConflict: 'stok_kodu,yil,ay' }))
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PHP raporu yavaş/büyük: kalıcı cache + arka plan yenileme için süre
export const maxDuration = 300
