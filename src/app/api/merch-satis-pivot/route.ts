import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader, num, fetchPhpHtml } from '@/lib/merchSatis'

export interface PersonelSatisRow {
  personelAdi: string
  aylikAdet:   Record<number, number>
  toplam:      number
}

export interface SubeSatisRow {
  subeKod:    string
  subeAdi:    string
  personeller: PersonelSatisRow[]
}

export interface CariSatisRow {
  cariKod: string
  cariAdi: string
  subeler: SubeSatisRow[]
}

export interface MerchSatisPivotResponse {
  aylar:   number[]
  cariler: CariSatisRow[]
}

export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()

  const aylarParam = sp.get('aylar') || sp.get('ay') || String(new Date().getMonth() + 1)
  const aySet = new Set(
    aylarParam.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
  )

  const gruplarParam = sp.get('gruplar') || ''
  const grupSet = gruplarParam
    ? new Set(gruplarParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
    : null

  const bsyFilter = sp.get('bsy')?.trim() || ''

  // cariKod → subeKod → personelAdi → month → adet
  const dataMap = new Map<string, {
    cariAdi: string
    subeler: Map<string, {
      subeAdi:    string
      personeller: Map<string, Map<number, number>>
    }>
  }>()

  try {
    // fetchPhpHtml: paylaşımlı cache + tam UTF-8 decode
    const html = await fetchPhpHtml(
      'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php',
    )

    // Başlık ismine göre ayrıştır (kolon sırası değişse de bozulmaz)
    const { rows: rawRows } = parseHtmlTableByHeader(html)
    for (const r of rawRows) {
      const personelAdi = (r['MERCH_PERSONEL'] ?? '').trim()
      const cariIsim    = (r['CARI_ISIM'] ?? '').trim()
      const subeAdi     = (r['SUBE_ADI'] ?? '').trim()
      const adet        = num(r['SATILAN_ADET'])
      const grupKodu    = (r['GRUP_KODU'] ?? '').toUpperCase().trim()
      const cariKod     = (r['CARI_KOD'] ?? '').trim()
      const subeKod     = (r['SUBE_KOD'] ?? '').trim()
      const donem       = (r['DONEM'] ?? '').trim()   // "2026-07"
      const merchTipi   = (r['MERCH_TIPI'] ?? '').trim()
      const bsy         = (r['BSY'] ?? '').trim()

      if (merchTipi !== 'Çetinler Merch') continue
      if (!donem || !personelAdi || !cariKod) continue

      const [dyStr, dmStr] = donem.split('-')
      const donemYil = parseInt(dyStr)
      const donemAy  = parseInt(dmStr)
      if (donemYil !== yil || !aySet.has(donemAy)) continue
      if (grupSet && grupKodu && !grupSet.has(grupKodu)) continue
      if (bsyFilter && bsy !== bsyFilter) continue

      if (!dataMap.has(cariKod)) {
        dataMap.set(cariKod, { cariAdi: cariIsim, subeler: new Map() })
      }
      const cariEntry = dataMap.get(cariKod)!

      if (!cariEntry.subeler.has(subeKod)) {
        cariEntry.subeler.set(subeKod, { subeAdi, personeller: new Map() })
      }
      const subeEntry = cariEntry.subeler.get(subeKod)!

      if (!subeEntry.personeller.has(personelAdi)) {
        subeEntry.personeller.set(personelAdi, new Map())
      }
      const monthMap = subeEntry.personeller.get(personelAdi)!
      monthMap.set(donemAy, (monthMap.get(donemAy) ?? 0) + adet)
    }
  } catch (e) {
    console.warn('export_merch_satis fetch hatası:', e)
  }

  const cariler: CariSatisRow[] = []
  for (const [cariKod, cd] of dataMap.entries()) {
    const subeler: SubeSatisRow[] = []
    for (const [subeKod, sd] of cd.subeler.entries()) {
      const personeller: PersonelSatisRow[] = []
      for (const [personelAdi, monthMap] of sd.personeller.entries()) {
        const aylikAdet: Record<number, number> = {}
        let toplam = 0
        for (const [m, a] of monthMap.entries()) { aylikAdet[m] = a; toplam += a }
        personeller.push({ personelAdi, aylikAdet, toplam })
      }
      personeller.sort((a, b) => a.personelAdi.localeCompare(b.personelAdi, 'tr'))
      subeler.push({ subeKod, subeAdi: sd.subeAdi, personeller })
    }
    subeler.sort((a, b) => a.subeAdi.localeCompare(b.subeAdi, 'tr'))
    cariler.push({ cariKod, cariAdi: cd.cariAdi, subeler })
  }
  cariler.sort((a, b) => a.cariAdi.localeCompare(b.cariAdi, 'tr'))

  return NextResponse.json<MerchSatisPivotResponse>({
    aylar:   [...aySet].sort((a, b) => a - b),
    cariler,
  })
}
