import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'

interface MerchDetay {
  merch_adi: string
  merch_id: string
  merch_tc: string
  merch_grubu: string
  cari_kod: string
  cari_adi: string
  sube_kod: string
  sube_adi: string
  iban: string
  bsy_kod: string
  bsy_adi: string
  sup_adi: string
  jr_adi: string
}

export async function GET() {
  try {
    // export_merch_detay.php'den tüm merch bilgilerini çek.
    // Başlık ismine göre ayrıştırılır — export'a kolon eklendiğinde (ör.
    // MERCH_TC_NO) sabit indeksler kayıp cari/şube/bsy/sup alanlarını
    // bozuyordu; header bazlı okuma buna dayanıklıdır.
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'
    const { rows: mdRows } = parseHtmlTableByHeader(await fetchPhpHtml(phpUrl))
    const merchMap = new Map<string, MerchDetay>()

    for (const r of mdRows) {
      const merchAdi  = r['MERCH_ADI'] || ''
      const merchId   = r['MERCH_ID'] || ''
      const merchTc   = r['MERCH_TC_NO'] || ''
      const merchTipi = r['MERCH_TIPI'] || ''
      const cariKod   = r['CARI_KODU'] || ''
      const cariAdi   = r['CARI_ISIM'] || ''
      const subeKod   = r['SUBE_KODU'] || ''
      const subeAdi   = r['SUBE_ADI'] || ''
      const iban      = r['IBAN'] || ''
      const bsyKod    = r['BSY_KODU'] || ''
      const bsyAdi    = r['BSY_ADI'] || ''
      const supAdi    = r['SUPERVIZOR'] || ''
      const jrSupAdi  = r['JR_SUPERVIZOR'] || ''

      if (!merchAdi) continue

      // Unique key: merch_adi + cari_kod + sube_kod
      const key = `${merchAdi}||${cariKod}||${subeKod}`

      if (!merchMap.has(key)) {
        merchMap.set(key, {
          merch_adi: merchAdi,
          merch_id: merchId,
          merch_tc: merchTc,
          merch_grubu: merchTipi,
          cari_kod: cariKod,
          cari_adi: cariAdi,
          sube_kod: subeKod,
          sube_adi: subeAdi,
          iban: iban,
          bsy_kod: bsyKod,
          bsy_adi: bsyAdi,
          sup_adi: supAdi,
          jr_adi: jrSupAdi,
        })
      }
    }

    // Destek Personeli'ni Supabase'den ekle
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: destekData } = await supabase
        .from('field_personnel')
        .select('merch_adi, merch_grubu, cari_adi, sube_adi, sup_adi, bsy_adi')
        .eq('merch_grubu', 'Destek Personeli')

      if (destekData) {
        destekData.forEach(d => {
          const key = `${d.merch_adi}||${d.cari_adi}`
          if (!merchMap.has(key)) {
            merchMap.set(key, {
              merch_adi: d.merch_adi || '',
              merch_id: '',
              merch_tc: '',
              merch_grubu: 'Destek Personeli',
              cari_kod: '',
              cari_adi: d.cari_adi || '',
              sube_kod: '',
              sube_adi: d.sube_adi || '',
              iban: '',
              bsy_kod: '',
              bsy_adi: d.bsy_adi || '',
              sup_adi: d.sup_adi || '',
              jr_adi: '',
            })
          }
        })
      }
    } catch (dbError) {
      console.warn('Destek Personeli fetch hatası:', dbError)
    }

    const merchList = Array.from(merchMap.values())

    return NextResponse.json({
      count: merchList.length,
      data: merchList
    })
  } catch (error) {
    console.error('Merch detay fetch error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
