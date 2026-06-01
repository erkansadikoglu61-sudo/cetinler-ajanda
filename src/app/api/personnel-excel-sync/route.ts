import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface ExcelRow {
  merch_adi:   string
  sup_adi:     string | null
  merch_grubu: string | null
  cari_adi:    string | null
  sube_adi:    string | null
  jr_adi:      string | null
  bsy_adi:     string | null
}

// POST /api/personnel-excel-sync
// Body: { rows: ExcelRow[], secret: string }
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Basit koruma — deploy sırasında ayarlanan gizli anahtar
    if (body.secret !== process.env.PERSONNEL_SYNC_SECRET) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const excelRows: ExcelRow[] = body.rows ?? []
    if (excelRows.length === 0) {
      return NextResponse.json({ error: 'Satır gönderilmedi' }, { status: 400 })
    }

    const client = sb()

    // Excel'deki kopyaları (merch_adi + sube_adi) temizle
    const seen = new Set<string>()
    const dedupedRows: object[] = []
    for (const row of excelRows) {
      const k = `${(row.merch_adi ?? '').trim()}||${(row.sube_adi ?? '').trim()}`
      if (seen.has(k)) continue
      seen.add(k)
      dedupedRows.push({
        merch_adi:   (row.merch_adi ?? '').trim() || null,
        sup_adi:     row.sup_adi?.trim()     || null,
        merch_grubu: row.merch_grubu?.trim() || null,
        cari_adi:    row.cari_adi?.trim()    || null,
        sube_adi:    row.sube_adi?.trim()    || null,
        jr_adi:      row.jr_adi?.trim()      || null,
        bsy_adi:     row.bsy_adi?.trim()     || null,
      })
    }

    // Supabase upsert: onConflict = merch_adi,sube_adi
    // jr_profile_id sütunu gönderilmediği için dokunulmaz
    let upserted = 0
    const BATCH = 100
    for (let i = 0; i < dedupedRows.length; i += BATCH) {
      const slice = dedupedRows.slice(i, i + BATCH)
      const { error } = await client
        .from('field_personnel')
        .upsert(slice, { onConflict: 'merch_adi,sube_adi', ignoreDuplicates: false })
      if (error) return NextResponse.json({ error: `Upsert hatası (batch ${Math.floor(i/BATCH)+1}): ${error.message}` }, { status: 500 })
      upserted += slice.length
    }

    return NextResponse.json({
      ok: true,
      upserted,
      total: excelRows.length,
      deduped: excelRows.length - dedupedRows.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
