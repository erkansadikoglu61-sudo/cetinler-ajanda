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

export interface SellinRow {
  bsyKod:   string   // Plasiyer Kodu [31]  (KB1, IB2 vb. — B2B BSY koduyla aynı)
  bsyAdi:   string   // Plasiyer Adı  [32]
  cariKod:  string   // Cari Kod      [1]
  cariIsim: string   // Cari İsim     [2]
  stokKodu: string   // Stok Kodu     [8]
  stokAdi:  string   // Stok Adı      [9]
  kategori: string   // Grup Kodu     [16]  (EKEA / RELUX / EBE)
  ay:       number   // Ay            [20]
  yil:      number   // Yıl           [21]
  adet:     number   // Adet          [15]
}

export interface SellinSelloutResponse {
  rows:        SellinRow[]
  yillar:      number[]
  merchxKodlar: string[]   // MERCHX olan stok kodları — sellout tarafında da dışlanacak
}

export async function GET() {
  const buf = await getExcelBuffer()
  if (!buf) {
    return NextResponse.json<SellinSelloutResponse>({ rows: [], yillar: [], merchxKodlar: [] })
  }

  const wb  = XLSX.read(buf, { type: 'buffer', dense: true })
  const ws  = wb.Sheets['Data']
  if (!ws) return NextResponse.json({ error: 'Data sayfası bulunamadı' }, { status: 500 })

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const rows:        SellinRow[] = []
  const yilSet:      Set<number> = new Set()
  const merchxKodlar: Set<string> = new Set()   // MERCHX stok kodlarını topla

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const gc          = String(r[18] ?? '').toUpperCase().trim()
    const tur         = String(r[10] ?? '').toUpperCase().trim()
    const rowYil      = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
    const rowAy       = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
    const plasiyerKod = String(r[31] ?? '').trim()   // Plasiyer Kodu — B2B BSY koduyla aynı
    const plasiyerAdi = String(r[32] ?? '').trim()
    const cariKod     = String(r[1]  ?? '').trim()
    const cariIsim    = String(r[2]  ?? '').trim()
    const stokKodu    = String(r[8]  ?? '').trim()
    const stokAdi     = String(r[9]  ?? '').trim()
    const kategori    = String(r[16] ?? '').toUpperCase().trim()
    const stokRapKod3 = String(r[41] ?? '').toUpperCase().trim()
    const rawAdet     = typeof r[15] === 'number' ? r[15] : parseFloat(String(r[15] ?? '0').replace(',', '.'))

    if (!plasiyerAdi || !stokKodu || !cariIsim || !rowYil || !rowAy) continue
    if (gc !== 'C' && gc !== 'G') continue
    if (stokRapKod3 === 'MERCHX') {
      merchxKodlar.add(stokKodu.toUpperCase())   // Sellout tarafı için kaydet
      continue
    }

    yilSet.add(rowYil)

    const adet = tur.includes('IADE') || gc === 'G' ? -Math.abs(rawAdet) : rawAdet

    rows.push({ bsyKod: plasiyerKod, bsyAdi: plasiyerAdi, cariKod, cariIsim, stokKodu, stokAdi, kategori, ay: rowAy, yil: rowYil, adet })
  }

  return NextResponse.json<SellinSelloutResponse>({
    rows,
    yillar:      [...yilSet].sort((a, b) => a - b),
    merchxKodlar: [...merchxKodlar],
  })
}
