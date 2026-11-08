import { requireRole, ROLLER } from '@/lib/apiAuth'
import { NextResponse, after } from 'next/server'
import { fetchPhpHtml, parseHtmlTableByHeader } from '@/lib/merchSatis'
import { GRUP_NORMALIZE } from '@/lib/sellout'
import { createClient } from '@supabase/supabase-js'
import { loadAdetPrimRates } from '@/lib/adetPrimRates'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Stok → grup kodu / kategori (B2B satış raporu) ──────────────────
const MERCH_SATIS_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'
const GRUP_SIRASI = ['RELUX', 'EKEA']
function grupSira(g?: string): number {
  const i = GRUP_SIRASI.indexOf((g ?? '').toUpperCase())
  return i >= 0 ? i : (g ? GRUP_SIRASI.length : GRUP_SIRASI.length + 1)  // bilinmeyen en sonda
}
function markaToGrup(marka?: string | null): string {
  const m = (marka ?? '').toLocaleLowerCase('tr')
  if (m.includes('relux')) return 'RELUX'
  if (m.includes('electrolux') || m.includes('ekea')) return 'EKEA'
  return ''
}
let stokGrupCache: { at: number; map: Map<string, { grupKodu: string; aciklama: string }> } | null = null
async function stokGrupHaritasi(): Promise<Map<string, { grupKodu: string; aciklama: string }> | null> {
  if (stokGrupCache && Date.now() - stokGrupCache.at < 10 * 60 * 1000) return stokGrupCache.map
  const p = fetchPhpHtml(MERCH_SATIS_URL).then(html => {
    const map = new Map<string, { grupKodu: string; aciklama: string }>()
    for (const r of parseHtmlTableByHeader(html).rows) {
      const stok = (r['STOK_KODU'] ?? '').trim().toUpperCase()
      if (!stok || map.has(stok)) continue
      map.set(stok, { grupKodu: (r['GRUP_KODU'] ?? '').trim().toUpperCase(), aciklama: (r['GRUP_ACIKLAMA'] ?? '').trim() })
    }
    stokGrupCache = { at: Date.now(), map }
    return map
  })
  after(() => p.then(() => {}, () => {}))
  return Promise.race([p, new Promise<null>(res => setTimeout(() => res(null), 15_000))]).catch(() => null)
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

    // 4. Grup kodu (RELUX / EKEA …) ve eksik kategori: B2B satış raporundan
    //    stok bazında (STOK_KODU → GRUP_KODU / GRUP_ACIKLAMA). Rapor ortak
    //    cache'te; 15 sn'de gelmezse Excel "Marka" sütununa düşülür.
    const stokGrup = await stokGrupHaritasi()
    for (const r of Object.values(primData)) {
      const g = stokGrup?.get(r.stokKodu.trim().toUpperCase())
      const raporGrup = g?.grupKodu ?? ''
      r.grupKodu = (GRUP_SIRASI.includes(raporGrup) ? raporGrup : '') || markaToGrup(r.marka) || raporGrup
      if (!r.kategori && g?.aciklama) r.kategori = GRUP_NORMALIZE[g.aciklama] ?? g.aciklama
    }

    // Sıralama: önce grup kodu (RELUX → EKEA → diğerleri), sonra Stok Kodu — alfabetik
    const rows = Object.values(primData).sort((a, b) =>
      grupSira(a.grupKodu) - grupSira(b.grupKodu) ||
      (a.grupKodu ?? '').localeCompare(b.grupKodu ?? '', 'tr') ||
      a.stokKodu.localeCompare(b.stokKodu, 'tr'))
    return NextResponse.json({ rows })
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
