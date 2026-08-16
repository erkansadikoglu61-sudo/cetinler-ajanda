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

async function getExcelBuffer(): Promise<Buffer | null> {
  if (fs.existsSync(EXCEL_PATH)) return fs.readFileSync(EXCEL_PATH)
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch { return null }
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
  return 0
}

// Türkçe karakterleri sadeleştir + boşluk/nokta/altçizgi kaldır
function normTr(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/i̇/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[._\s]/g, '')
}

// Tür kolonundaki 2 değeri (Banka-KK / Çek-Senet) gruplara eşle
function paymentBucket(tur: string): 'bankaKK' | 'cekSenet' | null {
  const t = normTr(tur)
  if (!t) return null
  if (t.includes('cek') || t.includes('senet')) return 'cekSenet'
  if (t.includes('banka') || t.includes('kk') || t.includes('kart')) return 'bankaKK'
  return null
}

export interface TahsilatGerceklesenResponse {
  bankaKK: number
  cekSenet: number
  toplam: number
}

export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay  = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1

  const empty: TahsilatGerceklesenResponse = { bankaKK: 0, cekSenet: 0, toplam: 0 }

  const buf = await getExcelBuffer()
  if (!buf) return NextResponse.json<TahsilatGerceklesenResponse>(empty)

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })

  // SAHA.xlsx → "Gerçekleşen Tahsilat" sayfası
  const sheet = wb.Sheets['Gerçekleşen Tahsilat']
  const raw: unknown[][] = sheet
    ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
    : []
  if (raw.length < 2) return NextResponse.json<TahsilatGerceklesenResponse>(empty)

  // Header'dan kolon indekslerini bul
  let ayCol = -1, yilCol = -1, turCol = -1, tutarCol = -1
  const header = raw[0] as unknown[]
  for (let c = 0; c < header.length; c++) {
    const h = normTr(String(header[c] ?? ''))
    if (h === 'ay') ayCol = c
    if (h === 'yil') yilCol = c
    if (turCol === -1 && (h.includes('tur') || h.includes('tip') || h.includes('odeme'))) turCol = c
    if (tutarCol === -1 && h.includes('tutar')) tutarCol = c
  }

  const res: TahsilatGerceklesenResponse = { bankaKK: 0, cekSenet: 0, toplam: 0 }

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    if (yilCol >= 0) {
      const rowYil = typeof r[yilCol] === 'number' ? r[yilCol] : parseInt(String(r[yilCol] ?? '0'))
      if (rowYil !== yil) continue
    }
    if (ayCol >= 0) {
      const rowAy = typeof r[ayCol] === 'number' ? r[ayCol] : parseInt(String(r[ayCol] ?? '0'))
      if (rowAy !== ay) continue
    }

    const tutar = tutarCol >= 0 ? toNum(r[tutarCol]) : 0
    if (!tutar) continue

    const bucket = turCol >= 0 ? paymentBucket(String(r[turCol] ?? '')) : null
    if (!bucket) continue

    res[bucket] += tutar
  }

  res.toplam = res.bankaKK + res.cekSenet
  return NextResponse.json<TahsilatGerceklesenResponse>(res)
}
