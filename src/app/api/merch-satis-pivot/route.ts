import { NextResponse } from 'next/server'

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

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
    const phpRes = await fetch(
      'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php',
      { next: { revalidate: 900 } }
    )
    const html = await phpRes.text()

    const trMatches = html.match(/<tr>[\s\S]*?<\/tr>/gi) || []
    for (let i = 1; i < trMatches.length; i++) {
      const tdMatches = trMatches[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []
      if (tdMatches.length < 15) continue
      const c = tdMatches.map(td => decodeHtml(td.replace(/<\/?td[^>]*>/gi, '')))

      const personelAdi = c[0]?.trim()  || ''
      const cariIsim    = c[1]?.trim()  || ''
      const subeAdi     = c[2]?.trim()  || ''
      const adet        = parseFloat(c[6] || '0') || 0
      const grupKodu    = (c[7] || '').toUpperCase().trim()
      const cariKod     = c[10]?.trim() || ''
      const subeKod     = c[11]?.trim() || ''
      const donem       = c[12]?.trim() || ''   // "2026-07"
      const merchTipi   = c[14]?.trim() || ''
      const bsy         = c[16]?.trim() || ''

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
