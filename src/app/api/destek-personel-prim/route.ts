import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface DestekPersonelRow {
  merch_adi: string
  sube_adi: string
  cari_adi: string
  cetinler_merch: string
  kategori: string
  hedef_gerceklesme: number      // %
  satis_adedi: number
  kosullu_destek_prim: number    // ₺/adet
  hak_edis: number               // ₺
}

// Merch hedef takip verisini çek (kategori performansı + satış adedi)
// Key: merch_adi → { kategori, hedef, gerceklesen, satisAdedi }[]
async function fetchMerchPerformance(phpUrl: string, yil: number, ay: number): Promise<Map<string, { kategori: string; hedefGerceklesme: number; satisAdedi: number }[]>> {
  try {
    const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
    const response = await fetch(`${phpUrl}?${params}`, {
      next: { revalidate: 300 },
    })

    if (!response.ok) return new Map()

    const htmlText = await response.text()

    // HTML table parse et
    // Kolonlar: MERCH_PERSONEL, CARI_ISIM, SUBE_ADI, STOK_ADI, STOK_KODU, GRUP_ACIKLAMA, SATILAN_ADET, ...
    const map = new Map<string, Map<string, { hedef: number; gerceklesen: number; satisAdedi: number }>>()

    const trMatches = htmlText.match(/<tr>[\s\S]*?<\/tr>/gi) || []

    for (let i = 1; i < trMatches.length; i++) { // i=1 → header atla
      const tr = trMatches[i]
      const tdMatches = tr.match(/<td>([\s\S]*?)<\/td>/gi) || []

      if (tdMatches.length >= 7) {
        // Index 0: MERCH_PERSONEL
        // Index 5: GRUP_ACIKLAMA (kategori)
        // Index 6: SATILAN_ADET
        const merchAdi = tdMatches[0]?.replace(/<\/?td>/gi, '').trim()
        const kategori = tdMatches[5]?.replace(/<\/?td>/gi, '').trim()
        const satisAdedi = parseFloat(tdMatches[6]?.replace(/<\/?td>/gi, '').trim() || '0') || 0

        if (merchAdi && kategori && satisAdedi > 0) {
          const merchKey = merchAdi.toLowerCase()

          if (!map.has(merchKey)) {
            map.set(merchKey, new Map())
          }

          const kategoriMap = map.get(merchKey)!

          if (!kategoriMap.has(kategori)) {
            kategoriMap.set(kategori, { hedef: 0, gerceklesen: 0, satisAdedi: 0 })
          }

          const existing = kategoriMap.get(kategori)!
          existing.gerceklesen += satisAdedi
          existing.satisAdedi += satisAdedi
        }
      }
    }

    // Hedefleri çek (ayrı API call veya varsayılan değer)
    // Şimdilik gerceklesen = satisAdedi, hedef = gerceklesen (yani %100 varsayımı)
    // TODO: Gerçek hedef API'si eklenirse burası güncellenecek

    const result = new Map<string, { kategori: string; hedefGerceklesme: number; satisAdedi: number }[]>()

    map.forEach((kategoriMap, merchKey) => {
      const rows: { kategori: string; hedefGerceklesme: number; satisAdedi: number }[] = []

      kategoriMap.forEach((data, kategori) => {
        // Geçici: hedef = gerceklesen (yani %100)
        // Gerçek hedef API'si geldiğinde düzeltilecek
        const hedefGerceklesme = 100

        rows.push({
          kategori,
          hedefGerceklesme,
          satisAdedi: data.satisAdedi,
        })
      })

      result.set(merchKey, rows)
    })

    return result
  } catch (error) {
    console.error('Merch performance fetch error:', error)
    return new Map()
  }
}

