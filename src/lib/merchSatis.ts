// PHP export tablolarını (export_merch_satis.php vb.) başlık ismine göre ayrıştırır.
// Böylece PHP tarafında kolon eklenip/sırası değişse bile ayrıştırma bozulmaz.
//
// Kullanım:
//   const { rows } = parseHtmlTableByHeader(html)
//   const adet = num(rows[0]['SATILAN_ADET'])
//   const merchTipi = rows[0]['MERCH_TIPI']

// ── PHP HTML paylaşımlı bellek cache'i ───────────────────────────────
// export_merch_satis.php ~28MB ve çekmesi ~10sn sürüyor. Next'in fetch
// cache'i 2MB üstünü tutmadığı için her istek yeniden çekiyor, bu da
// Vercel fonksiyon timeout'una yaklaşıp ara sıra 504 → boş sellout'a yol
// açıyordu. Aynı URL'yi çeken tüm route'lar bu modül-seviyesi cache'i
// paylaşır; sıcak instance'ta TTL boyunca tek çekim yeter.
const HTML_TTL_MS = 10 * 60 * 1000 // 10 dk
const htmlCache = new Map<string, { at: number; html: string }>()
const htmlInflight = new Map<string, Promise<string>>()

/**
 * PHP export'unu çekip gövdeyi tam UTF-8 çözer ve URL bazında cache'ler.
 * @param revalidateMs Cache TTL (ms). 0 → cache'i atla (taze çek).
 */
export async function fetchPhpHtml(
  url: string,
  opts?: { headers?: Record<string, string>; revalidateMs?: number },
): Promise<string> {
  const ttl = opts?.revalidateMs ?? HTML_TTL_MS
  if (ttl > 0) {
    const hit = htmlCache.get(url)
    if (hit && Date.now() - hit.at < ttl) return hit.html
    const pending = htmlInflight.get(url)
    if (pending) return pending // eşzamanlı istekler tek çekimi paylaşsın
  }

  const run = (async () => {
    // no-store: Next'in fetch enstrümantasyonunu atla (büyük gövdede sorunlu)
    const res = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: opts?.headers,
    })
    if (!res.ok) throw new Error(`PHP API ${res.status}`)
    // arrayBuffer + tek seferde decode: atomik, doğru UTF-8
    const html = new TextDecoder('utf-8').decode(await res.arrayBuffer())
    if (ttl > 0) htmlCache.set(url, { at: Date.now(), html })
    return html
  })()

  if (ttl > 0) {
    htmlInflight.set(url, run)
    try { return await run } finally { htmlInflight.delete(url) }
  }
  return run
}

/**
 * PHP TARIH ("DD.MM.YYYY") ya da "YYYY-MM-DD" değerini karşılaştırılabilir
 * "YYYY-MM-DD" biçimine çevirir. Parse edilemezse '' döner.
 * Gün bazlı tarih-kısıtlı prim kurallarının doğru uygulanması için.
 */
export function tarihToIso(t: string): string {
  const s = (t || '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

export function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export type MerchSatisRow = Record<string, string>

// ── Süpervizör yeniden atama (satış verisi) ──────────────────────────
// Atilla Yılmaz'ın ekibi: aşağıdaki personelin 2026-01..2026-09 arası TÜM
// satışları (merch tipi ne olursa olsun) Atilla Yılmaz'a yazılır; satış diğer
// süpervizörden düşer (her satış tek kez sayılır). 2026-10 ve sonrası satış
// verisindeki yetkilendirme (SUPERVISOR_ADI) aynen kullanılır.
// Tüm satış tüketicileri (sellout, prim, analiz…) parseHtmlTableByHeader'dan
// geçtiği için tek noktada uygulanır.
const SUP_OVERRIDES: { sup: string; from: string; to: string; merchler: string[] }[] = [
  {
    sup: 'Atilla Yılmaz SV', from: '2026-01', to: '2026-09',
    merchler: [
      'Dilan Yıkılmaz', 'Betül Keser', 'Aslı Gökmen', 'Hafize Gökçe', 'Hanife Yüksel',
      'Şerife Karaahmetoğlu', 'Beyhan Bülbül Özlü', 'Neslihan Bulut', 'Ceren Ela Koçbay',
      'Emine Şen', 'Özen Özdil', 'Güldem Tunçöz', 'Pınar Avcı',
    ],
  },
]
const normKisi = (s: string) => (s ?? '').replace(/İ/g, 'I').toLowerCase()
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c')
  .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/\s+/g, ' ').trim()
const SUP_OVERRIDE_SETS = SUP_OVERRIDES.map(o => ({ ...o, set: new Set(o.merchler.map(normKisi)) }))

/** Satış satırı (MERCH_PERSONEL + DONEM + SUPERVISOR_ADI) ise yeniden atamayı uygular. */
function applySupervisorOverride(row: MerchSatisRow): void {
  if (!('SUPERVISOR_ADI' in row) || !('MERCH_PERSONEL' in row) || !('DONEM' in row)) return
  const donem = row['DONEM']
  const kisi = normKisi(row['MERCH_PERSONEL'])
  for (const o of SUP_OVERRIDE_SETS) {
    if (donem >= o.from && donem <= o.to && o.set.has(kisi)) { row['SUPERVISOR_ADI'] = o.sup; return }
  }
}

export interface ParsedHtmlTable {
  headers: string[]
  rows: MerchSatisRow[]
}

/**
 * HTML tablosunu başlık (<th>) isimlerine göre satır nesnelerine çevirir.
 * Her satır { BASLIK_ADI: hucreDegeri } şeklinde döner.
 * Başlık isimleri PHP çıktısındaki haliyle korunur (ör. "SATILAN_ADET").
 */
export function parseHtmlTableByHeader(html: string): ParsedHtmlTable {
  const parts = html.split('</tr>')
  if (parts.length === 0) return { headers: [], rows: [] }

  // İlk <tr> = başlık satırı (<th> hücreleri)
  const headers: string[] = []
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/gi
  let hm: RegExpExecArray | null
  while ((hm = thRe.exec(parts[0])) !== null) {
    // Başlık içindeki olası iç etiketleri temizle
    headers.push(decodeHtml(hm[1].replace(/<[^>]+>/g, '')))
  }

  const rows: MerchSatisRow[] = []
  const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part.includes('<td')) continue

    const cells: string[] = []
    let m: RegExpExecArray | null
    tdRe.lastIndex = 0
    while ((m = tdRe.exec(part)) !== null) {
      cells.push(decodeHtml(m[1]))
    }
    if (cells.length === 0) continue

    const row: MerchSatisRow = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = cells[c] ?? ''
    }
    applySupervisorOverride(row)
    rows.push(row)
  }

  return { headers, rows }
}

/** Türkçe/İngiliz ondalık ("1.234,5" veya "1234.5") güvenli sayıya çevirir. */
export function num(v: string | undefined): number {
  if (!v) return 0
  const cleaned = v.trim().replace(/\s/g, '')
  // Hem "1234.5" hem "1234,5" destekle: son ayraç ondalık kabul edilir
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned.replace(/,/g, '')
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}
