import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BSY_KOD_TO_NAME } from '@/lib/bsy'

export async function POST(req: Request) {
  try {
    const { rows } = await req.json()

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const yil = 2026
    const ay = 6 // Haziran

    const inserts = rows.map((r: any) => ({
      bsy_adi: BSY_KOD_TO_NAME[r.bsyKod] || '',
      cari_kod: r.cariKod,
      cari_isim: r.cariIsim || '',
      yil,
      ay,
      tahsilat_haftasi: r.tahsilatHaftasi || null,
      tahsilat_turu: r.tahsilatTuru || null,
      updated_at: new Date().toISOString()
    })).filter((r: any) => r.bsy_adi && r.cari_kod && (r.tahsilat_haftasi || r.tahsilat_turu))

    if (inserts.length === 0) {
      return NextResponse.json({ message: 'No valid data to import', count: 0 })
    }

    const { error } = await sb
      .from('tahsilat_planim')
      .upsert(inserts, {
        onConflict: 'bsy_adi,cari_kod,yil,ay'
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: inserts.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
