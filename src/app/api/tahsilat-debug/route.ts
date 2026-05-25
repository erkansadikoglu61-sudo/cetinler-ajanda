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

export async function GET() {
  const buf = await getExcelBuffer()
  if (!buf) return NextResponse.json({ error: 'Excel bulunamadı' }, { status: 500 })

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })
  const result: Record<string, unknown[][]> = {}

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    result[sheetName] = raw.slice(0, 5) // ilk 5 satır
  }

  return NextResponse.json(result)
}
