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
      { next: { revalidate: 900 } }
    )
    if (!phpRes.ok) return NextResponse.json({ rows: [] })

    const html = await phpRes.text()

    // Cari adının ilk 2 normalize kelimesi (kısaltma uyumsuzluklarını aşmak için)
    function shortCari(cari: string): string {
      return normalize(cari).split(' ').slice(0, 2).join(' ')
    }

    type PhpEntry = { cari_adi: string; sube_adi: string; merch: string; bsy: string; sup: string; jr: string }

    // İki paralel harita:
    //   fullMap:  normalize(sube)||normalize(cari)         — tam eşleşme
    //   shortMap: normalize(sube)||shortCari(cari)         — kısaltma fallback
    const fullMap  = new Map<string, PhpEntry>()
    const shortMap = new Map<string, PhpEntry>()

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

      const fullKey  = `${normalize(subeAdi)}||${normalize(cariAdi)}`
      const shortKey = `${normalize(subeAdi)}||${shortCari(cariAdi)}`

      const entry: PhpEntry = {
        cari_adi: cariAdi,
        sube_adi: subeAdi,
        merch:    (merchAdi && merchTipi === 'Çetinler Merch') ? merchAdi : '',
        bsy,
        sup:      supAdiPHP,
        jr:       jrAdi,
      }

      // Haritaya ekle — Çetinler Merch girdisi varsa tercih et (önce yazılan korunur)
      if (!fullMap.has(fullKey) || entry.merch)  fullMap.set(fullKey, entry)
      if (!shortMap.has(shortKey) || entry.merch) shortMap.set(shortKey, entry)
    }

    // Verilen subeKey için PHP girdisini döndür (tam key → kısa key fallback)
    function phpEntry(normSube: string, normCari: string, origCari: string): PhpEntry | undefined {
      return fullMap.get(`${normSube}||${normCari}`) ?? shortMap.get(`${normSube}||${shortCari(origCari)}`)
    }

    const normalizedSupAdi = supAdi ? normalize(supAdi) : null

    // 3. Her destek personeli → satır oluştur
    const rows: DestekPersonelRow[] = []

    for (const dp of destekPersonel) {
      const ns = normalize(dp.sube_adi)
      const nc = normalize(dp.cari_adi)
      const php = phpEntry(ns, nc, dp.cari_adi)

      if (bsyKod) {
        if ((php?.bsy ?? '') !== bsyKod) continue
      } else if (normalizedSupAdi) {
        const phpSup = normalize(php?.sup ?? '')
        if (phpSup !== normalizedSupAdi) continue
      }

      // Cari/şube adını PHP'den al (daha tutarlı format), yoksa field_personnel'dan
      // PHP eşleşmesi yoksa veya Çetinler Merch atanmamışsa bu satırı gösterme
      const cetinlerMerch = php?.merch || ''
      if (!cetinlerMerch) continue

      const displayCari = php?.cari_adi || dp.cari_adi
      const displaySube = php?.sube_adi || dp.sube_adi
      const supAdiRaw     = php?.sup  ?? ''
      const jrAdiRaw      = php?.jr   ?? ''

      // Süpervizör kolonunda Jr. Sup varsa onu göster, üstünde Sup adı küçük
      const displaySup    = jrAdiRaw || supAdiRaw
      const displayParent = jrAdiRaw ? supAdiRaw : ''

      rows.push({
        merch_adi:           dp.merch_adi,
        sube_adi:            displaySube,
        cari_adi:            displayCari,
        cetinler_merch:      cetinlerMerch || '-',
        sup_adi:             displaySup,
        parent_sup_adi:      displayParent,
        kategori:            '-',
        hedef_gerceklesme:   0,
        satis_adedi:         0,
        kosullu_destek_prim: 0,
        hak_edis:            0,
      })
    }

    // Aynı kişi birden fazla şubede kayıtlıysa (ör. "ADAPAZARI" + "ADAPAZARI 4")
    // → cari + merch_adi bazında dedup; supervisor verisi olan satırı tercih et
    const dedupMap = new Map<string, DestekPersonelRow>()
    for (const row of rows) {
      const mk = `${normalize(row.cari_adi)}||${normalize(row.sube_adi)}||${row.merch_adi.toLowerCase()}`
      const existing = dedupMap.get(mk)
      if (!existing || (!existing.sup_adi && row.sup_adi)) {
        dedupMap.set(mk, row)
      }
    }

    const finalRows = [...dedupMap.values()]
    finalRows.sort((a, b) => a.merch_adi.localeCompare(b.merch_adi, 'tr'))

    return NextResponse.json({ rows: finalRows })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
