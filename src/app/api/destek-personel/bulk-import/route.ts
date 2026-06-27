import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Destek personelleri listesi
const DESTEK_PERSONELLERI = [
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Büşran Aksu' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Çağla Özcan' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Fatma Kahveci' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Hacer Gök' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Semiha Dağgül' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Taha Keleş' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Ahmet Aycibin' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Ayla ayçil' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Efe Ersöz' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Saadet Arslan' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'İlknur Akyol' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Burak Gök' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Özgür Arif Özdimdik' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Figen Seçilmiş' },
  { cari: 'ÜLKÜGRUP TEKSTİL ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Gülşen Vatansever' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Fuat Kuşol' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'İlknur Bahçeci' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Tülay Buğa' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'ÇİĞLİ', merch: 'Zeliha Tosun' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'MENEMEN', merch: 'Işıl Gül' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'MENEMEN', merch: 'Nurten Çalıkuşu' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'MENEMEN', merch: 'Sibel Gezer' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'MENEMEN', merch: 'Yeliz Çamur' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'MENEMEN', merch: 'Dicle Özen' },
  { cari: 'ZOROĞLU ALIŞVERİŞ EĞİTİM İNŞ. TAR. SAN. VE TİC. LTD. ŞTİ.', sube: 'AYDIN', merch: 'Bahar Güler' },
  { cari: 'ZOROĞLU ALIŞVERİŞ EĞİTİM İNŞ. TAR. SAN. VE TİC. LTD. ŞTİ.', sube: 'AYDIN', merch: 'Deniz Yılmaz' },
  { cari: 'ZOROĞLU ALIŞVERİŞ EĞİTİM İNŞ. TAR. SAN. VE TİC. LTD. ŞTİ.', sube: 'AYDIN', merch: 'Bahriye Dedeli' },
  { cari: 'ZOROĞLU ALIŞVERİŞ EĞİTİM İNŞ. TAR. SAN. VE TİC. LTD. ŞTİ.', sube: 'AYDIN', merch: 'Emine Balcı' },
  { cari: 'ZOROĞLU ALIŞVERİŞ EĞİTİM İNŞ. TAR. SAN. VE TİC. LTD. ŞTİ.', sube: 'AYDIN', merch: 'Özlem Şenay' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'ÇAMLIK', merch: 'Nilay Kumsavuran' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'ÇAMLIK', merch: 'Zeynep Çeşmeci' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'ÇİĞLİ', merch: 'Didem Aydın' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'ÇİĞLİ', merch: 'Gülay Kömürcü' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'ÇİĞLİ', merch: 'Buse Karagöz' },
  { cari: 'BANCO ÇELİK HALI MOB. DAY. TÜK.MAL. İNŞ.SAN.VE TİC.LTD.ŞTİ.', sube: 'ÇİĞLİ', merch: 'Tuba Güldalı' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'DÜZCE', merch: 'Yasemin Sinik' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'KIZILAY', merch: 'Birgül Kaya' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'KIZILAY', merch: 'Hatice Akbulut' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'ÜMRANİYE', merch: 'Şennur Kılıç' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'ÜMRANİYE', merch: 'Zeynep Kızıldaş Atasever' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'ESENLER', merch: 'Meral Donat' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'ESENLER', merch: 'Türkan Yavuz' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'BURSA 4', merch: 'Burcu Haydari' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC.A.Ş.', sube: 'BURSA 4', merch: 'Ümmügül Gengeç' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÜÇÜKBAKKALKÖY', merch: 'Eda Sungur' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÜÇÜKBAKKALKÖY', merch: 'Kübra Er' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Aynur Çelebi' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Gülşen Özden' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Mevlude Kılıç' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Gülten Tümer' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Nurgül Ülker' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'Ayşenur İşyar' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'Binnaz Erdem' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'Elif Altun' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'KURTKÖY', merch: 'Özlem Çam' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'KURTKÖY', merch: 'Zeynep Uyan' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'KURTKÖY', merch: 'Özge Öztürk' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Zübeyde Yıldız' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Tuna Demir' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'Afra Menteşe' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'Elif Özdemir' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'Hasan Çam' },
  { cari: 'ASYA A.V.M.TİC.LTD.ŞTİ.', sube: 'PAŞABAHÇE', merch: 'İrem Nur Toklu' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Öznur Subaşı' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Semanur Kocabay' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Tenzile Emen' },
  { cari: 'ASYA ÇARŞI DAY. TÜK. MALL. TİC.LTD.ŞTİ.', sube: 'KÖRFEZ', merch: 'Emine Çağlar' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'ARNAVUTKÖY', merch: 'Cansu Biçer' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'ARNAVUTKÖY', merch: 'Ceyda Üner' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'ARNAVUTKÖY', merch: 'Derya Aktürk' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'HÜSEYİNGAZİ', merch: 'Dilek Bici' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'HÜSEYİNGAZİ', merch: 'Melis Dinçer' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'HÜSEYİNGAZİ', merch: 'Onur Tutak' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'UFUKTEPE', merch: 'Cansu Kuru' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'MECİDİYE', merch: 'Gamze İpek' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'HÜSEYİNGAZİ', merch: 'Sümeyye Şair' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'PURSAKLAR', merch: 'Öznur Olgun' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'NATOYOLU', merch: 'Damla Akbulut' },
  { cari: 'OĞUZ MOB.HALI DAY.TÜK.MAL.İNŞ.İTH.İHR.ve TİC.LTD.ŞTİ.', sube: 'NATOYOLU', merch: 'Sude Leyla Han' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'BOĞAZİÇİ', merch: 'Didem Aşkın Gündem' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'BOĞAZİÇİ', merch: 'Huzeyma İpek' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'GİMSAPARK', merch: 'Duygu Laçin' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'ELVANKENT', merch: 'Duygu Kaymaz' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'PINARBAŞI', merch: 'Kardelen Özkan' },
  { cari: 'TAŞPINAR MAĞAZACILIK DAYANIKLI TÜKETİM MALLARI A.Ş', sube: 'ETİMESGUT', merch: 'Sultan Yiğit' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'FORBES', merch: 'Nermin Uğur' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'FORBES', merch: 'Şerife Çakır' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'FORBES', merch: 'Feyyaz Korkmaz' },
  { cari: 'ÖZ ŞANAL ZÜCCACİYE VE DAYANIKLI TÜKETİM MALLARI SANAYİ VE TİCARET ANONİM ŞİRKETİ', sube: 'FORBES', merch: 'Mehmet Serkan Kilerciler' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC', sube: 'ADANA', merch: 'Ebru Can' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC', sube: 'ESKİŞEHİR', merch: 'Şirin Çağlar Yeşiltaş' },
  { cari: 'EVKUR ALIŞVERİŞ MERKEZLERİ TİC', sube: 'ESKİŞEHİR', merch: 'Emine Pelin Tosun' },
]

export async function POST() {
  try {
    const sb = getAdmin()

    // Duplicate kontrolü için existing kayıtları al
    const { data: existing } = await sb
      .from('field_personnel')
      .select('sube_adi, cari_adi, merch_adi')
      .eq('merch_grubu', 'Destek Personeli')

    const existingKeys = new Set(
      (existing ?? []).map((r: { sube_adi: string; cari_adi: string; merch_adi: string }) =>
        `${r.sube_adi}||${r.cari_adi}||${r.merch_adi}`
      )
    )

    // Sadece yeni kayıtları filtrele
    const toInsert = DESTEK_PERSONELLERI.filter(p => {
      const key = `${p.sube}||${p.cari}||${p.merch}`
      return !existingKeys.has(key)
    }).map(p => ({
      sube_adi: p.sube,
      cari_adi: p.cari,
      merch_adi: p.merch,
      merch_grubu: 'Destek Personeli',
    }))

    if (toInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        skipped: DESTEK_PERSONELLERI.length,
        message: 'Tüm kayıtlar zaten mevcut',
      })
    }

    // Batch insert
    const { data, error } = await sb
      .from('field_personnel')
      .insert(toInsert)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      inserted: toInsert.length,
      skipped: DESTEK_PERSONELLERI.length - toInsert.length,
      data,
    })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
