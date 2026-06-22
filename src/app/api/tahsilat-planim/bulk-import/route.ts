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

    // Önce mevcut kayıtları kontrol et - sadece YENİ kayıtları ekle, mevcut olanları GÜNCELLEME
    const cariKodlar = inserts.map((i: any) => i.cari_kod)
    const { data: mevcutKayitlar } = await sb
      .from('tahsilat_planim')
      .select('cari_kod, bsy_adi')
      .eq('yil', yil)
      .eq('ay', ay)
      .in('cari_kod', cariKodlar)

    const mevcutSet = new Set(
      mevcutKayitlar?.map(k => `${k.bsy_adi}|${k.cari_kod}`) || []
    )

    // Sadece mevcut olmayan kayıtları ekle
    const yeniKayitlar = inserts.filter((i: any) =>
      !mevcutSet.has(`${i.bsy_adi}|${i.cari_kod}`)
    )

    if (yeniKayitlar.length === 0) {
      return NextResponse.json({
        message: 'Tüm kayıtlar zaten mevcut, güncelleme yapılmadı',
        count: 0,
        skipped: inserts.length
      })
    }

    const { error } = await sb
      .from('tahsilat_planim')
      .insert(yeniKayitlar)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: yeniKayitlar.length,
      skipped: inserts.length - yeniKayitlar.length
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
