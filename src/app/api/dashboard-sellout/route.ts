import { NextResponse } from 'next/server'

export interface DashboardSelloutMetrics {
  // Yıllık (aylikAdet eklendi)
  yillikCariTop10: Array<{ cariAdi: string; adet: number; pay: number; aylikAdet: number }>
  yillikSubeTop10: Array<{ subeAdi: string; adet: number; pay: number; topCari?: string; aylikAdet: number }>
  yillikSupervizorler: Array<{ supervizorAdi: string; adet: number; pay: number; topCari?: string; aylikAdet: number }>
  yillikCetinlerMerchTop10: Array<{ merchAdi: string; adet: number; pay: number; topCari?: string; aylikAdet: number }>
  yillikBayiMerchTop10: Array<{ merchAdi: string; adet: number; pay: number; topCari?: string; aylikAdet: number }>

  // Aylık
  aylikCariTop10: Array<{ cariAdi: string; adet: number; pay: number }>
  aylikSubeTop10: Array<{ subeAdi: string; adet: number; pay: number; topCari?: string }>
  aylikSupervizorler: Array<{ supervizorAdi: string; adet: number; pay: number; topCari?: string }>
  aylikCetinlerMerchTop10: Array<{ merchAdi: string; adet: number; pay: number; topCari?: string }>
  aylikBayiMerchTop10: Array<{ merchAdi: string; adet: number; pay: number; topCari?: string }>
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

async function fetchPhpSellout(yil: number, ay?: number): Promise<any[]> {
  try {
    const phpUrl = process.env.PHP_API_URL
    if (!phpUrl) {
      console.warn('⚠️ PHP_API_URL not configured, returning empty sellout data')
      return []
    }

    // PHP'ye sadece yıl parametresi gönder, ay filtrelemesini Next.js tarafında yap
    const params = new URLSearchParams({ yil: String(yil) })

    const response = await fetch(`${phpUrl}?${params}`, {
      redirect: 'follow',  // Redirect'leri takip et
      next: { revalidate: 900 }, // 15 dakika cache
    })

    if (!response.ok) {
      console.warn(`⚠️ PHP Sellout API returned ${response.status}`)
      return []
    }

    const htmlText = await response.text()

    // HTML table parse et
    // Format: <tr><td>...</td><td>CARI</td><td>SUBE</td><td>...</td><td>MERCH</td><td>ADET</td>...</tr>
    const rows: any[] = []
    const parts = htmlText.split('</tr>')
    const tdRe = /<td[^>]*>(.*?)<\/td>/g

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      if (!part.includes('<td')) continue

      const cells: string[] = []
      let m: RegExpExecArray | null
      tdRe.lastIndex = 0
      while ((m = tdRe.exec(part)) !== null) {
        cells.push(decodeHtml(m[1]))
      }

      if (cells.length < 15) continue

      // Column indices (bayi-merch-prim route'undan)
      // 0:MERCH_PERSONEL 1:CARI_ISIM 2:SUBE_ADI 3:STOK_ADI 4:STOK_KODU
      // 5:GRUP_ACIKLAMA  6:SATILAN_ADET 7:GRUP_KODU 8:BEKLENEN_CIRO
      // 9:SUPERVISOR_ADI 10:CARI_KOD 11:SUBE_KOD 12:DONEM 13:TARIH
      // 14:MERCH_TIPI ("Bayi Merch" | "Çetinler Merch") 15:SV_TIPI 16:BSY

      const donem = cells[12].trim()
      const tarih = cells[13].trim()

      // Ay filtresi varsa kontrol et
      if (ay) {
        // DONEM formatını esnek parse et
        // Olası formatlar: "2026-06", "06-2026", "06", "2026/06", etc.
        let donemAy: number | null = null

        if (donem.includes('-')) {
          const parts = donem.split('-')
          // "2026-06" formatı
          if (parts[0].length === 4) {
            donemAy = parseInt(parts[1])
          }
          // "06-2026" formatı
          else if (parts[1].length === 4) {
            donemAy = parseInt(parts[0])
          }
        } else if (donem.includes('/')) {
          const parts = donem.split('/')
          // "2026/06" formatı
          if (parts[0].length === 4) {
            donemAy = parseInt(parts[1])
          }
          // "06/2026" formatı
          else if (parts[1].length === 4) {
            donemAy = parseInt(parts[0])
          }
        } else if (donem.length <= 2) {
          // Sadece "06" veya "6" formatı
          donemAy = parseInt(donem)
        }

        // Eğer ay uyuşmuyorsa atla
        if (donemAy !== null && donemAy !== ay) {
          continue
        }
        // Eğer donem parse edilemezse tarih kolonunu kontrol et
        else if (donemAy === null && tarih) {
          let tarihAy: number | null = null

          if (tarih.includes('.')) {
            // DD.MM.YYYY formatı
            const parts = tarih.split('.')
            if (parts.length === 3) {
              tarihAy = parseInt(parts[1])
            }
          } else if (tarih.includes('-')) {
            // YYYY-MM-DD formatı
            const parts = tarih.split('-')
            if (parts.length === 3) {
              tarihAy = parseInt(parts[1])
            }
          } else if (tarih.includes('/')) {
            // DD/MM/YYYY veya YYYY/MM/DD formatı
            const parts = tarih.split('/')
            if (parts.length === 3) {
              // YYYY/MM/DD
              if (parts[0].length === 4) {
                tarihAy = parseInt(parts[1])
              }
              // DD/MM/YYYY
              else {
                tarihAy = parseInt(parts[1])
              }
            }
          }

          // Tarihten de ay bulunamadıysa veya uyuşmuyorsa atla
          if (tarihAy === null || tarihAy !== ay) {
            continue
          }
        }
      }

      rows.push({
        merch_adi: cells[0],
        cari_adi: cells[1],
        cari_kod: cells[10],
        sube_adi: cells[2],
        stok_adi: cells[3],
        stok_kodu: cells[4],
        grup_aciklama: cells[5],
        adet: parseFloat(cells[6]) || 0,
        grup_kodu: cells[7],
        supervizor: cells[9],
        donem: donem,
        tarih: tarih,
        merch_tipi: cells[14],
      })
    }

    return rows
  } catch (error) {
    console.error('❌ PHP Sellout fetch error:', error)
    return []
  }
}

