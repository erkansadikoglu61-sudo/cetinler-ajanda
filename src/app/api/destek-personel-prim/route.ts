import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface DestekPersonelRow {
  merch_adi:           string
  sube_adi:            string
  cari_adi:            string
  cetinler_merch:      string
  sup_adi:             string   // Jr. Sup varsa Jr. adı, yoksa doğrudan Sup adı
  parent_sup_adi:      string   // Jr. Sup'ın üstündeki Sup adı (yoksa '')
  kategori:            string
  hedef_gerceklesme:   number
  satis_adedi:         number
  kosullu_destek_prim: number
  hak_edis:            number
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
}

function normalize(str: string): string {
  return str.trim().toLowerCase()
    .replace(/İ/g, 'i').replace(/i̇/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\bsv\b/gi, '').replace(/\s+/g, ' ').trim()
}

export async function GET(req: Request) {
  const sp     = new URL(req.url).searchParams
  const yil    = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay     = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1
  const bsyKod = sp.get('bsyKod') || null
  const supAdi = sp.get('supAdi') || null

  try {
    const sb = getAdmin()

    // 1. Destek personelleri
    const { data: destekPersonel, error: fpError } = await sb
      .from('field_personnel')
      .select('merch_adi, sube_adi, cari_adi, merch_grubu')
      .eq('merch_grubu', 'Destek Personeli')

    if (fpError) return NextResponse.json({ error: fpError.message }, { status: 500 })
    if (!destekPersonel?.length) return NextResponse.json({ rows: [] })

    // 2. export_merch_detay.php — kolon mapping:
    //   [0] MERCH_ADI  [1] MERCH_ID  [2] MERCH_TIPI
    //   [3] CARI_KODU  [4] CARI_ISIM [5] SUBE_KODU  [6] SUBE_ADI
    //   [7] IBAN  [8] BSY_KODU  [9] BSY_ADI
    //   [10] SUPERVIZOR  (K kolonu — doğrudan Supervisor: Sinem Bektaş, Songül Durukan…)
    //   [11] JR_SUPERVIZOR
    const phpRes = await fetch(
      'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php',
      { cache: 'no-store' }
    )
    if (!phpRes.ok) return NextResponse.json({ rows: [] })

    const html = await phpRes.text()

    // subeKey = normalize(sube_adi)||normalize(cari_adi)
    const subeCarimierchMap = new Map<string, string>()  // → Çetinler Merch adı
    const subeCariBsyMap    = new Map<string, string>()  // → BSY kodu
    const subeCariSupMap    = new Map<string, string>()  // → SUPERVIZOR (K)
    const subeCariJrMap     = new Map<string, string>()  // → JR_SUPERVIZOR (L)

    const trMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    for (let i = 1; i < trMatches.length; i++) {
      const cells = [...trMatches[i][1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => decodeHtml(m[1].replace(/<[^>]+>/g, '')).trim())
      if (cells.length < 10) continue

      const cariAdi   = cells[4] ?? ''
      const subeAdi   = cells[6] ?? ''
      const bsy       = cells[8] ?? ''
      const supAdiPHP = cells[10] ?? ''
      const jrAdi     = cells[11] ?? ''
      const merchAdi  = cells[0]  ?? ''
      const merchTipi = cells[2]  ?? ''

      if (!subeAdi || !cariAdi) continue
      const key = `${normalize(subeAdi)}||${normalize(cariAdi)}`

      // Çetinler Merch adı (cetinler_merch_hakedis hesabı için)
      if (merchAdi && merchTipi === 'Çetinler Merch' && !subeCarimierchMap.has(key))
        subeCarimierchMap.set(key, merchAdi)

      if (bsy)       subeCariBsyMap.set(key, bsy)
      if (supAdiPHP) subeCariSupMap.set(key, supAdiPHP)
      if (jrAdi)     subeCariJrMap.set(key, jrAdi)
    }

    const normalizedSupAdi = supAdi ? normalize(supAdi) : null

    // 3. Her destek personeli → satır oluştur
    const rows: DestekPersonelRow[] = []

    for (const dp of destekPersonel) {
      const subeKey = `${normalize(dp.sube_adi)}||${normalize(dp.cari_adi)}`

      if (bsyKod) {
        if (subeCariBsyMap.get(subeKey) !== bsyKod) continue
      } else if (normalizedSupAdi) {
        // K kolonundaki SUPERVIZOR'u doğrudan karşılaştır
        const phpSup = normalize(subeCariSupMap.get(subeKey) || '')
        if (phpSup !== normalizedSupAdi) continue
      }

      const cetinlerMerch = subeCarimierchMap.get(subeKey) || '-'
      const supAdiRaw     = subeCariSupMap.get(subeKey) ?? ''
      const jrAdiRaw      = subeCariJrMap.get(subeKey) ?? ''

      // Süpervizör kolonunda Jr. Sup varsa onu göster, üstünde Sup adı küçük
      const displaySup    = jrAdiRaw || supAdiRaw
      const displayParent = jrAdiRaw ? supAdiRaw : ''

      rows.push({
        merch_adi:           dp.merch_adi,
        sube_adi:            dp.sube_adi,
        cari_adi:            dp.cari_adi,
        cetinler_merch:      cetinlerMerch,
        sup_adi:             displaySup,
        parent_sup_adi:      displayParent,
        kategori:            '-',
        hedef_gerceklesme:   0,
        satis_adedi:         0,
        kosullu_destek_prim: 0,
        hak_edis:            0,
      })
    }

    rows.sort((a, b) => a.merch_adi.localeCompare(b.merch_adi, 'tr'))

    return NextResponse.json({ rows })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
