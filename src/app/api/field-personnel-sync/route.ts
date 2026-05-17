import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SOURCE_URL = 'http://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
}

interface RawRow {
  merch_adi:   string
  merch_grubu: string
  cari_adi:    string
  sube_adi:    string
  sup_adi:     string
  bsy_adi:     string
}

function parseHtmlTable(html: string): RawRow[] {
  const trMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
  const seen = new Set<string>()
  const rows: RawRow[] = []

  for (let i = 1; i < trMatches.length; i++) {
    const rowHtml = trMatches[i][1]
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')).trim()
    )
    if (cells.length < 15) continue

    const merch_adi   = cells[0]
    const cari_adi    = cells[1]
    const sube_adi    = cells[2]
    const merch_grubu = cells[14]  // MERCH_TIPI
    const sup_adi     = cells[9]   // SUPERVISOR_ADI
    const bsy_adi     = cells[16] ?? ''

    if (!merch_adi) continue

    const key = `${merch_adi}||${cari_adi}||${sube_adi}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({ merch_adi, merch_grubu, cari_adi, sube_adi, sup_adi, bsy_adi })
  }

  return rows
}

export async function POST() {
  try {
    // 1. Dış URL'den veri çek
    const res = await fetch(SOURCE_URL, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Kaynak sunucu hatası: ${res.status}` }, { status: 502 })
    }
    const html = await res.text()
    const newRows = parseHtmlTable(html)

    if (newRows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'Kaynak verisi boş' })
    }

    const sb = getAdmin()

    // 2. Mevcut field_personnel kayıtlarını çek
    const { data: existing, error: fetchErr } = await sb
      .from('field_personnel')
      .select('merch_adi, cari_adi, sube_adi')
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const existingKeys = new Set(
      (existing ?? []).map((r: { merch_adi: string; cari_adi: string; sube_adi: string }) =>
        `${r.merch_adi}||${r.cari_adi}||${r.sube_adi}`
      )
    )

    // 3. Sadece yeni (eksik) kayıtları ekle
    const toInsert = newRows.filter(r =>
      !existingKeys.has(`${r.merch_adi}||${r.cari_adi}||${r.sube_adi}`)
    )

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'Tüm kayıtlar zaten mevcut' })
    }

    const { error: insertErr } = await sb
      .from('field_personnel')
      .insert(toInsert.map(r => ({
        merch_adi:     r.merch_adi,
        merch_grubu:   r.merch_grubu,
        cari_adi:      r.cari_adi,
        sube_adi:      r.sube_adi,
        sup_adi:       r.sup_adi,
        bsy_adi:       r.bsy_adi,
        jr_profile_id: null,
      })))

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, inserted: toInsert.length, total: newRows.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