// Koşullu destek prim değerlerini çek (kategori bazında ortalama)
async function fetchKosulluDestekPrim(phpUrl: string, yil: number, ay: number): Promise<Map<string, number>> {
  try {
    // 1. Adet prim tablosunu çek
    const sb = getAdmin()
    const { data: primData, error } = await sb
      .from('adet_prim_override')
      .select('stok_kodu, kosullu_destek')
      .eq('yil', yil)
      .eq('ay', ay)

    // Defaults ile merge et
    const { ADET_PRIM_DEFAULTS } = await import('@/lib/adet-prim-defaults')
    const primMap = new Map<string, number>()

    // Defaults ekle
    ADET_PRIM_DEFAULTS.forEach(r => {
      if (r.kosulluDestek != null) {
        primMap.set(r.stokKodu, r.kosulluDestek)
      }
    })

    // Override'ları uygula
    if (!error && primData) {
      primData.forEach((row: { stok_kodu: string; kosullu_destek: number | null }) => {
        if (row.kosullu_destek != null) {
          primMap.set(row.stok_kodu, row.kosullu_destek)
        }
      })
    }

    // 2. Stok kodu → kategori mapping (PHP API HTML'den)
    const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
    const response = await fetch(`${phpUrl}?${params}`, {
      next: { revalidate: 300 },
    })

    const kategoriMap = new Map<string, string>() // stok_kodu → kategori

    if (response.ok) {
      const htmlText = await response.text()
      const trMatches = htmlText.match(/<tr>[\s\S]*?<\/tr>/gi) || []

      for (let i = 1; i < trMatches.length; i++) {
        const tr = trMatches[i]
        const tdMatches = tr.match(/<td>([\s\S]*?)<\/td>/gi) || []

        if (tdMatches.length >= 6) {
          // Index 4: STOK_KODU
          // Index 5: GRUP_ACIKLAMA (kategori)
          const stokKodu = tdMatches[4]?.replace(/<\/?td>/gi, '').trim()
          const kategori = tdMatches[5]?.replace(/<\/?td>/gi, '').trim()

          if (stokKodu && kategori && !kategoriMap.has(stokKodu)) {
            kategoriMap.set(stokKodu, kategori)
          }
        }
      }
    }

    // 3. Kategori bazında ortalama hesapla
    const kategoriPrimler = new Map<string, number[]>()

    primMap.forEach((prim, stokKodu) => {
      const kategori = kategoriMap.get(stokKodu) || 'Diğer'
      if (!kategoriPrimler.has(kategori)) {
        kategoriPrimler.set(kategori, [])
      }
      kategoriPrimler.get(kategori)!.push(prim)
    })

    const result = new Map<string, number>()
    kategoriPrimler.forEach((primler, kategori) => {
      const avg = primler.reduce((sum, val) => sum + val, 0) / primler.length
      result.set(kategori, avg)
    })

    return result
  } catch (error) {
    console.error('Koşullu destek prim fetch error:', error)
    return new Map()
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : new Date().getMonth() + 1

  try {
    const sb = getAdmin()

    // 1. Destek personelleri + şube/cari bilgileri
    const { data: destekPersonel, error: fpError } = await sb
      .from('field_personnel')
      .select('merch_adi, sube_adi, cari_adi, merch_grubu')
      .eq('merch_grubu', 'Destek Personeli')

    if (fpError) {
      return NextResponse.json({ error: fpError.message }, { status: 500 })
    }

    console.log('📊 Destek Personeli sayısı:', destekPersonel?.length || 0)

    if (!destekPersonel || destekPersonel.length === 0) {
      console.warn('⚠️ field_personnel tablosunda Destek Personeli bulunamadı!')
      return NextResponse.json({ rows: [] })
    }

    // 2. Sellout verisinden Çetinler merch'leri bul (şube + cari bazında)
    const phpUrl = process.env.PHP_API_URL
    if (!phpUrl) {
      console.warn('⚠️ PHP_API_URL not configured - returning placeholder data')

      // PHP API olmadan placeholder data
      const placeholderRows: DestekPersonelRow[] = destekPersonel.map(dp => ({
        merch_adi: dp.merch_adi,
        sube_adi: dp.sube_adi,
        cari_adi: dp.cari_adi,
        cetinler_merch: '-',
        kategori: '-',
        hedef_gerceklesme: 0,
        satis_adedi: 0,
        kosullu_destek_prim: 0,
        hak_edis: 0,
      }))

      return NextResponse.json({
        rows: placeholderRows,
        warning: 'PHP_API_URL not configured - showing placeholder data'
      })
    }

    const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
    const selloutRes = await fetch(`${phpUrl}?${params}`, {
      next: { revalidate: 300 },
    })

    if (!selloutRes.ok) {
      console.warn('⚠️ PHP Sellout API error:', selloutRes.status)
      return NextResponse.json({ rows: [] })
    }

    const htmlText = await selloutRes.text()
    console.log('📊 Sellout HTML length:', htmlText.length)

    // Şube + Cari → Çetinler Merch mapping (HTML'den parse)
    const subeCarimierchMap = new Map<string, string>()

    // Türkçe karakterleri normalize et
    const normalize = (str: string) => {
      return str
        .trim()
        .toLowerCase()
        .replace(/i̇/g, 'i')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, ' ')
    }

    const trMatches = htmlText.match(/<tr>[\s\S]*?<\/tr>/gi) || []

    for (let i = 1; i < trMatches.length; i++) {
      const tr = trMatches[i]
      const tdMatches = tr.match(/<td>([\s\S]*?)<\/td>/gi) || []

      if (tdMatches.length >= 15) {
        // Index 0: MERCH_PERSONEL
        // Index 1: CARI_ISIM
        // Index 2: SUBE_ADI
        // Index 14: MERCH_TIPI
        const merchAdi = tdMatches[0]?.replace(/<\/?td>/gi, '').trim()
        const cariAdi = tdMatches[1]?.replace(/<\/?td>/gi, '').trim()
        const subeAdi = tdMatches[2]?.replace(/<\/?td>/gi, '').trim()
        const merchTipi = tdMatches[14]?.replace(/<\/?td>/gi, '').trim()

        if (subeAdi && cariAdi && merchAdi && merchTipi === 'Çetinler Merch') {
          const key = `${normalize(subeAdi)}||${normalize(cariAdi)}`
          if (!subeCarimierchMap.has(key)) {
            subeCarimierchMap.set(key, merchAdi)
          }
        }
      }
    }

    // 3. Merch performans verileri (kategori bazında + satış adedi)
    const merchPerformanceMap = await fetchMerchPerformance(phpUrl, yil, ay)

    // 4. Koşullu destek prim değerleri (kategori bazında ortalama)
    const kosulluDestekPrimMap = await fetchKosulluDestekPrim(phpUrl, yil, ay)

    // 5. Her destek personeli için hesaplama
    const rows: DestekPersonelRow[] = []

    // Normalize fonksiyonu - Türkçe karakter dönüşümü
    const normalizeStr = (str: string) => {
      return str
        .trim()
        .toLowerCase()
        .replace(/i̇/g, 'i')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, ' ')
    }

    destekPersonel.forEach(dp => {
      const subeKey = `${normalizeStr(dp.sube_adi)}||${normalizeStr(dp.cari_adi)}`
      const cetinlerMerch = subeCarimierchMap.get(subeKey) || '-'

      if (cetinlerMerch === '-') {
        // Çetinler merch bulunamadı
        rows.push({
          merch_adi: dp.merch_adi,
          sube_adi: dp.sube_adi,
          cari_adi: dp.cari_adi,
          cetinler_merch: '-',
          kategori: '-',
          hedef_gerceklesme: 0,
          satis_adedi: 0,
          kosullu_destek_prim: 0,
          hak_edis: 0,
        })
      } else {
        // Çetinler merch bulundu - kategori bazında satırlar
        const kategoriData = merchPerformanceMap.get(cetinlerMerch.toLowerCase()) || []

        if (kategoriData.length === 0) {
          rows.push({
            merch_adi: dp.merch_adi,
            sube_adi: dp.sube_adi,
            cari_adi: dp.cari_adi,
            cetinler_merch: cetinlerMerch,
            kategori: '-',
            hedef_gerceklesme: 0,
            satis_adedi: 0,
            kosullu_destek_prim: 0,
            hak_edis: 0,
          })
        } else {
          // Her kategori için hesaplama
          kategoriData.forEach(({ kategori, hedefGerceklesme, satisAdedi }) => {
            const kategoriPrim = kosulluDestekPrimMap.get(kategori) || 0

            // HAK EDİŞ FORMÜLÜ:
            // %0-%99.99 → (gerceklesme / 100) × prim × adet
            // %100+     → prim × adet (tam prim)
            let hakEdis = 0
            if (hedefGerceklesme < 100) {
              hakEdis = (hedefGerceklesme / 100) * kategoriPrim * satisAdedi
            } else {
              hakEdis = kategoriPrim * satisAdedi
            }

            rows.push({
              merch_adi: dp.merch_adi,
              sube_adi: dp.sube_adi,
              cari_adi: dp.cari_adi,
              cetinler_merch: cetinlerMerch,
              kategori,
              hedef_gerceklesme: hedefGerceklesme,
              satis_adedi: satisAdedi,
              kosullu_destek_prim: kategoriPrim,
              hak_edis: hakEdis,
            })
          })
        }
      }
    })

    // Hak ediş büyükten küçüğe sırala
    rows.sort((a, b) => b.hak_edis - a.hak_edis)

    console.log('✅ Toplam row sayısı:', rows.length)
    console.log('📊 İlk 3 row:', rows.slice(0, 3).map(r => ({
      merch: r.merch_adi,
      sube: r.sube_adi,
      cetinler: r.cetinler_merch,
      performans: r.kategori_performans,
    })))

    return NextResponse.json({ rows })
  } catch (e: unknown) {
    const err = e as Error
    console.error('Destek personel prim API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