// Cari ismini kısalt (ilk kelime)
function shortenCari(cari: string): string {
  const words = cari.split(' ')
  return words[0] || cari
}

function calculateTop10(
  data: any[],
  groupBy: 'cari' | 'sube' | 'supervizor' | 'cetinler_merch' | 'bayi_merch',
  returnAll: boolean = false
): Array<{ name: string; adet: number; pay: number; topCari?: string }> {
  const map = new Map<string, number>()
  // Her grup için cari bazında adet toplama
  const cariByGroup = new Map<string, Map<string, number>>()

  data.forEach(row => {
    let key = ''
    const adet = row.adet || 0
    const cari = row.cari_adi || ''
    const cariKod = row.cari_kod || ''

    switch (groupBy) {
      case 'cari':
        key = cari
        break
      case 'sube':
        // Şube + cari_kod kombinasyonu (aynı şube adı farklı carilerde olabilir)
        const subeAdi = row.sube_adi || ''
        key = subeAdi ? `${subeAdi}|${cariKod}` : ''
        break
      case 'supervizor':
        key = row.supervizor || ''
        break
      case 'cetinler_merch':
        // Çetinler Merch filtrele
        if (row.merch_tipi === 'Çetinler Merch') {
          key = row.merch_adi || ''
        }
        break
      case 'bayi_merch':
        // Bayi Merch filtrele
        if (row.merch_tipi === 'Bayi Merch') {
          key = row.merch_adi || ''
        }
        break
    }

    if (key && adet > 0) {
      map.set(key, (map.get(key) || 0) + adet)

      // Cari tracking (cari dışındaki gruplar için)
      if (groupBy !== 'cari' && cari) {
        if (!cariByGroup.has(key)) {
          cariByGroup.set(key, new Map())
        }
        const cariMap = cariByGroup.get(key)!
        cariMap.set(cari, (cariMap.get(cari) || 0) + adet)
      }
    }
  })

  const toplamAdet = Array.from(map.values()).reduce((sum, val) => sum + val, 0)

  return Array.from(map.entries())
    .map(([name, adet]) => {
      // Şube için "şube|cariKod" formatını parse et
      let displayName = name
      if (groupBy === 'sube' && name.includes('|')) {
        displayName = name.split('|')[0]
      }

      // En çok satan cari'yi bul
      let topCari: string | undefined
      if (groupBy !== 'cari') {
        const cariMap = cariByGroup.get(name)
        if (cariMap && cariMap.size > 0) {
          const sorted = Array.from(cariMap.entries()).sort((a, b) => b[1] - a[1])
          topCari = shortenCari(sorted[0][0])
        }
      }

      return {
        name: displayName,
        adet,
        pay: toplamAdet > 0 ? adet / toplamAdet : 0,
        topCari,
      }
    })
    .sort((a, b) => b.adet - a.adet)

  // returnAll true ise tümünü döndür, değilse top 10
  return returnAll ? result : result.slice(0, 10)
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : 2026
  const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : new Date().getMonth() + 1

  console.log(`\n🚀 Dashboard Sellout API çağrıldı - Yıl: ${yil}, Ay: ${ay}`)

  // Yıllık ve aylık verileri al
  const [yillikData, aylikData] = await Promise.all([
    fetchPhpSellout(yil),
    fetchPhpSellout(yil, ay),
  ])

  console.log(`📊 Toplam kayıt - Yıllık: ${yillikData.length}, Aylık: ${aylikData.length}`)

  // Debug: Senet Sepet kontrolü
  const senetSepetYillik = yillikData.filter(x => x.cari_adi?.includes('SENET SEPET'))
  const senetSepetAylik = aylikData.filter(x => x.cari_adi?.includes('SENET SEPET'))

  console.log(`🔍 SENET SEPET - Yıllık kayıt: ${senetSepetYillik.length}, Aylık kayıt: ${senetSepetAylik.length}`)

  if (senetSepetAylik.length > 0) {
    const toplamAdet = senetSepetAylik.reduce((sum, x) => sum + x.adet, 0)
    console.log(`✅ SENET SEPET Aylık Toplam Adet: ${toplamAdet}`)
    console.log(`📝 İlk kayıt:`, senetSepetAylik[0])
  } else {
    console.log(`❌ SENET SEPET için ${ay}. ayda kayıt bulunamadı`)
    if (senetSepetYillik.length > 0) {
      console.log(`📝 Yıllık ilk kayıt:`, senetSepetYillik[0])
    }
  }

  // Yıllık top 10'ları hesapla
  const yillikCariRaw = calculateTop10(yillikData, 'cari')
  const yillikSubeRaw = calculateTop10(yillikData, 'sube')
  const yillikSupervizorRaw = calculateTop10(yillikData, 'supervizor')
  const yillikCetinlerMerchRaw = calculateTop10(yillikData, 'cetinler_merch')
  const yillikBayiMerchRaw = calculateTop10(yillikData, 'bayi_merch')

  // Aylık verilerin tamamını hesapla (sadece top 10 değil)
  const aylikCariAll = calculateTop10(aylikData, 'cari', true) // true = tüm sonuçlar
  const aylikSubeAll = calculateTop10(aylikData, 'sube', true)
  const aylikSupervizorAll = calculateTop10(aylikData, 'supervizor', true)
  const aylikCetinlerMerchAll = calculateTop10(aylikData, 'cetinler_merch', true)
  const aylikBayiMerchAll = calculateTop10(aylikData, 'bayi_merch', true)

  // Yıllık top 10 için aylık karşılıklarını bul
  const addAylikAdet = (yillikList: any[], aylikList: any[], nameKey: string) => {
    return yillikList.map(yillik => {
      const aylikMatch = aylikList.find(a => a.name === yillik.name)
      return {
        ...yillik,
        aylikAdet: aylikMatch?.adet || 0
      }
    })
  }

  const result: DashboardSelloutMetrics = {
    // Yıllık (aylık adet bilgisi eklenmiş)
    yillikCariTop10: addAylikAdet(yillikCariRaw, aylikCariAll, 'name').map(x => ({
      cariAdi: x.name, adet: x.adet, pay: x.pay, aylikAdet: x.aylikAdet
    })),
    yillikSubeTop10: addAylikAdet(yillikSubeRaw, aylikSubeAll, 'name').map(x => ({
      subeAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari, aylikAdet: x.aylikAdet
    })),
    yillikSupervizorler: addAylikAdet(yillikSupervizorRaw, aylikSupervizorAll, 'name').map(x => ({
      supervizorAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari, aylikAdet: x.aylikAdet
    })),
    yillikCetinlerMerchTop10: addAylikAdet(yillikCetinlerMerchRaw, aylikCetinlerMerchAll, 'name').map(x => ({
      merchAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari, aylikAdet: x.aylikAdet
    })),
    yillikBayiMerchTop10: addAylikAdet(yillikBayiMerchRaw, aylikBayiMerchAll, 'name').map(x => ({
      merchAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari, aylikAdet: x.aylikAdet
    })),

    // Aylık top 10 (eski hali)
    aylikCariTop10: aylikCariAll.slice(0, 10).map(x => ({ cariAdi: x.name, adet: x.adet, pay: x.pay })),
    aylikSubeTop10: aylikSubeAll.slice(0, 10).map(x => ({ subeAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari })),
    aylikSupervizorler: aylikSupervizorAll.slice(0, 10).map(x => ({ supervizorAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari })),
    aylikCetinlerMerchTop10: aylikCetinlerMerchAll.slice(0, 10).map(x => ({ merchAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari })),
    aylikBayiMerchTop10: aylikBayiMerchAll.slice(0, 10).map(x => ({ merchAdi: x.name, adet: x.adet, pay: x.pay, topCari: x.topCari })),
  }

  return NextResponse.json(result)
}
