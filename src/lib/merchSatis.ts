// PHP export tablolarını (export_merch_satis.php vb.) başlık ismine göre ayrıştırır.
// Böylece PHP tarafında kolon eklenip/sırası değişse bile ayrıştırma bozulmaz.
//
// Kullanım:
//   const { rows } = parseHtmlTableByHeader(html)
//   const adet = num(rows[0]['SATILAN_ADET'])
//   const merchTipi = rows[0]['MERCH_TIPI']

import { gzipSync, gunzipSync } from 'zlib'
import { createHash } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'

// ── PHP HTML paylaşımlı cache (bellek + Supabase Storage) ────────────
// export_merch_satis.php tüm geçmişi tek seferde döndürüyor (~40MB, büyüyor)
// ve b2b sunucusu yavaş; her sunucu fonksiyonu bunu ayrı ayrı çekince hem
// Vercel süre limitine takılıyor (sayfada "Unexpected token 'A'…" hatası)
// hem de PHP sunucusu daha da yavaşlıyordu. Çözüm:
//   1. Bellek cache'i (sıcak instance, 10 dk) — eskisi gibi.
//   2. Kalıcı cache: Supabase Storage'da gzip'li kopya (tüm instance'lar ortak).
//      Taze (STORE_FRESH_MS) ise PHP'ye hiç gidilmez.
//   3. Eskiyse: eski veri HEMEN döner, PHP arka planda (after) tazelenir.
//      PHP çökse/zaman aşımına düşse bile sayfa son başarılı veriyle çalışır.
// Kalıcı cache yalnızca sorgu parametresiz (büyük, ortak) rapor URL'lerinde.
const HTML_TTL_MS = 10 * 60 * 1000            // bellek: 10 dk
const STORE_FRESH_MS = 30 * 60 * 1000         // Storage kopyası bu süre "taze"
const STORE_LOCK_MS = 5 * 60 * 1000           // aynı anda tek arka plan yenilemesi
const PHP_TIMEOUT_MS = 240 * 1000             // route maxDuration (300) altında kalsın
const STORE_BUCKET = 'bsy-excel'

const htmlCache = new Map<string, { at: number; html: string }>()
const htmlInflight = new Map<string, Promise<string>>()
const refreshing = new Set<string>()

let _sb: SupabaseClient | null | undefined
function storeClient(): SupabaseClient | null {
  if (_sb !== undefined) return _sb
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  _sb = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
  return _sb
}

function storePath(url: string, ext: string): string {
  return `php-cache/${createHash('sha1').update(url).digest('hex').slice(0, 24)}.${ext}`
}

async function storeRead(url: string): Promise<{ at: number; html: string } | null> {
  const sb = storeClient()
  if (!sb) return null
  try {
    const { data, error } = await sb.storage.from(STORE_BUCKET).download(storePath(url, 'gz'))
    if (error || !data) return null
    const raw = gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf-8')
    const nl = raw.indexOf('\n')
    const at = Number(raw.slice(0, nl))
    if (nl < 0 || !Number.isFinite(at)) return null
    return { at, html: raw.slice(nl + 1) }
  } catch {
    return null
  }
}

async function storeWrite(url: string, html: string, at: number): Promise<void> {
  const sb = storeClient()
  if (!sb) return
  try {
    const body = gzipSync(Buffer.from(`${at}\n${html}`, 'utf-8'))
    const { error } = await sb.storage.from(STORE_BUCKET).upload(storePath(url, 'gz'), body, {
      upsert: true, contentType: 'application/gzip', cacheControl: '0',
    })
    if (error) console.error('PHP cache yazılamadı:', url, error.message)
  } catch (e) {
    console.error('PHP cache yazılamadı:', url, e)
  }
}

// Instance'lar arası kaba kilit: son 5 dk içinde başka biri yenilemeye başladıysa atla.
async function storeTryLock(url: string): Promise<boolean> {
  const sb = storeClient()
  if (!sb) return true
  const path = storePath(url, 'lock')
  try {
    const { data } = await sb.storage.from(STORE_BUCKET).download(path)
    if (data) {
      const t = Number(await data.text())
      if (Number.isFinite(t) && Date.now() - t < STORE_LOCK_MS) return false
    }
    await sb.storage.from(STORE_BUCKET).upload(path, String(Date.now()), {
      upsert: true, contentType: 'text/plain', cacheControl: '0',
    })
  } catch { /* kilit alınamasa da yenilemeye devam */ }
  return true
}

// PHP hata sayfası / boş gövde ile iyi kopyanın üzerine yazmamak için.
function looksValid(html: string): boolean {
  return html.length > 1000 && /<tr[\s>]/i.test(html)
}

async function fetchFromPhp(url: string, headers?: Record<string, string>): Promise<string> {
  // no-store: Next'in fetch enstrümantasyonunu atla (büyük gövdede sorunlu)
  const res = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers,
    signal: AbortSignal.timeout(PHP_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`PHP API ${res.status}`)
  // arrayBuffer + tek seferde decode: atomik, doğru UTF-8
  return new TextDecoder('utf-8').decode(await res.arrayBuffer())
}

