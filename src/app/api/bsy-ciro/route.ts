import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { GRUP_TO_BRAND, BsyCiroRow, BsyCiroResponse } from '@/lib/bsy'

// Excel dosyası yolu — ortam değişkeni veya varsayılan Desktop yolu
const EXCEL_PATH =
  process.env.BSY_EXCEL_PATH ??
  path.join(
    process.env.HOME ?? '/Users/erkansadikoglu',
    'Desktop/uzak/Ciro Analizi-Genel.xlsx'
  )

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yil = searchParams.get('yil') ? parseInt(searchParams.get('yil')!) : null
  const ay  = searchParams.get('ay')  ? parseInt(searchParams.get('ay')!)  : null

  // Excel okunabiliyorsa oku, yoksa boş döndür
  if (!fs.existsSync(EXCEL_PATH)) {
    return NextResponse.json<BsyCiroResponse>({
      rows: [], yillar: [],
      fetched_at: new Date().toISOString(),
      source: 'empty',
    })
  }

  try {
    const buf = fs.readFileSync(EXCEL_PATH)
    const wb  = XLSX.read(buf, { type: 'buffer', dense: true })
    const ws  = wb.Sheets['Data']
    if (!ws) throw new Error('Data sayfası bulunamadı')

    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Kolon indeksleri (0-tabanlı):
    // Net Tutar=11, Grup Kodu=14, Tür=10, G/Ç=16, Ay=18, Yıl=19, Plasiyer Adı=30
    const rows: BsyCiroRow[] = []
    const yilSet = new Set<number>()

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]
      if (!r) continue

      const grupKodu    = String(r[14] ?? '').toUpperCase().trim()
      const gc          = String(r[16] ?? '').toUpperCase().trim()
      const tur         = String(r[10] ?? '').toUpperCase().trim()
      const netTutar    = typeof r[11] === 'number' ? r[11] : parseFloat(String(r[11] ?? '0').replace(',', '.'))
      const rowYil      = typeof r[19] === 'number' ? r[19] : parseInt(String(r[19] ?? '0'))
      const rowAy       = typeof r[18] === 'number' ? r[18] : parseInt(String(r[18] ?? '0'))
      const plasiyerAdi = String(r[30] ?? '').trim()

      if (!plasiyerAdi || !grupKodu || !rowYil || !rowAy) continue

      // Sadece çıkış işlemlerini al
      if (gc !== 'C') continue

      const brand = GRUP_TO_BRAND[grupKodu]
      if (!brand) continue

      yilSet.add(rowYil)

      // Dönem filtresi
      if (yil && rowYil !== yil) continue
      if (ay  && rowAy  !== ay)  continue

      // İadeyi negatif say
      const tutar = tur.includes('IADE') ? -Math.abs(netTutar) : netTutar

      rows.push({ bsyAdi: plasiyerAdi, brand, yil: rowYil, ay: rowAy, gercCiro: tutar })
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
