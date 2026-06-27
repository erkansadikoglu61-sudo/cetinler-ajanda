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
  kategori_performans: number
  kosullu_destek_prim: number
  hak_edis: number
}

// Merch hedef takip verisini çek (kategori performansı)
async function fetchMerchPerformance(yil: number, ay: number): Promise<Map<string, number>> {
  try {
    const phpUrl = process.env.PHP_API_URL
    if (!phpUrl) return new Map()

    const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
    const response = await fetch(`${phpUrl}?${params}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) return new Map()

    const data = await response.json()
    if (!Array.isArray(data)) return new Map()

    // Merch adı → kategori gerçekleşme oranı (%)
    const map = new Map<string, number>()

    data.forEach((row: any) => {
      const merchAdi = String(row.merch_adi || row.merch || '').trim()
      const hedef = parseFloat(row.hedef || row.kategori_hedef || '0') || 0
      const gerceklesen = parseFloat(row.gerceklesen || row.kategori_gerceklesen || row.adet || '0') || 0

      if (merchAdi && hedef > 0) {
        const performans = (gerceklesen / hedef) * 100
        map.set(merchAdi.toLowerCase(), performans)
      }
    })

    return map
  } catch (error) {
    console.error('Merch performance fetch error:', error)
    return new Map()
  }
}

// Koşullu destek prim değerlerini çek (adet_prim tablosundan)
async function fetchKosulluDestekPrim(yil: number, ay: number): Promise<Map<string, number>> {
  try {
    const sb = getAdmin()
    const { data, error } = await sb
      .from('adet_prim')
      .select('stok_kodu, kosullu_destek')
      .eq('yil', yil)
      .eq('ay', ay)

    if (error || !data) return new Map()

    const map = new Map<string, number>()
    data.forEach((row: { stok_kodu: string; kosullu_destek: number | null }) => {
      if (row.kosullu_destek != null && row.kosullu_destek > 0) {
        map.set(row.stok_kodu, row.kosullu_destek)
      }
    })

    return map
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
        kategori_performans: 0,
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
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    })

    if (!selloutRes.ok) {
      console.warn('⚠️ PHP Sellout API error:', selloutRes.status)
      return NextResponse.json({ rows: [] })
    }

    const selloutData = await selloutRes.json()
    console.log('📊 Sellout data rows:', Array.isArray(selloutData) ? selloutData.length : 0)

    if (!Array.isArray(selloutData)) {
      console.warn('⚠️ Sellout data is not array')
      return NextResponse.json({ rows: [] })
    }

    // Şube + Cari → Çetinler Merch mapping (her şubede 1 merch)
    const subeCarimierchMap = new Map<string, string>()

    // Türkçe karakterleri normalize et
    const normalize = (str: string) => {
      return str
        .trim()
        .toLowerCase()
        .replace(/i̇/g, 'i')  // Türkçe İ → i
        .replace(/ı/g, 'i')   // Türkçe ı → i
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, ' ')  // Multiple spaces → tek space
    }

    selloutData.forEach((row: any) => {
      const subeAdi = String(row.sube_adi || row.sube || '').trim()
      const cariAdi = String(row.cari_adi || row.cari_isim || row.cari || '').trim()
      const merchAdi = String(row.merch_adi || row.merch_personel || row.merch || '').trim()
      const merchTipi = String(row.merch_tipi || '').trim()

      if (subeAdi && cariAdi && merchAdi && merchTipi === 'Çetinler Merch') {
        const key = `${normalize(subeAdi)}||${normalize(cariAdi)}`
        subeCarimierchMap.set(key, merchAdi)
      }
    })

    // 3. Merch performans verileri
    const merchPerformanceMap = await fetchMerchPerformance(yil, ay)

    // 4. Koşullu destek prim değerleri
    const kosulluDestekPrimMap = await fetchKosulluDestekPrim(yil, ay)

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

      // Merch performansı
      const performans = cetinlerMerch !== '-'
        ? merchPerformanceMap.get(cetinlerMerch.toLowerCase()) || 0
        : 0

      // Koşullu destek prim - ortalama al (tüm ürünlerin ortalaması)
      let avgPrim = 0
      if (kosulluDestekPrimMap.size > 0) {
        const primValues = Array.from(kosulluDestekPrimMap.values())
        avgPrim = primValues.reduce((sum, val) => sum + val, 0) / primValues.length
      }

      const hakEdis = (performans / 100) * avgPrim

      rows.push({
        merch_adi: dp.merch_adi,
        sube_adi: dp.sube_adi,
        cari_adi: dp.cari_adi,
        cetinler_merch: cetinlerMerch,
        kategori_performans: performans,
        kosullu_destek_prim: avgPrim,
        hak_edis: hakEdis,
      })
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
