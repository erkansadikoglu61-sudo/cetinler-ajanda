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

export interface KpiAdetRow {
  bsyAdi:   string
  stokKodu: string
  stokAdi:  string
  adet:     number
}

export interface StokItem {
  stokKodu: string
  stokAdi:  string
}

export interface KpiAdetResponse {
  rows:    KpiAdetRow[]
  stoklar: StokItem[]
  yillar:  number[]
}

export async function GET(req: Request) {
  const sp       = new URL(req.url).searchParams
  const yil      = sp.get('yil') ? parseInt(sp.get('yil')!) : null
  const ay       = sp.get('ay')  ? parseInt(sp.get('ay')!)  : null
  // Ay aralığı desteği: ayBaslangic ve ayBitis
  const ayBaslangic = sp.get('ayBaslangic') ? parseInt(sp.get('ayBaslangic')!) : ay
  const ayBitis     = sp.get('ayBitis')     ? parseInt(sp.get('ayBitis')!)     : ay
  const stokKodu = sp.get('stokKodu') ?? null
  // Çoklu stok kodu desteği: stokKodlar=REP9548P,REP9548G
  const stokKodlarParam = sp.get('stokKodlar')
  const stokKodlarSet: Set<string> | null = stokKodlarParam
    ? new Set(stokKodlarParam.split(',').map(s => s.trim()).filter(Boolean))
    : null

  const buf = await getExcelBuffer()
  if (!buf) {
    return NextResponse.json<KpiAdetResponse>({ rows: [], stoklar: [], yillar: [] })
  }

  const wb  = XLSX.read(buf, { type: 'buffer', dense: true })
  const ws  = wb.Sheets['Data']
  if (!ws) return NextResponse.json({ error: 'Data sayfası bulunamadı' }, { status: 500 })

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // stok kodu → adı haritası (sadece seçili dönem)
  const stoklarMap = new Map<string, string>()
  // bsyAdi → adet haritası (stok filtresi uygulanmış)
  const bsyAdetMap = new Map<string, number>()
  const yilSet     = new Set<number>()

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const gc          = String(r[18] ?? '').toUpperCase().trim()
    const rowYil      = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
    const rowAy       = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
    const plasiyerAdi = String(r[32] ?? '').trim()
    const rowStokKodu = String(r[8]  ?? '').trim()
    const rowStokAdi  = String(r[9]  ?? '').trim()
    const rawAdet     = typeof r[15] === 'number' ? r[15] : parseFloat(String(r[15] ?? '0').replace(',', '.'))

    if (!plasiyerAdi || !rowStokKodu || !rowYil || !rowAy) continue
    if (gc !== 'C' && gc !== 'G') continue

    yilSet.add(rowYil)

    // Dönem filtresi
    if (yil && rowYil !== yil) continue
    if (ayBaslangic && rowAy < ayBaslangic) continue
    if (ayBitis     && rowAy > ayBitis)     continue

    // Stok kodu listesi için (dönem eşleşmişse)
    stoklarMap.set(rowStokKodu, rowStokAdi)

    // Satır filtresi
    if (stokKodlarSet) {
      // Çoklu stok kodu modu
      if (!stokKodlarSet.has(rowStokKodu)) continue
    } else if (stokKodu) {
      if (rowStokKodu !== stokKodu) continue
    }

    // Adet: C=satış(+), G=iade(-)
    const adet = gc === 'G' ? -Math.abs(rawAdet) : rawAdet
    bsyAdetMap.set(plasiyerAdi, (bsyAdetMap.get(plasiyerAdi) ?? 0) + adet)
  }

  const aktifStok = stokKodlarParam ?? stokKodu
  const rows: KpiAdetRow[] = aktifStok
    ? [...bsyAdetMap.entries()]
        .map(([bsyAdi, adet]) => ({
          bsyAdi,
          stokKodu: aktifStok,
          stokAdi:  stokKodlarParam
            ? (stokKodlarParam)   // birden fazla → parametre olarak dön
            : (stoklarMap.get(stokKodu!) ?? ''),
          adet,
        }))
        .filter(r => r.adet !== 0)
        .sort((a, b) => b.adet - a.adet)
    : []

  const stoklar: StokItem[] = [...stoklarMap.entries()]
    .map(([stokKodu, stokAdi]) => ({ stokKodu, stokAdi }))
    .sort((a, b) => a.stokKodu.localeCompare(b.stokKodu, 'tr'))

  return NextResponse.json<KpiAdetResponse>({
    rows,
    stoklar,
    yillar: [...yilSet].sort((a, b) => a - b),
  })
}
