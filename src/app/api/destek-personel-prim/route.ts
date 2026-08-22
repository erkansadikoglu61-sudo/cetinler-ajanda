import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'

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
      .select('merch_adi, sube_adi, cari_adi, merch_grubu, sup_adi, jr_adi, bsy_adi')
      .eq('merch_grubu', 'Destek Personeli')

    if (fpError) return NextResponse.json({ error: fpError.message }, { status: 500 })
    if (!destekPersonel?.length) return NextResponse.json({ rows: [] })

    // 2. export_merch_detay.php — başlık ismine göre okunur (export'a kolon
    //    eklendiğinde, ör. MERCH_TC_NO, sabit indeksler kayıp sup/cari/şube
    //    alanlarını bozuyordu).
    const html = await fetchPhpHtml('https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php')

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

    const { rows: mdRows } = parseHtmlTableByHeader(html)
    for (const r of mdRows) {
      const cariAdi   = r['CARI_ISIM'] ?? ''
      const subeAdi   = r['SUBE_ADI'] ?? ''
      const bsy       = r['BSY_KODU'] ?? ''
      const supAdiPHP = r['SUPERVIZOR'] ?? ''
      const jrAdi     = r['JR_SUPERVIZOR'] ?? ''
      const merchAdi  = r['MERCH_ADI'] ?? ''
      const merchTipi = r['MERCH_TIPI'] ?? ''

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

      // Süpervizör/Jr: önce merch-detay enrichment, yoksa field_personnel'ın
      // KENDİ sup_adi/jr_adi alanları. Bazı destek personellerinin şubesi
      // (ör. HÜSEYİNGAZİ) merch-detay'da yok → enrichment boş → Süpervizör "-"
      // görünüp Sup filtresine takılıyor, o Süpervizör kişiyi göremiyordu.
      const supAdiRaw = (php?.sup || dp.sup_adi || '').trim()
      const jrAdiRaw  = (php?.jr  || dp.jr_adi  || '').trim()

      if (bsyKod) {
        if ((php?.bsy ?? '') !== bsyKod) continue
      } else if (normalizedSupAdi) {
        // Efektif Süpervizör (enrichment veya field_personnel) ile eşleş
        if (normalize(supAdiRaw) !== normalizedSupAdi) continue
      }

      // Cari/şube adını PHP'den al (daha tutarlı format), yoksa field_personnel'dan
      const cetinlerMerch = php?.merch || ''

      const displayCari = php?.cari_adi || dp.cari_adi
      const displaySube = php?.sube_adi || dp.sube_adi

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
