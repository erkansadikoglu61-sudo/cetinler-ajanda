import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'

export const dynamic = 'force-dynamic'

const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'
const MERCH_URL     = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

interface CariSube {
  cari_adi: string
  sube_adi: string
  bsy_adi:  string
  bsy_kod:  string
  sup_adi:  string
  jr_adi:   string
  sups:     string[]   // şubedeki tüm süpervizörler (merch-detay)
  jrs:      string[]   // şubedeki tüm Jr süpervizörler
}

export async function GET() {
  try {
    // 1. Ana kaynak: BSY / Cari / Şube (başlık ismine göre — kolon sırası
    //    değişse de bozulmaz). Kolonlar: BSY_KODU, BSY_ADI, CARI_KOD,
    //    CARI_ADI, SUBE_KOD, SUBE_ADI
    const { rows: csRows } = parseHtmlTableByHeader(await fetchPhpHtml(CARI_SUBE_URL))

    // 2. Zenginleştirme: merch-detay'dan SUBE_KODU → TÜM süpervizör / Jr isimleri.
    //    Başlık ismine göre okunur (export'a kolon eklenince indeks kaymasın).
    // Not: Bir şubede birden çok merch satırı olabilir ve farklı satırlarda
    // farklı süpervizörler bulunabilir (ör. Öz Şanal Bozyaka'da hem Burak Alagöz
    // hem Gülcan Bayer). Önceden yalnızca ilk boş-olmayan süpervizör tutuluyordu;
    // diğer süpervizör o şubeyi görev penceresinde göremiyordu. Artık hepsi
    // `sups` / `jrs` dizilerinde döner; sup_adi / jr_adi ilk değer (geri uyum).
    const supJrMap = new Map<string, { sups: Set<string>; jrs: Set<string> }>()
    try {
      const { rows: mdRows } = parseHtmlTableByHeader(await fetchPhpHtml(MERCH_URL))
      for (const r of mdRows) {
        const subeKod = (r['SUBE_KODU'] ?? '').trim()
        if (!subeKod) continue
        const sup = (r['SUPERVIZOR'] ?? '').trim()
        const jr  = (r['JR_SUPERVIZOR'] ?? '').trim()
        let e = supJrMap.get(subeKod)
        if (!e) { e = { sups: new Set(), jrs: new Set() }; supJrMap.set(subeKod, e) }
        if (sup) e.sups.add(sup)
        if (jr)  e.jrs.add(jr)
      }
    } catch { /* sup/jr olmadan devam et */ }

    // 3. Birleştir — aynı cari + şube adına sahip farklı şube kodları
    //    (ör. HEDEFİM KÖRFEZ iki kodla) tek seçenek olur, ama sup/jr'ları birleşir.
    const byKey = new Map<string, CariSube>()
    for (const r of csRows) {
      const cari_adi = (r['CARI_ADI'] ?? '').trim()
      if (!cari_adi) continue
      const sube_kod = (r['SUBE_KOD'] ?? '').trim()
      const sube_adi = (r['SUBE_ADI'] ?? '').trim()
      const enrich = supJrMap.get(sube_kod)

      const key = `${cari_adi}||${sube_adi}`
      let row = byKey.get(key)
      if (!row) {
        row = {
          cari_adi,
          sube_adi,
          bsy_adi: (r['BSY_ADI'] ?? '').trim(),
          bsy_kod: (r['BSY_KODU'] ?? '').trim(),
          sup_adi: '',
          jr_adi:  '',
          sups: [],
          jrs:  [],
        }
        byKey.set(key, row)
      }
      for (const n of enrich?.sups ?? []) if (!row.sups.includes(n)) row.sups.push(n)
      for (const n of enrich?.jrs  ?? []) if (!row.jrs.includes(n))  row.jrs.push(n)
      row.sup_adi = row.sups[0] ?? ''
      row.jr_adi  = row.jrs[0]  ?? ''
    }
    const data = [...byKey.values()]

    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
