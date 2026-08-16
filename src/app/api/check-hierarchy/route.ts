import { NextResponse } from 'next/server'
import { parseHtmlTableByHeader } from '@/lib/merchSatis'

export async function GET() {
  try {
    const phpUrl = process.env.PHP_API_URL
    if (!phpUrl) {
      return NextResponse.json({ error: 'PHP_API_URL not configured' }, { status: 500 })
    }

    const params = new URLSearchParams({ yil: '2026' })
    const response = await fetch(`${phpUrl}?${params}`)

    if (!response.ok) {
      return NextResponse.json({ error: `PHP API returned ${response.status}` }, { status: 500 })
    }

    const htmlText = await response.text()
    // Başlık ismine göre ayrıştır (kolon sırası değişse de bozulmaz)
    const { rows: rawRows } = parseHtmlTableByHeader(htmlText)
    const rows = rawRows.map(r => ({
      bsy: r['BSY'] || '',
      supervisor: r['SUPERVISOR_ADI'] || '',
      sv_tipi: r['SV_TIPI'] || '',
    }))

    // Hiyerarşi oluştur
    const hierarchyMap = new Map<string, Map<string, Set<string>>>()

    rows.forEach(row => {
      const bsy = row.bsy || 'Bilinmeyen BSY'
      const supervisor = row.supervisor || 'Bilinmeyen Supervisor'
      const svTipi = row.sv_tipi || ''

      if (!hierarchyMap.has(bsy)) {
        hierarchyMap.set(bsy, new Map())
      }

      const bsyData = hierarchyMap.get(bsy)!
      if (!bsyData.has(supervisor)) {
        bsyData.set(supervisor, new Set())
      }

      if (svTipi) {
        bsyData.get(supervisor)!.add(svTipi)
      }
    })

    // Map'i serialize edilebilir formata çevir
    const hierarchy: Array<{
      bsy: string
      supervisors: Array<{
        name: string
        sv_tipleri: string[]
      }>
    }> = []

    for (const [bsy, supervisors] of hierarchyMap.entries()) {
      const supList: Array<{ name: string; sv_tipleri: string[] }> = []

      for (const [supName, svTipleri] of supervisors.entries()) {
        supList.push({
          name: supName,
          sv_tipleri: Array.from(svTipleri).sort((a, b) => a.localeCompare(b, 'tr'))
        })
      }

      hierarchy.push({
        bsy,
        supervisors: supList.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      })
    }

    return NextResponse.json({
      hierarchy: hierarchy.sort((a, b) => a.bsy.localeCompare(b.bsy, 'tr')),
      totalBsy: hierarchyMap.size,
      totalSupervisors: Array.from(hierarchyMap.values()).reduce((sum, sups) => sum + sups.size, 0)
    })
  } catch (error) {
    console.error('Hierarchy check error:', error)
    return NextResponse.json({ error: 'Failed to fetch hierarchy' }, { status: 500 })
  }
}
