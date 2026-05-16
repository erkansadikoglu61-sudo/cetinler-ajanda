import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { GRUP_TO_BRAND, BSY_KOD_TO_NAME, BsyCiroRow, BsyCiroResponse } from '@/lib/bsy'

// Excel dosyası yolu — lokal geliştirme için
const EXCEL_PATH =
  process.env.BSY_EXCEL_PATH ??
  path.join(
    process.env.HOME ?? '/Users/erkansadikoglu',
    'Desktop/SAHA.xlsx'
  )

const BUCKET   = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getExcelBuffer(): Promise<Buffer | null> {
  // 1. Lokal dosya varsa onu kullan (geliştirme ortamı)
  if (fs.existsSync(EXCEL_PATH)) {
    return fs.readFileSync(EXCEL_PATH)
  }

  // 2. Supabase Storage'dan indir (production)
  try {
    const sb = getSupabase()
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) return null
    const arrayBuf = await data.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yil = searchParams.get('yil') ? parseInt(searchParams.get('yil')!) : null
  const ay  = searchParams.get('ay')  ? parseInt(searchParams.get('ay')!)  : null

  const buf = await getExcelBuffer()

  if (!buf) {
    return NextResponse.json<BsyCiroResponse>({
      rows: [], yillar: [],
      fetched_at: new Date().toISOString(),
      source: 'empty',
    })
  }

  try {
    const wb  = XLSX.read(buf, { type: 'buffer', dense: true })
    const ws  = wb.Sheets['Data']
    if (!ws) throw new Error('Data sayfası bulunamadı')

    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const rows: BsyCiroRow[] = []
    const yilSet = new Set<number>()

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]
      if (!r) continue

      const grupKodu     = String(r[16] ?? '').toUpperCase().trim()
      const gc           = String(r[18] ?? '').toUpperCase().trim()
      const tur          = String(r[10] ?? '').toUpperCase().trim()
      const netTutar     = typeof r[11] === 'number' ? r[11] : parseFloat(String(r[11] ?? '0').replace(',', '.'))
      const rowYil       = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
      const rowAy        = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
      const plasiyerKodu = String(r[31] ?? '').trim()  // r[31] = Plasiyer Kodu (KB1, MB1 vb.)

      if (!plasiyerKodu || !grupKodu || !rowYil || !rowAy) continue
      // Sadece tanımlı BSY kodları (MB10 = admin gibi BSY dışı kodlar atlanır)
      const bsyAdi = BSY_KOD_TO_NAME[plasiyerKodu]
      if (!bsyAdi) continue

      // C (çıkış) ve G (iade/giriş) dahil
      if (gc !== 'C' && gc !== 'G') continue

      const brand = GRUP_TO_BRAND[grupKodu]
      if (!brand) continue

      yilSet.add(rowYil)

      if (yil && rowYil !== yil) continue
      if (ay  && rowAy  !== ay)  continue

      const tutar = tur.includes('IADE') ? -Math.abs(netTutar) : netTutar
      rows.push({ bsyAdi, brand, yil: rowYil, ay: rowAy, gercCiro: tutar })
    }

    return NextResponse.json<BsyCiroResponse>({
      rows,
      yillar: [...yilSet].sort((a, b) => a - b),
      fetched_at: new Date().toISOString(),
      source: 'excel',
    })
  } catch (err) {
    console.error('[bsy-ciro] Excel okuma hatası:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
