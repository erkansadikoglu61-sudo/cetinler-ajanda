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

export interface EslesmeRow {
  bsyAdi: string
  adet:   number  // eşleşen (paired) toplam adet
}

export interface EslesmeResponse {
  rows: EslesmeRow[]
}

// Bir cariye hem stokKod1 hem stokKod2'den giden adetlerin minimumunu (eşleşen çifti) sayar.
// Her BSY için: sum over cari of min(cari_stok1_qty, cari_stok2_qty)
export async function GET(req: Request) {
  const sp          = new URL(req.url).searchParams
  const yil         = sp.get('yil')         ? parseInt(sp.get('yil')!)         : null
  const ayBaslangic = sp.get('ayBaslangic') ? parseInt(sp.get('ayBaslangic')!) : null
  const ayBitis     = sp.get('ayBitis')     ? parseInt(sp.get('ayBitis')!)     : null
  const stokKod1    = sp.get('stokKod1')?.trim() ?? null
  const stokKod2    = sp.get('stokKod2')?.trim() ?? null

  if (!stokKod1 || !stokKod2) {
    return NextResponse.json({ error: 'stokKod1 ve stokKod2 zorunlu' }, { status: 400 })
  }

  const buf = await getExcelBuffer()
  if (!buf) {
    return NextResponse.json<EslesmeResponse>({ rows: [] })
  }

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })
  const ws = wb.Sheets['Data']
  if (!ws) return NextResponse.json({ error: 'Data sayfası bulunamadı' }, { status: 500 })

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // bsyAdi → cariKod → { stok1: adet, stok2: adet }
  const bsyCariMap = new Map<string, Map<string, { s1: number; s2: number }>>()

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const gc          = String(r[18] ?? '').toUpperCase().trim()
    const rowYil      = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
    const rowAy       = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
    const bsyAdi      = String(r[32] ?? '').trim()
    const cariKod     = String(r[1]  ?? '').trim()
    const rowStokKodu = String(r[8]  ?? '').trim()
    const rawAdet     = typeof r[15] === 'number' ? r[15] : parseFloat(String(r[15] ?? '0').replace(',', '.'))

    if (!bsyAdi || !cariKod || !rowStokKodu || !rowYil || !rowAy) continue
    if (gc !== 'C' && gc !== 'G') continue

    // Tam eşleşme VEYA prefix eşleşmesi (örn. RHS8900 → RHS8900B, RHS8900P)
    const isS1 = rowStokKodu === stokKod1 || rowStokKodu.startsWith(stokKod1)
    const isS2 = rowStokKodu === stokKod2 || rowStokKodu.startsWith(stokKod2)
    if (!isS1 && !isS2) continue

    if (yil         && rowYil !== yil)         continue
    if (ayBaslangic && rowAy < ayBaslangic)    continue
    if (ayBitis     && rowAy > ayBitis)        continue

    const adet = gc === 'G' ? -Math.abs(rawAdet) : rawAdet

    if (!bsyCariMap.has(bsyAdi)) bsyCariMap.set(bsyAdi, new Map())
    const cariMap = bsyCariMap.get(bsyAdi)!
    if (!cariMap.has(cariKod)) cariMap.set(cariKod, { s1: 0, s2: 0 })
    const entry = cariMap.get(cariKod)!

    if (isS1) entry.s1 += adet
    else      entry.s2 += adet
  }

  const rows: EslesmeRow[] = []
  for (const [bsyAdi, cariMap] of bsyCariMap.entries()) {
    let toplam = 0
    for (const { s1, s2 } of cariMap.values()) {
      const paired = Math.min(Math.max(0, s1), Math.max(0, s2))
      toplam += paired
    }
    if (toplam > 0) rows.push({ bsyAdi, adet: toplam })
  }

  rows.sort((a, b) => b.adet - a.adet)

  return NextResponse.json<EslesmeResponse>({ rows })
}
