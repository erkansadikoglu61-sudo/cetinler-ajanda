import { NextResponse } from 'next/server'

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

      if (cells.length < 17) continue

      // cells[16] = BSY, cells[9] = Supervisor, cells[15] = SV_TIPI
      rows.push({
        bsy: cells[16] || '',
        supervisor: cells[9] || '',
        sv_tipi: cells[15] || '',
      })
    }

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
