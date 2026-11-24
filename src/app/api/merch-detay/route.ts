import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'
import { subeleriEsle } from '@/lib/subeStok'
import { subeYetkileri } from '@/lib/subeYetki'

// Merch personeli olmayan ama sorumlusu tanımlı şubeler (Şube Takibi evreni için)
interface SubeAtama {
  cari_adi: string; sube_kod: string; sube_adi: string
  sup_adi: string; jr_adi: string; bsy_kod: string; bsy_adi: string
  kaynak: 'b2b' | 'destek' | 'elle'
}

const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'

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

export async function GET(req: Request) {
  // ?yenile=1 → cache'i atla, B2B'den taze çek (Prim Ödeme "Yenile" butonu)
  const yenile = new URL(req.url).searchParams.get('yenile') === '1'
  try {
    // export_merch_detay.php'den tüm merch bilgilerini çek.
    // Başlık ismine göre ayrıştırılır — export'a kolon eklendiğinde (ör.
    // MERCH_TC_NO) sabit indeksler kayıp cari/şube/bsy/sup alanlarını
    // bozuyordu; header bazlı okuma buna dayanıklıdır.
    const phpUrl = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'
    const { rows: mdRows } = parseHtmlTableByHeader(await fetchPhpHtml(phpUrl, { force: yenile }))
    const merchMap = new Map<string, MerchDetay>()
    const subeAtamalari: SubeAtama[] = []

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

      if (!merchAdi) {
        // Merch personeli olmayan şube satırı: sorumlusu varsa şube ataması olarak sakla
        if (subeKod && (supAdi || jrSupAdi)) {
          subeAtamalari.push({ cari_adi: cariAdi, sube_kod: subeKod, sube_adi: subeAdi, sup_adi: supAdi, jr_adi: jrSupAdi, bsy_kod: bsyKod, bsy_adi: bsyAdi, kaynak: 'b2b' })
        }
        continue
      }

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

    // Merch personeli olmayan şubelerin sorumluları:
    //  - B2B cari-şube raporundaki süpervizör kolonları (eklenirse) ve elle atamalar (sube_yetki)
    //  - Supabase destek personeli kayıtları (şube adı B2B şube koduna eşlenir)
    try {
      const { rows: csRows } = parseHtmlTableByHeader(await fetchPhpHtml(CARI_SUBE_URL, { force: yenile }))
      for (const y of await subeYetkileri(csRows)) subeAtamalari.push({ ...y })
      const destekler = [...merchMap.values()].filter(m => m.merch_grubu === 'Destek Personeli' && !m.sube_kod && m.sube_adi && m.sup_adi)
      if (destekler.length) {
        const adaylar = csRows
          .map(r => ({ subeKod: (r['SUBE_KOD'] ?? '').trim(), cariAdi: (r['CARI_ADI'] ?? '').trim(), subeAdi: (r['SUBE_ADI'] ?? '').trim(), bsyKod: (r['BSY_KODU'] ?? '').trim(), bsyAdi: (r['BSY_ADI'] ?? '').trim() }))
          .filter(a => a.subeKod)
        const eslesme = subeleriEsle(destekler.map(d => ({ cariAdi: d.cari_adi, subeAdi: d.sube_adi })), adaylar)
        destekler.forEach((d, i) => {
          const a = eslesme[i] as (typeof adaylar)[number] | null
          if (!a) return
          subeAtamalari.push({
            cari_adi: a.cariAdi, sube_kod: a.subeKod, sube_adi: a.subeAdi,
            sup_adi: d.sup_adi, jr_adi: '', bsy_kod: a.bsyKod, bsy_adi: a.bsyAdi || d.bsy_adi, kaynak: 'destek',
          })
        })
      }
    } catch (e) {
      console.warn('Şube yetkileri alınamadı:', e)
    }

    const merchList = Array.from(merchMap.values())

    return NextResponse.json({
      count: merchList.length,
      data: merchList,
      subeAtamalari,
    })
  } catch (error) {
    console.error('Merch detay fetch error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// PHP raporu yavaş/büyük: kalıcı cache + arka plan yenileme için süre
export const maxDuration = 300
