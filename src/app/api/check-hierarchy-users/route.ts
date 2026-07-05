import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as XLSX from 'xlsx'

const EXCEL_PATH = '/Users/erkansadikoglu/Desktop/Saha Ajandası/cetinler-ajanda/SAHA.xlsx'
const BUCKET = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

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

async function getExcelBuffer(): Promise<Buffer | null> {
  if (fs.existsSync(EXCEL_PATH)) {
    return fs.readFileSync(EXCEL_PATH)
  }
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET() {
  try {
    // 1. PHP'den Sellout hiyerarşisini çek
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
    const selloutRows: any[] = []
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

      selloutRows.push({
        bsy_kod: cells[16] || '',
        supervisor: cells[9] || '',
        sv_tipi: cells[15] || '',
      })
    }

    // 2. Excel'den BSY isimlerini çek
    const excelBuffer = await getExcelBuffer()
    if (!excelBuffer) {
      return NextResponse.json({ error: 'Excel file not found' }, { status: 500 })
    }

    const wb = XLSX.read(excelBuffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    if (rawData.length < 2) {
      return NextResponse.json({ error: 'Excel is empty' }, { status: 500 })
    }

    // Header mapping
    const headerRow = rawData[0]
    const cols: { [key: string]: number } = {}

    headerRow.forEach((h: any, c: number) => {
      const hs = String(h ?? '').toLowerCase().trim()
      if (hs.includes('plasiyer') && hs.includes('ad')) cols['bsyAdi'] = c
      if (hs.includes('plasiyer') && hs.includes('kod')) cols['bsyKod'] = c
    })

    // BSY Kod -> İsim mapping
    const bsyKodToIsim = new Map<string, string>()

    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r]
      if (!row || row.length === 0) continue

      const bsyKod = cols['bsyKod'] >= 0 ? String(row[cols['bsyKod']] ?? '').trim() : ''
      const bsyAdi = cols['bsyAdi'] >= 0 ? String(row[cols['bsyAdi']] ?? '').trim() : ''

      if (bsyKod && bsyAdi && !bsyKodToIsim.has(bsyKod)) {
        bsyKodToIsim.set(bsyKod, bsyAdi)
      }
    }

    // 3. Hiyerarşi oluştur
    const hierarchyMap = new Map<string, Map<string, Set<string>>>()

    selloutRows.forEach(row => {
      const bsyKod = row.bsy_kod || 'Bilinmeyen'
      const supervisor = row.supervisor || 'Bilinmeyen Supervisor'
      const svTipi = row.sv_tipi || ''

      if (!hierarchyMap.has(bsyKod)) {
        hierarchyMap.set(bsyKod, new Map())
      }

      const bsyData = hierarchyMap.get(bsyKod)!
      if (!bsyData.has(supervisor)) {
        bsyData.set(supervisor, new Set())
      }

      if (svTipi) {
        bsyData.get(supervisor)!.add(svTipi)
      }
    })

    // 4. Sonucu formatla
    const hierarchy: Array<{
      bsy_kod: string
      bsy_isim: string
      supervisors: Array<{
        name: string
        sv_tipleri: string[]
      }>
    }> = []

    for (const [bsyKod, supervisors] of hierarchyMap.entries()) {
      const bsyIsim = bsyKodToIsim.get(bsyKod) || 'İsim Bulunamadı'

      const supList: Array<{ name: string; sv_tipleri: string[] }> = []

      for (const [supName, svTipleri] of supervisors.entries()) {
        supList.push({
          name: supName,
          sv_tipleri: Array.from(svTipleri).sort((a, b) => a.localeCompare(b, 'tr'))
        })
      }

      hierarchy.push({
        bsy_kod: bsyKod,
        bsy_isim: bsyIsim,
        supervisors: supList.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      })
    }

    // BSY ismine göre sırala
    const sorted = hierarchy.sort((a, b) => a.bsy_isim.localeCompare(b.bsy_isim, 'tr'))

    return NextResponse.json({
      hierarchy: sorted,
      totalBsy: hierarchyMap.size,
      totalSupervisors: Array.from(hierarchyMap.values()).reduce((sum, sups) => sum + sups.size, 0),
      bsyMapping: Object.fromEntries(bsyKodToIsim)
    })
  } catch (error) {
    console.error('Hierarchy check error:', error)
    return NextResponse.json({ error: 'Failed to fetch hierarchy' }, { status: 500 })
  }
}