// Yanıt gönderildikten sonra çalıştır (Vercel after); istek bağlamı yoksa arka planda.
function runAfter(fn: () => Promise<void>): void {
  try { after(fn) } catch { void fn() }
}

function scheduleRefresh(url: string, headers?: Record<string, string>): void {
  if (refreshing.has(url)) return
  refreshing.add(url)
  runAfter(async () => {
    try {
      if (!(await storeTryLock(url))) return
      const html = await fetchFromPhp(url, headers)
      if (!looksValid(html)) return
      const at = Date.now()
      htmlCache.set(url, { at, html })
      await storeWrite(url, html, at)
    } catch (e) {
      console.error('PHP arka plan yenilemesi başarısız:', url, e)
    } finally {
      refreshing.delete(url)
    }
  })
}

/**
 * PHP export'unu çeker (tam UTF-8) ve bellek + Storage'da cache'ler.
 * @param revalidateMs Bellek cache TTL (ms). 0 → tüm cache'leri atla (taze çek).
 */
export async function fetchPhpHtml(
  url: string,
  opts?: { headers?: Record<string, string>; revalidateMs?: number },
): Promise<string> {
  const ttl = opts?.revalidateMs ?? HTML_TTL_MS
  if (ttl <= 0) return fetchFromPhp(url, opts?.headers)

  const hit = htmlCache.get(url)
  if (hit && Date.now() - hit.at < ttl) return hit.html
  const pending = htmlInflight.get(url)
  if (pending) return pending // eşzamanlı istekler tek çekimi paylaşsın

  const persist = !url.includes('?')
  const run = (async () => {
    const stored = persist ? await storeRead(url) : null
    if (stored) {
      if (Date.now() - stored.at >= STORE_FRESH_MS) scheduleRefresh(url, opts?.headers)
      htmlCache.set(url, { at: Date.now(), html: stored.html })
      return stored.html
    }
    const html = await fetchFromPhp(url, opts?.headers)
    const at = Date.now()
    htmlCache.set(url, { at, html })
    if (persist && looksValid(html)) runAfter(() => storeWrite(url, html, at))
    return html
  })()

  htmlInflight.set(url, run)
  try { return await run } finally { htmlInflight.delete(url) }
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

// ── BSY dönem bazlı atama ────────────────────────────────────────────
// Evkur: Atilla Yılmaz (MB9) 30.09.2026'da ayrıldı; 2026-10'dan itibaren BSY
// Erkan Sadıkoğlu (MB10). B2B güncellemesi tutarsız (2026-10-27): satışlarda
// Ağu/Eyl de MB10'a çevrildi, merch-detay'da BSY_ADI boş, cari-şube listesinde
// kod+ad boş. Burada dönem bazlı tek doğruya çekilir:
//   • Satış satırları (DONEM + BSY): DONEM'e göre ilgili dönemin BSY'si.
//   • Cari-şube / merch-detay (BSY_KODU / BSY_ADI, dönemsiz = güncel atama):
//     bugünün dönemine göre.
// Yalnızca BSY'si bu kişilerden biri ya da boş olan satırlar değişir
// (ör. Evkur'un MB1'e bağlı tek şubesine dokunulmaz).
const BSY_DONEMLERI: { cariKod: string; cariAdPrefix: string; donemler: { from: string; to: string; kod: string; ad: string }[] }[] = [
  {
    cariKod: 'M34002900', cariAdPrefix: 'EVKUR',
    donemler: [
      { from: '0000-00', to: '2026-09', kod: 'MB9',  ad: 'Atilla Yılmaz' },
      { from: '2026-10', to: '9999-99', kod: 'MB10', ad: 'Erkan Sadıkoğlu' },
    ],
  },
]
function bugununDonemi(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function applyBsyOverride(row: MerchSatisRow): void {
  const cariKod = (row['CARI_KOD'] ?? row['CARI_KODU'] ?? '').trim()
  const cariAd  = (row['CARI_ISIM'] ?? row['CARI_ADI'] ?? '').trim().toLocaleUpperCase('tr')
  for (const o of BSY_DONEMLERI) {
    if (cariKod !== o.cariKod && !cariAd.startsWith(o.cariAdPrefix)) continue
    const kodlar = new Set(['', ...o.donemler.map(d => d.kod)])
    if ('BSY' in row && 'DONEM' in row) {
      const d = o.donemler.find(x => row['DONEM'] >= x.from && row['DONEM'] <= x.to)
      if (d && kodlar.has(row['BSY'].trim())) row['BSY'] = d.kod
    } else if ('BSY_KODU' in row) {
      const bugun = bugununDonemi()
      const d = o.donemler.find(x => bugun >= x.from && bugun <= x.to)
      if (d && kodlar.has(row['BSY_KODU'].trim())) {
        row['BSY_KODU'] = d.kod
        if ('BSY_ADI' in row) row['BSY_ADI'] = d.ad
      }
    }
  }
}

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
    applyBsyOverride(row)
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
