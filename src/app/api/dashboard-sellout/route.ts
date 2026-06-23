import { NextResponse } from 'next/server'

export interface DashboardSelloutMetrics {
  // Yıllık
  yillikCariTop10: Array<{ cariAdi: string; adet: number; pay: number }>
  yillikSubeTop10: Array<{ subeAdi: string; adet: number; pay: number }>
  yillikSupervizorler: Array<{ supervizorAdi: string; adet: number; pay: number }>
  yillikCetinlerMerchTop10: Array<{ merchAdi: string; adet: number; pay: number }>
  yillikBayiMerchTop10: Array<{ merchAdi: string; adet: number; pay: number }>

  // Aylık
  aylikCariTop10: Array<{ cariAdi: string; adet: number; pay: number }>
  aylikSubeTop10: Array<{ subeAdi: string; adet: number; pay: number }>
  aylikSupervizorler: Array<{ supervizorAdi: string; adet: number; pay: number }>
  aylikCetinlerMerchTop10: Array<{ merchAdi: string; adet: number; pay: number }>
  aylikBayiMerchTop10: Array<{ merchAdi: string; adet: number; pay: number }>
}

async function fetchPhpSellout(yil: number, ay?: number): Promise<any[]> {
  try {
    const phpUrl = process.env.PHP_API_URL || 'https://cetinler.net/api/sellout.php'
    const params = new URLSearchParams({ yil: String(yil) })
    if (ay) params.append('ay', String(ay))

    const response = await fetch(`${phpUrl}?${params}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }, // 5 dakika cache
    })

    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('PHP Sellout fetch error:', error)
    return []
  }
}

function calculateTop10(
  data: any[],
  groupBy: 'cari' | 'sube' | 'supervizor' | 'cetinler_merch' | 'bayi_merch'
): Array<{ name: string; adet: number; pay: number }> {
  const map = new Map<string, number>()

  data.forEach(row => {
    let key = ''
    // Adet için farklı alan isimleri dene
    const adet = parseInt(
      row.adet || row.toplam_adet || row.Adet || row.ADET || row.miktar || '0'
    ) || 0

    switch (groupBy) {
      case 'cari':
        key = String(
          row.cari_adi || row.cari || row.CariAdi || row.Cari || row.musteri || row.Müşteri || ''
        ).trim()
        break
      case 'sube':
        key = String(
          row.sube_adi || row.sube || row.SubeAdi || row.Sube || row.SUBE || ''
        ).trim()
        break
      case 'supervizor':
        key = String(
          row.supervizor || row.supervisor || row.Supervizor || row.Supervisor ||
          row.supervizor_adi || row.SupervizorAdi || ''
        ).trim()
        break
      case 'cetinler_merch':
        // Çetinler çalışanı olan merch'leri filtrele
        const isCetinler =
          row.merch_tipi === 'cetinler' || row.merch_tipi === 'Çetinler' ||
          row.is_cetinler === '1' || row.is_cetinler === 1 ||
          row.IsCetinler === '1' || row.IsCetinler === 1
        if (isCetinler) {
          key = String(
            row.merch_adi || row.merch || row.MerchAdi || row.Merch ||
            row.merchandiser || row.Merchandiser || ''
          ).trim()
        }
        break
      case 'bayi_merch':
        // Bayi merch'lerini filtrele
        const isBayi =
          row.merch_tipi === 'bayi' || row.merch_tipi === 'Bayi' ||
          row.is_bayi === '1' || row.is_bayi === 1 ||
          row.IsBayi === '1' || row.IsBayi === 1
        if (isBayi) {
          key = String(
            row.merch_adi || row.merch || row.MerchAdi || row.Merch ||
            row.merchandiser || row.Merchandiser || ''
          ).trim()
        }
        break
    }

    if (key && adet > 0) {
      map.set(key, (map.get(key) || 0) + adet)
    }
  })

  const toplamAdet = Array.from(map.values()).reduce((sum, val) => sum + val, 0)

  return Array.from(map.entries())
    .map(([name, adet]) => ({
      name,
      adet,
      pay: toplamAdet > 0 ? adet / toplamAdet : 0,
    }))
    .sort((a, b) => b.adet - a.adet)
    .slice(0, 10)
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : 2026
  const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : new Date().getMonth() + 1

  // Yıllık ve aylık verileri al
  const [yillikData, aylikData] = await Promise.all([
    fetchPhpSellout(yil),
    fetchPhpSellout(yil, ay),
  ])

  const result: DashboardSelloutMetrics = {
    // Yıllık
    yillikCariTop10: calculateTop10(yillikData, 'cari').map(x => ({ cariAdi: x.name, adet: x.adet, pay: x.pay })),
    yillikSubeTop10: calculateTop10(yillikData, 'sube').map(x => ({ subeAdi: x.name, adet: x.adet, pay: x.pay })),
    yillikSupervizorler: calculateTop10(yillikData, 'supervizor').map(x => ({ supervizorAdi: x.name, adet: x.adet, pay: x.pay })),
    yillikCetinlerMerchTop10: calculateTop10(yillikData, 'cetinler_merch').map(x => ({ merchAdi: x.name, adet: x.adet, pay: x.pay })),
    yillikBayiMerchTop10: calculateTop10(yillikData, 'bayi_merch').map(x => ({ merchAdi: x.name, adet: x.adet, pay: x.pay })),

    // Aylık
    aylikCariTop10: calculateTop10(aylikData, 'cari').map(x => ({ cariAdi: x.name, adet: x.adet, pay: x.pay })),
    aylikSubeTop10: calculateTop10(aylikData, 'sube').map(x => ({ subeAdi: x.name, adet: x.adet, pay: x.pay })),
    aylikSupervizorler: calculateTop10(aylikData, 'supervizor').map(x => ({ supervizorAdi: x.name, adet: x.adet, pay: x.pay })),
    aylikCetinlerMerchTop10: calculateTop10(aylikData, 'cetinler_merch').map(x => ({ merchAdi: x.name, adet: x.adet, pay: x.pay })),
    aylikBayiMerchTop10: calculateTop10(aylikData, 'bayi_merch').map(x => ({ merchAdi: x.name, adet: x.adet, pay: x.pay })),
  }

  return NextResponse.json(result)
}
