import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const EXCEL_PATH =
  process.env.BSY_EXCEL_PATH ??
  path.join(process.env.HOME ?? '/Users/erkansadikoglu', 'Desktop/SAHA.xlsx')

const BUCKET = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

async function getExcelBuffer(): Promise<Buffer | null> {
  if (fs.existsSync(EXCEL_PATH)) return fs.readFileSync(EXCEL_PATH)
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

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(',', '.')) || 0
  return 0
}

export interface DashboardSalesMetrics {
  // Toplam metrikler
  yillikCiro: number
  aylikCiro: number
  yillikCariSayisi: number
  aylikCariSayisi: number

  // BSY sıralamaları
  yillikBsySiralama: Array<{
    bsyAdi: string
    relux: number
    ekea: number
    toplam: number
    oran: number // Toplam içindeki pay
  }>
  aylikBsySiralama: Array<{
    bsyAdi: string
    relux: number
    ekea: number
    toplam: number
    oran: number
  }>

  // Cari top 10'lar
  yillikCariReluxTop10: Array<{ cariAdi: string; tutar: number; oran: number }>
  yillikCariEkeaTop10: Array<{ cariAdi: string; tutar: number; oran: number }>
  yillikCariToplamTop10: Array<{ cariAdi: string; tutar: number; oran: number }>

  aylikCariReluxTop10: Array<{ cariAdi: string; tutar: number; oran: number }>
  aylikCariEkeaTop10: Array<{ cariAdi: string; tutar: number; oran: number }>
  aylikCariToplamTop10: Array<{ cariAdi: string; tutar: number; oran: number }>
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : 2026
  const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : new Date().getMonth() + 1

