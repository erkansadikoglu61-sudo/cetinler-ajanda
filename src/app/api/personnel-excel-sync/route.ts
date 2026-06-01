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

    // 1. Mevcut kayıtları çek (key: merch_adi||cari_adi||sube_adi)
    const { data: existing, error: fetchErr } = await client
      .from('field_personnel')
      .select('id, merch_adi, cari_adi, sube_adi, jr_profile_id')
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const existingMap = new Map<string, { id: string; jr_profile_id: string | null }>()
    for (const r of existing ?? []) {
      const k = `${(r.merch_adi ?? '').trim()}||${(r.sube_adi ?? '').trim()}`
      existingMap.set(k, { id: r.id, jr_profile_id: r.jr_profile_id })
    }

    const toInsert: object[] = []
    const toUpdate: { id: string; fields: object }[] = []
    const seenKeys = new Set<string>()  // Excel'deki kopyaları atla

    for (const row of excelRows) {
      const k = `${(row.merch_adi ?? '').trim()}||${(row.sube_adi ?? '').trim()}`
      if (seenKeys.has(k)) continue   // Excel'de tekrar eden satırı atla
      seenKeys.add(k)
      const fields = {
        merch_adi:   row.merch_adi?.trim()   || null,
        sup_adi:     row.sup_adi?.trim()     || null,
        merch_grubu: row.merch_grubu?.trim() || null,
        cari_adi:    row.cari_adi?.trim()    || null,
        sube_adi:    row.sube_adi?.trim()    || null,
        jr_adi:      row.jr_adi?.trim()      || null,
        bsy_adi:     row.bsy_adi?.trim()     || null,
      }
      const ex = existingMap.get(k)
      if (ex) {
        toUpdate.push({ id: ex.id, fields })
      } else {
        toInsert.push({ ...fields, jr_profile_id: null })
      }
    }

    // 2. Yeni kayıtları ekle (batch 100)
    let inserted = 0
    for (let i = 0; i < toInsert.length; i += 100) {
      const { error } = await client.from('field_personnel').insert(toInsert.slice(i, i + 100))
      if (error) return NextResponse.json({ error: `Insert hatası: ${error.message}` }, { status: 500 })
      inserted += toInsert.slice(i, i + 100).length
    }

    // 3. Mevcut kayıtları güncelle (jr_profile_id dokunma)
    let updated = 0
    for (const { id, fields } of toUpdate) {
      const { error } = await client.from('field_personnel').update(fields).eq('id', id)
      if (error) return NextResponse.json({ error: `Update hatası (${id}): ${error.message}` }, { status: 500 })
      updated++
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      total: excelRows.length,
      skipped: excelRows.length - inserted - updated,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
