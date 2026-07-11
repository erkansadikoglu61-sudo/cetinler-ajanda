import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// ─── Excel ───────────────────────────────────────────────────────────────────
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

// ─── Tipler ──────────────────────────────────────────────────────────────────
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

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const sp         = new URL(req.url).searchParams
  const yil        = sp.get('yil')  ? parseInt(sp.get('yil')!)  : new Date().getFullYear()
  const ay         = sp.get('ay')   ? parseInt(sp.get('ay')!)   : new Date().getMonth() + 1
  const grupFilter = sp.get('grup')?.trim().toUpperCase() || ''
  const bsyFilter  = sp.get('bsy')?.trim() || ''

  // ── 1. PHP → Çetinler Merch ──────────────────────────────────────────────
  // cariKod → { cariAdi, subeler: Set<string> }
  const cariMap = new Map<string, { cariAdi: string; subeler: Set<string> }>()
  const bsySet  = new Set<string>()

  try {
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'
    const phpRes = await fetch(phpUrl, { next: { revalidate: 900 } })
    const html   = await phpRes.text()

    const trMatches = html.match(/<tr>[\s\S]*?<\/tr>/gi) || []
    for (let i = 1; i < trMatches.length; i++) {
      const tdMatches = trMatches[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []
      if (tdMatches.length < 10) continue
      const cells = tdMatches.map(td => decodeHtml(td.replace(/<\/?td[^>]*>/gi, '')))
      // 0:MERCH_ADI 1:MERCH_ID 2:MERCH_TIPI 3:CARI_KOD 4:CARI_ISIM
      // 5:SUBE_KOD  6:SUBE_ADI 7:IBAN       8:BSY_KOD  9:BSY_ADI
      const merchTipi = cells[2] || ''
      const cariKod   = cells[3] || ''
      const cariAdi   = cells[4] || ''
      // Şube tanımlayıcı: önce sube_adi, yoksa sube_kod, hiçbiri yoksa merch_adi ile fallback
      const subeKey   = (cells[6] || cells[5] || cells[0] || '__default__').trim()
      const bsyAdi    = cells[9] || ''

      if (merchTipi !== 'Çetinler Merch') continue
      if (!cariKod) continue
      if (bsyFilter && bsyAdi !== bsyFilter) continue

      if (!cariMap.has(cariKod)) {
        cariMap.set(cariKod, { cariAdi: cariAdi || cariKod, subeler: new Set() })
      }
      cariMap.get(cariKod)!.subeler.add(subeKey)

      if (bsyAdi) bsySet.add(bsyAdi)
    }
  } catch (e) {
    console.warn('PHP fetch hatası:', e)
  }

  // ── 2. SAHA.xlsx → cariKod bazında net ciro ──────────────────────────────
  // cariKod → net tutar, seçili dönem + grup filtresi
  const cariCiroMap = new Map<string, number>()
  const grupSet     = new Set<string>()

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
        const grupKodu = String(r[17] ?? '').toUpperCase().trim()
        const rawNet   = typeof r[11] === 'number' ? r[11]
                       : parseFloat(String(r[11] ?? '0').replace(',', '.')) || 0

        if (!cariKod || !rowYil || !rowAy) continue
        if (gc !== 'C' && gc !== 'G') continue

        // Grup dropdown için filtre uygulanmadan önce topla
        if (rowYil === yil && rowAy === ay && grupKodu) grupSet.add(grupKodu)

        if (rowYil !== yil || rowAy !== ay) continue
        if (grupFilter && grupKodu !== grupFilter) continue

        // Sadece PHP'de Çetinler Merch olan cari kodlarının cirosu ilgilendiriyor
        if (!cariMap.has(cariKod)) continue

        const net = gc === 'G' ? -Math.abs(rawNet) : rawNet
        cariCiroMap.set(cariKod, (cariCiroMap.get(cariKod) ?? 0) + net)
      }
    }
  }

  // ── 3. Birleştir ──────────────────────────────────────────────────────────
  const rows: PersonelliNoktaRow[] = []
  for (const [cariKod, { cariAdi, subeler }] of cariMap.entries()) {
    rows.push({
      cariAdi,
      personelSayisi: subeler.size,
      gercCiro:       cariCiroMap.get(cariKod) ?? 0,
    })
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