  const buf = await getExcelBuffer()
  if (!buf) {
    return NextResponse.json<DashboardSalesMetrics>({
      yillikCiro: 0,
      aylikCiro: 0,
      yillikCariSayisi: 0,
      aylikCariSayisi: 0,
      yillikBsySiralama: [],
      aylikBsySiralama: [],
      yillikCariReluxTop10: [],
      yillikCariEkeaTop10: [],
      yillikCariToplamTop10: [],
      aylikCariReluxTop10: [],
      aylikCariEkeaTop10: [],
      aylikCariToplamTop10: [],
    })
  }

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })
  const sheet = wb.Sheets['Data']
  if (!sheet) {
    return NextResponse.json({ error: 'Data sayfası bulunamadı' }, { status: 404 })
  }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  if (raw.length < 2) {
    return NextResponse.json({ error: 'Data boş' }, { status: 404 })
  }

  // Header'dan kolonları bul
  const header = raw[0] as unknown[]
  const cols: Record<string, number> = {}
  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] ?? '')
      .trim()
      .toLowerCase()
      .replace(/i̇/g, 'i') // Türkçe İ → i
      .replace(/ı/g, 'i')  // Türkçe ı → i
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')

    if (h.includes('cari') && h.includes('kod') && !h.includes('kod 1')) cols['cariKod'] = c
    if (h.includes('cari') && h.includes('isim')) cols['cariIsim'] = c
    if (h.includes('plasiyer') && h.includes('ad')) cols['bsyAdi'] = c // Plasiyer Adı = BSY
    if (h === 'grup') cols['grup'] = c
    if (h === 'yil' || h === 'yıl') cols['yil'] = c
    if (h === 'ay') cols['ay'] = c
    if (h.includes('net') && h.includes('tutar')) cols['netTutar'] = c
  }

  console.log('📊 Dashboard Sales - Kolonlar:', cols)

  // Verileri topla
  const yillikData: Array<{ cariKod: string; cariIsim: string; bsyAdi: string; grup: string; netTutar: number }> = []
  const aylikData: Array<{ cariKod: string; cariIsim: string; bsyAdi: string; grup: string; netTutar: number }> = []

  // Farklı cari sayıları için Set'ler (satış yapılan cariler - fatura kesilmiş)
  const yillikCariSet = new Set<string>()
  const aylikCariSet = new Set<string>()

  let debugCount = 0
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const rowYil = cols['yil'] >= 0 ? toNum(r[cols['yil']]) : 0
    const rowAy = cols['ay'] >= 0 ? toNum(r[cols['ay']]) : 0
    const cariKod = cols['cariKod'] >= 0 ? String(r[cols['cariKod']] ?? '').trim() : ''
    const cariIsim = cols['cariIsim'] >= 0 ? String(r[cols['cariIsim']] ?? '').trim() : ''
    const bsyAdi = cols['bsyAdi'] >= 0 ? String(r[cols['bsyAdi']] ?? '').trim() : ''
    const grup = cols['grup'] >= 0 ? String(r[cols['grup']] ?? '').trim().toUpperCase() : ''
    const netTutar = cols['netTutar'] >= 0 ? toNum(r[cols['netTutar']]) : 0

    // İlk 3 satırı logla
    if (debugCount < 3 && rowYil === yil && netTutar !== 0) {
      console.log(`  Satır ${i}:`, { cariKod, cariIsim: cariIsim.substring(0, 20), bsyAdi, grup, netTutar })
      debugCount++
    }

    if (!cariKod) continue

    // Yıllık (2026) - satış yapılan cariler (fatura kesilen)
    if (rowYil === yil) {
      yillikCariSet.add(cariKod)

      // Ciro hesabı için sadece netTutar > 0 olanlar
      if (netTutar !== 0) {
        yillikData.push({ cariKod, cariIsim, bsyAdi, grup, netTutar })
      }
    }

    // Aylık - satış yapılan cariler (fatura kesilen)
    if (rowYil === yil && rowAy === ay) {
      aylikCariSet.add(cariKod)

      // Ciro hesabı için sadece netTutar > 0 olanlar
      if (netTutar !== 0) {
        aylikData.push({ cariKod, cariIsim, bsyAdi, grup, netTutar })
      }
    }
  }

  // === METRIKLER ===
  const yillikCiro = yillikData.reduce((sum, d) => sum + d.netTutar, 0)
  const aylikCiro = aylikData.reduce((sum, d) => sum + d.netTutar, 0)

  // === BSY SIRALAMA ===
  function calculateBsySiralama(data: typeof yillikData) {
    const bsyMap = new Map<string, { relux: number; ekea: number; toplam: number }>()

    data.forEach(d => {
      if (!bsyMap.has(d.bsyAdi)) {
        bsyMap.set(d.bsyAdi, { relux: 0, ekea: 0, toplam: 0 })
      }
      const entry = bsyMap.get(d.bsyAdi)!
      entry.toplam += d.netTutar

      if (d.grup === 'RELUX' || d.grup.includes('RELUX')) {
        entry.relux += d.netTutar
      } else if (d.grup === 'EKEA' || d.grup.includes('ELECTROLUX')) {
        entry.ekea += d.netTutar
      }
    })

    const toplamCiro = Array.from(bsyMap.values()).reduce((sum, v) => sum + v.toplam, 0)

    return Array.from(bsyMap.entries())
      .map(([bsyAdi, values]) => ({
        bsyAdi,
        relux: values.relux,
        ekea: values.ekea,
        toplam: values.toplam,
        oran: toplamCiro > 0 ? values.toplam / toplamCiro : 0,
      }))
      .sort((a, b) => b.toplam - a.toplam)
  }

  // === CARI TOP 10 ===
  function calculateCariTop10(data: typeof yillikData, grupFilter?: string) {
    const cariMap = new Map<string, { cariIsim: string; tutar: number }>()

    data
      .filter(d => !grupFilter || d.grup === grupFilter || d.grup.includes(grupFilter))
      .forEach(d => {
        if (!cariMap.has(d.cariKod)) {
          cariMap.set(d.cariKod, { cariIsim: d.cariIsim, tutar: 0 })
        }
        cariMap.get(d.cariKod)!.tutar += d.netTutar
      })

    const toplamCiro = Array.from(cariMap.values()).reduce((sum, v) => sum + v.tutar, 0)

    return Array.from(cariMap.values())
      .map(({ cariIsim, tutar }) => ({
        cariAdi: cariIsim,
        tutar,
        oran: toplamCiro > 0 ? tutar / toplamCiro : 0,
      }))
      .sort((a, b) => b.tutar - a.tutar)
      .slice(0, 10)
  }

  const result: DashboardSalesMetrics = {
    yillikCiro,
    aylikCiro,
    yillikCariSayisi: yillikCariSet.size,
    aylikCariSayisi: aylikCariSet.size,

    yillikBsySiralama: calculateBsySiralama(yillikData),
    aylikBsySiralama: calculateBsySiralama(aylikData),

    yillikCariReluxTop10: calculateCariTop10(yillikData, 'RELUX'),
    yillikCariEkeaTop10: calculateCariTop10(yillikData, 'ELECTROLUX'),
    yillikCariToplamTop10: calculateCariTop10(yillikData),

    aylikCariReluxTop10: calculateCariTop10(aylikData, 'RELUX'),
    aylikCariEkeaTop10: calculateCariTop10(aylikData, 'ELECTROLUX'),
    aylikCariToplamTop10: calculateCariTop10(aylikData),
  }

  return NextResponse.json(result)
}
