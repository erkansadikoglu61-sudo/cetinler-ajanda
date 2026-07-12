import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const EXCEL_PATH =
  process.env.BSY_EXCEL_PATH ??
  path.join(process.env.HOME ?? '/Users/erkansadikoglu', 'Desktop/SAHA.xlsx')

const BUCKET   = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getExcelBuffer(): Promise<Buffer | null> {
  if (fs.existsSync(EXCEL_PATH)) return fs.readFileSync(EXCEL_PATH)
  try {
    const sb = getSupabase()
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch { return null }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

// Cari adı normalize: büyük harf, noktalama sil, Türkçe karakterleri dönüştür
function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/\./g, ' ').replace(/,/g, ' ')
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim()
}

// İlk 2 anlamlı kelime (≥3 karakter) — zincir şirketlerin farklı kayıtlarını yakalar
function prefixKey(normalized: string): string {
  const words = normalized.split(' ').filter(w => w.length >= 3)
  return words.slice(0, 2).join(' ')
}

export interface PersonelliNoktaRow {
  cariAdi:        string
  personelSayisi: number
  gercCiro:       number
}

export interface PersonelliNoktaResponse {
  rows:    PersonelliNoktaRow[]
  gruplar: string[]
  bsyler:  string[]
  carilar: string[]
}

