import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader, num, fetchPhpHtml } from '@/lib/merchSatis'
import { normalizeName } from '@/lib/sellout'

// 28MB PHP fetch + 62k satır parse soğuk çağrıda ~10sn sürüyor; varsayılan
// timeout'a takılıp 504 (→ boş sellout) üretmemesi için süreyi uzatıyoruz.
export const maxDuration = 60

const SOURCE_URL =
  'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'
const MERCH_DETAY_URL =
  'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

// ── Jr. Süpervizör ataması ──────────────────────────────────────────
// Satış export'unda SUPERVISOR_ADI, satışı giren merch'in kaydındaki kişidir;
// Jr'a bağlı şubelerde de çoğu satış Jr yerine üst süpervizör adıyla gelir
// (ör. Asya Yenidoğan: B2B'de Jr = Merve İnci, satışlarda "Sinem Bektaş").
// Bu yüzden Jr tablosunda gerçekleşenler eksik görünüyordu. B2B merch-detay
// tek kaynak: şubede o süpervizöre bağlı bir Jr tanımlıysa satış Jr'a yazılır.
// Süpervizör toplamı değişmez (Sup = kendisi + Jr'ları).
// Öncelik: satışı giren merch'in kendi satırındaki Jr; yoksa şubede o
// süpervizör altında tek bir Jr varsa o. Başka süpervizöre ait satırlara
// (ör. Atilla override) dokunulmaz.
// Kullanıcı kararı (2026-10-29): yalnızca 2026-09 ve sonrası; Ağustos ve
// öncesi Jr rakamları/primleri olduğu gibi kalır.
const JR_ATAMA_BASLANGIC = '2026-09'

function buildJrResolver(mdHtml: string) {
  const { rows } = parseHtmlTableByHeader(mdHtml)
  const byMerch = new Map<string, string>()        // sube|sup|merch → jr
  const bySube  = new Map<string, Set<string>>()   // sube|sup → jr'lar
  for (const r of rows) {
    const sube = (r['SUBE_KODU'] ?? '').trim()
    const sup  = normalizeName(r['SUPERVIZOR'] ?? '')
    const jr   = (r['JR_SUPERVIZOR'] ?? '').trim()
    if (!sube || !sup || !jr) continue
    byMerch.set(`${sube}|${sup}|${normalizeName(r['MERCH_ADI'] ?? '')}`, jr)
    const k = `${sube}|${sup}`
    if (!bySube.has(k)) bySube.set(k, new Set())
    bySube.get(k)!.add(jr)
  }
  return (subeKod: string, supAdi: string, merch: string): string | null => {
    const sup = normalizeName(supAdi)
    if (!subeKod || !sup) return null
    const own = byMerch.get(`${subeKod}|${sup}|${normalizeName(merch)}`)
    if (own) return own
    const jrs = bySube.get(`${subeKod}|${sup}`)
    return jrs && jrs.size === 1 ? [...jrs][0] : null
  }
}

export interface SelloutRow {
  merch_personel: string
  cari_isim: string
  sube_adi: string
  stok_adi: string
  stok_kodu: string
  grup_aciklama: string
  satilan_adet: number
  grup_kodu: string
  beklened_ciro: number
  supervisor_adi: string
  ana_supervisor_adi: string   // B2B'deki SUPERVISOR_ADI (Jr'a atanmadan önceki) — Sup toplamı için
  cari_kod: string
  sube_kod: string
  donem: string
  tarih: string
  merch_tipi: string   // [14] 'Çetinler Merch' | diğer
  sv_tipi:    string   // [15] 'Kıdemli Supervisor' vb.
  bsy:        string   // [16] BSY kodu: KB1, IB1, IB2, MB1...
}

function parseHtmlTable(html: string): SelloutRow[] {
  // Başlık ismine göre ayrıştır (kolon sırası değişse de bozulmaz)
  const { rows: rawRows } = parseHtmlTableByHeader(html)

  return rawRows.map(r => ({
    merch_personel: r['MERCH_PERSONEL'] ?? '',
    cari_isim:      r['CARI_ISIM'] ?? '',
    sube_adi:       r['SUBE_ADI'] ?? '',
    stok_adi:       r['STOK_ADI'] ?? '',
    stok_kodu:      r['STOK_KODU'] ?? '',
    grup_aciklama:  r['GRUP_ACIKLAMA'] ?? '',
    satilan_adet:   num(r['SATILAN_ADET']),
    grup_kodu:      r['GRUP_KODU'] ?? '',
    beklened_ciro:  num(r['BEKLENEN_CIRO']),
    supervisor_adi: r['SUPERVISOR_ADI'] ?? '',
    ana_supervisor_adi: r['SUPERVISOR_ADI'] ?? '',
    cari_kod:       r['CARI_KOD'] ?? '',
    sube_kod:       r['SUBE_KOD'] ?? '',
    donem:          r['DONEM'] ?? '',
    tarih:          r['TARIH'] ?? '',
    merch_tipi:     r['MERCH_TIPI'] ?? '',
    sv_tipi:        r['SV_TIPI'] ?? '',
    bsy:            r['BSY'] ?? '',
  }))
}

export async function GET() {
  try {
    // fetchPhpHtml: paylaşımlı bellek cache (10 dk) + tam UTF-8 decode.
    // 28MB'ı her istekte çekmeyi önler; ~10sn'lik fetch'i Vercel timeout'una
    // yaklaştırıp ara sıra 504 → boş sellout üretmesini engeller.
    const html = await fetchPhpHtml(SOURCE_URL)
    const rows = parseHtmlTable(html)

    try {
      const jrOf = buildJrResolver(await fetchPhpHtml(MERCH_DETAY_URL))
      for (const r of rows) {
        if (r.donem < JR_ATAMA_BASLANGIC) continue
        const jr = jrOf(r.sube_kod.trim(), r.supervisor_adi, r.merch_personel)
        if (jr) r.supervisor_adi = jr
      }
    } catch (e) {
      console.error('[sellout] merch-detay (Jr ataması) alınamadı:', e)
    }

    return NextResponse.json({
      rows,
      count: rows.length,
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[sellout] fetch/parse hatası:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
