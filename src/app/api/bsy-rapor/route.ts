import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { BSY_KOD_TO_NAME } from '@/lib/bsy'

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

export interface BsyRaporRow {
  bsyAdi: string
  ay:     number
  adet:   number
}

export interface BsyRaporResponse {
  rows:  BsyRaporRow[]
  aylar: number[]
}

const BSY_NAMES = new Set(Object.values(BSY_KOD_TO_NAME))

export async function GET(req: Request) {
  const sp          = new URL(req.url).searchParams
  const yil         = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const stokKodlar  = (sp.get('stokKodlar') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  const stokSet = new Set(stokKodlar)

  const buf = await getExcelBuffer()
  if (!buf) return NextResponse.json<BsyRaporResponse>({ rows: [], aylar: [] })

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })
  const ws = wb.Sheets['Data']
  if (!ws) return NextResponse.json({ error: 'Data sayfası bulunamadı' }, { status: 500 })

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // bsyAdi+ay → adet
  const map = new Map<string, number>()
  const aySet = new Set<number>()

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const gc          = String(r[18] ?? '').toUpperCase().trim()
    const rowYil      = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
    const rowAy       = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
    const plasiyerAdi = String(r[32] ?? '').trim()
    const rowStokKodu = String(r[8]  ?? '').trim()
    const rawAdet     = typeof r[15] === 'number' ? r[15] : parseFloat(String(r[15] ?? '0').replace(',', '.'))

    if (!plasiyerAdi || !rowStokKodu || !rowYil || !rowAy) continue
    if (gc !== 'C' && gc !== 'G') continue
    if (rowYil !== yil) continue
    if (stokSet.size > 0 && !stokSet.has(rowStokKodu)) continue
    if (!BSY_NAMES.has(plasiyerAdi)) continue

    aySet.add(rowAy)
    const key  = `${plasiyerAdi}__${rowAy}`
    const adet = gc === 'G' ? -Math.abs(rawAdet) : rawAdet
    map.set(key, (map.get(key) ?? 0) + adet)
  }

  const rows: BsyRaporRow[] = [...map.entries()].map(([key, adet]) => {
    const [bsyAdi, ayStr] = key.split('__')
    return { bsyAdi, ay: parseInt(ayStr), adet }
  })

  return NextResponse.json<BsyRaporResponse>({
    rows,
    aylar: [...aySet].sort((a, b) => a - b),
  })
}