export async function GET(req: Request) {
  const sp      = new URL(req.url).searchParams
  const yil     = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const isDebug = sp.get('debug') === '1'

  // Çoklu ay: ?aylar=6,7  (geriye uyumluluk: ?ay=6 de çalışır)
  const aylarParam = sp.get('aylar') || sp.get('ay') || String(new Date().getMonth() + 1)
  const aySet = new Set(aylarParam.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)))

  // Çoklu grup: ?gruplar=RELUX,ELUX  (geriye uyumluluk: ?grup=RELUX de çalışır)
  const gruplarParam = sp.get('gruplar') || sp.get('grup') || ''
  const grupSet2 = gruplarParam
    ? new Set(gruplarParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
    : null  // null = filtre yok

  const bsyFilter = sp.get('bsy')?.trim() || ''

  // ── 1. PHP → Çetinler Merch ──────────────────────────────────────────────
  // Key: cariKod (PHP sistemi)
  const cariMap = new Map<string, {
    cariAdi:  string
    normAdi:  string
    subeler:  Set<string>
  }>()
  const bsySet = new Set<string>()

  try {
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'
    const phpRes = await fetch(phpUrl, { next: { revalidate: 900 } })
    const html   = await phpRes.text()

    const trMatches = html.match(/<tr>[\s\S]*?<\/tr>/gi) || []
    for (let i = 1; i < trMatches.length; i++) {
      const tdMatches = trMatches[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []
      if (tdMatches.length < 10) continue
      const cells     = tdMatches.map(td => decodeHtml(td.replace(/<\/?td[^>]*>/gi, '')))
      const merchTipi = cells[2] || ''
      const cariKod   = cells[3] || ''
      const cariAdi   = cells[4] || ''
      const subeKey   = (cells[6] || cells[5] || cells[0] || '__default__').trim()
      const bsyAdi    = cells[9] || ''

      if (merchTipi !== 'Çetinler Merch') continue
      if (!cariKod) continue
      if (bsyFilter && bsyAdi !== bsyFilter) continue

      if (!cariMap.has(cariKod)) {
        cariMap.set(cariKod, {
          cariAdi: cariAdi || cariKod,
          normAdi: norm(cariAdi),
          subeler: new Set(),
        })
      }
      cariMap.get(cariKod)!.subeler.add(subeKey)
      if (bsyAdi) bsySet.add(bsyAdi)
    }
  } catch (e) {
    console.warn('PHP fetch hatası:', e)
  }

  // normAdi → cariKod (hızlı lookup için)
  const normToKod = new Map<string, string>()
  for (const [kod, v] of cariMap.entries()) normToKod.set(v.normAdi, kod)

  // ── 2. SAHA.xlsx → cari bazında net ciro ─────────────────────────────────
  const ciroByKod    = new Map<string, number>()  // r[1] (cariKod) → ciro
  const ciroByNorm   = new Map<string, number>()  // norm(r[2]) tam eşleşme → ciro
  const ciroByPrefix = new Map<string, number>()  // prefixKey(norm(r[2])) → ciro (zincir desteği)
  const grupSet      = new Set<string>()

  const excelOrnek: { r1: string; r2: string; normR2: string }[] = []

  const buf = await getExcelBuffer()
  if (buf) {
    const wb = XLSX.read(buf, { type: 'buffer', dense: true })
    const ws = wb.Sheets['Data']
    if (ws) {
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i]
        if (!r) continue

        const gc       = String(r[18] ?? '').toUpperCase().trim()
        const rowYil   = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
        const rowAy    = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
        const cariKod  = String(r[1]  ?? '').trim()
        const cariIsim = String(r[2]  ?? '').trim()
        const grupKodu = String(r[17] ?? '').toUpperCase().trim()
        const rawNet   = typeof r[11] === 'number' ? r[11]
                       : parseFloat(String(r[11] ?? '0').replace(',', '.')) || 0

        if (!cariIsim || !rowYil || !rowAy) continue

        // Grup dropdown için filtresiz topla
        if (rowYil === yil && aySet.has(rowAy) && grupKodu) grupSet.add(grupKodu)

        if (rowYil !== yil || !aySet.has(rowAy)) continue
        if (grupSet2 && grupKodu && !grupSet2.has(grupKodu)) continue

        if (isDebug && excelOrnek.length < 40) {
          if (!excelOrnek.some(e => e.r1 === cariKod && e.r2 === cariIsim)) {
            excelOrnek.push({ r1: cariKod, r2: cariIsim, normR2: norm(cariIsim) })
          }
        }

        // G = iade (negatif), diğerleri = satış (pozitif) — gc filtresi yok
        const net = gc === 'G' ? -Math.abs(rawNet) : rawNet

        if (cariKod) {
          ciroByKod.set(cariKod, (ciroByKod.get(cariKod) ?? 0) + net)
        }
        const n  = norm(cariIsim)
        const pk = prefixKey(n)
        ciroByNorm.set(n,   (ciroByNorm.get(n)   ?? 0) + net)
        if (pk) ciroByPrefix.set(pk, (ciroByPrefix.get(pk) ?? 0) + net)
      }
    }
  }

  // ── 3. Debug ──────────────────────────────────────────────────────────────
  if (isDebug) {
    const phpKodlar = [...cariMap.entries()].map(([kod, v]) => ({
      kod, adi: v.cariAdi, normAdi: v.normAdi,
    }))
    // Hangi PHP carilarının Excel'de adıyla eşleştiğini göster
    const eslesmeler = phpKodlar.map(p => ({
      phpAdi:       p.adi,
      normPhp:      p.normAdi,
      prefix:       prefixKey(p.normAdi),
      ciroByKod:    ciroByKod.get(p.kod) ?? null,
      ciroByNorm:   ciroByNorm.get(p.normAdi) ?? null,
      ciroByPrefix: ciroByPrefix.get(prefixKey(p.normAdi)) ?? null,
      excelEsles:   excelOrnek.find(e => e.normR2 === p.normAdi)?.r2 ?? null,
    }))
    return NextResponse.json({ eslesmeler, excelOrnek: excelOrnek.slice(0, 20), gruplar: [...grupSet] })
  }

  // ── 4. Birleştir ──────────────────────────────────────────────────────────
  const rows: PersonelliNoktaRow[] = []
  for (const [cariKod, { cariAdi, normAdi, subeler }] of cariMap.entries()) {
    // 1) Cari kod (PHP ↔ Excel tam eşleşme)
    // 2) Normalize tam ad eşleşme
    // 3) Prefix eşleşme (zincir firmaların farklı kayıtlarını kapsar)
    const ciro =
      ciroByKod.get(cariKod) ??
      ciroByNorm.get(normAdi) ??
      ciroByPrefix.get(prefixKey(normAdi)) ??
      0
    rows.push({ cariAdi, personelSayisi: subeler.size, gercCiro: ciro })
  }

  rows.sort((a, b) => b.gercCiro - a.gercCiro || a.cariAdi.localeCompare(b.cariAdi, 'tr'))

  const carilar = [...cariMap.values()]
    .map(v => v.cariAdi)
    .sort((a, b) => a.localeCompare(b, 'tr'))

  return NextResponse.json<PersonelliNoktaResponse>({
    rows,
    gruplar: [...grupSet].sort((a, b) => a.localeCompare(b, 'tr')),
    bsyler:  [...bsySet].sort((a, b) => a.localeCompare(b, 'tr')),
    carilar,
  })
}
