import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.storage
      .from('bsy-excel')
      .download('SAHA.xlsx')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })

    if (!wb.SheetNames.includes('Adet Primleri')) {
      return NextResponse.json({
        error: 'Adet Primleri sayfası bulunamadı',
        sheetNames: wb.SheetNames
      }, { status: 404 })
    }

    const ws = wb.Sheets['Adet Primleri']
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    return NextResponse.json({
      sheetNames: wb.SheetNames,
      totalRows: jsonData.length,
      header: jsonData[0] || [],
      sample: jsonData.slice(0, 15)
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
