import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : 2026
  const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : new Date().getMonth() + 1

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    // Aylık cari bazında ciro
    const { data: aylikData, error } = await supabase
      .from('saha_data')
      .select('cari_isim, net_tutar')
      .eq('yil', yil)
      .eq('ay', ay)

    if (error) throw error

    // Cari bazında topla
    const cariMap = new Map<string, number>()
    aylikData?.forEach(row => {
      const cari = row.cari_isim || 'Bilinmeyen'
      const tutar = parseFloat(String(row.net_tutar)) || 0
      cariMap.set(cari, (cariMap.get(cari) || 0) + tutar)
    })

    // Toplam ciro
    const toplamCiro = Array.from(cariMap.values()).reduce((sum, val) => sum + val, 0)

    // Listeye çevir ve sırala
    const cariListesi = Array.from(cariMap.entries())
      .map(([cariIsim, ciro]) => ({
        cariIsim,
        ciro,
        pay: toplamCiro > 0 ? ciro / toplamCiro : 0
      }))
      .sort((a, b) => b.ciro - a.ciro)

    return NextResponse.json({ cariListesi })
  } catch (error) {
    console.error('❌ Dashboard sales detail error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
