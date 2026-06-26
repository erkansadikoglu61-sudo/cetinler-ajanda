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

async function getExcelBuffer(): Promise<{ buffer: Buffer; mtime: Date } | null> {
  if (fs.existsSync(EXCEL_PATH)) {
    const stats = fs.statSync(EXCEL_PATH)
    return { buffer: fs.readFileSync(EXCEL_PATH), mtime: stats.mtime }
  }
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!
    )
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) return null
    return { buffer: Buffer.from(await data.arrayBuffer()), mtime: new Date() }
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
  // Excel son güncelleme zamanı
  excelGuncellemeZamani: string // ISO 8601 format

  // Toplam metrikler
  yillikCiro: number
  yillikCiroHedef: number // 2026 hedefi
  aylikCiro: number
  aylikCiroHedef: number // Aylık hedef

  // Grup bazında cirolar
  yillikCiroGrup: {
    relux: number
    ekea: number
    ebe: number
  }
  aylikCiroGrup: {
    relux: number
    ekea: number
    ebe: number
  }

  // Cari sayıları - Grup bazında
  yillikCariSayisi: {
    relux: number
    electrolux: number
    toplam: number
  }
  aylikCariSayisi: {
    relux: number
    electrolux: number
    toplam: number
  }

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

  // Supabase'den aylık ciro hedefini çek (BSY Hedef Girişi toplamı)
  let aylikCiroHedef = 0
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await sb
      .from('bsy_kisi_hedef')
      .select('hedef_ciro')
      .eq('yil', yil)
      .eq('ay', ay)

    if (!error && data) {
      aylikCiroHedef = data.reduce((sum, row) => sum + (row.hedef_ciro || 0), 0)
      console.log(`📊 Aylık Ciro Hedefi (${yil}/${ay}):`, aylikCiroHedef, '(BSY Hedef Girişi toplamı)')
    }
  } catch (e) {
    console.warn('⚠️ Aylık ciro hedefi alınamadı:', e)
  }

  const result = await getExcelBuffer()
  if (!result) {
    return NextResponse.json<DashboardSalesMetrics>({
      excelGuncellemeZamani: new Date().toISOString(),
      yillikCiro: 0,
      yillikCiroHedef: 610_000_000,
      aylikCiro: 0,
      aylikCiroHedef,
      yillikCiroGrup: { relux: 0, ekea: 0, ebe: 0 },
      aylikCiroGrup: { relux: 0, ekea: 0, ebe: 0 },
      yillikCariSayisi: { relux: 0, electrolux: 0, toplam: 0 },
      aylikCariSayisi: { relux: 0, electrolux: 0, toplam: 0 },
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

  const { buffer: buf, mtime: excelMtime } = result
  const wb = XLSX.read(buf, { type: 'buffer', dense: true })
  const sheet = wb.Sheets['Data']
  if (!sheet) {
    return NextResponse.json({ error: 'Data sayfası bulunamadı' }, { status: 404 })
  }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  console.log(`📊 Excel toplam satır sayısı: ${raw.length}`)

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

    if (h === 'cari kod') cols['cariKod'] = c // Tam eşitlik - "Cari Kod 1" vb ile karışmasın
    if (h.includes('cari') && h.includes('isim')) cols['cariIsim'] = c
    if (h.includes('plasiyer') && h.includes('ad')) cols['bsyAdi'] = c // Plasiyer Adı = BSY
    if (h.includes('grup') && h.includes('kod')) cols['grup'] = c // Grup Kodu kolonu (EKEA, RELUX)
    if (h === 'yil' || h === 'yıl') cols['yil'] = c
    if (h === 'ay') cols['ay'] = c
    if (h.includes('net') && h.includes('tutar')) cols['netTutar'] = c
  }

  console.log('📊 Dashboard Sales - Kolonlar:', cols)
  console.log('📊 Grup kolonu index:', cols['grup'], '(16 olmalı)')
  if (cols['grup'] < 0 || cols['grup'] === undefined) {
    console.error('❌ GRUP KOLONU BULUNAMADI!')
  }

  // Verileri topla
  const yillikData: Array<{ cariKod: string; cariIsim: string; bsyAdi: string; grup: string; netTutar: number }> = []
  const aylikData: Array<{ cariKod: string; cariIsim: string; bsyAdi: string; grup: string; netTutar: number }> = []

  // Müşteri bazında toplam ciro hesaplama için Map'ler
  const yillikCariCiroMap = new Map<string, { toplam: number; relux: number; ekea: number }>()
  const aylikCariCiroMap = new Map<string, { toplam: number; relux: number; ekea: number }>()

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

    // İlk 5 satırı logla
    if (debugCount < 5 && rowYil === yil && netTutar > 0) {
      console.log(`  Satır ${i}:`, {
        cariKod,
        cariIsim: cariIsim.substring(0, 20),
        bsyAdi,
        grup,
        grupUpper: grup.toUpperCase(),
        isRelux: grup === 'RELUX',
        isEkea: grup === 'EKEA',
        netTutar
      })
      debugCount++
    }

    if (!cariKod) continue

    // Yıllık (2026)
    if (rowYil === yil) {
      // Her satırı topla
      yillikData.push({ cariKod, cariIsim, bsyAdi, grup, netTutar })

      // Müşteri bazında toplam ciro hesapla (M ile başlayanlar)
      if (cariKod.toUpperCase().startsWith('M')) {
        if (!yillikCariCiroMap.has(cariKod)) {
          yillikCariCiroMap.set(cariKod, { toplam: 0, relux: 0, ekea: 0 })
        }
        const entry = yillikCariCiroMap.get(cariKod)!
        entry.toplam += netTutar
        if (grup === 'RELUX') entry.relux += netTutar
        else if (grup === 'EKEA') entry.ekea += netTutar
      }
    }

    // Aylık
    if (rowYil === yil && rowAy === ay) {
      aylikData.push({ cariKod, cariIsim, bsyAdi, grup, netTutar })

      // Müşteri bazında toplam ciro hesapla (M ile başlayanlar)
      if (cariKod.toUpperCase().startsWith('M')) {
        if (!aylikCariCiroMap.has(cariKod)) {
          aylikCariCiroMap.set(cariKod, { toplam: 0, relux: 0, ekea: 0 })
        }
        const entry = aylikCariCiroMap.get(cariKod)!
        entry.toplam += netTutar
        if (grup === 'RELUX') entry.relux += netTutar
        else if (grup === 'EKEA') entry.ekea += netTutar
      }
    }
  }

  // Müşteri sayısını hesapla (filtre yok - sadece M-prefix ve grup kontrolü)
  const yillikCariReluxSet = new Set<string>()
  const yillikCariElectroluxSet = new Set<string>()
  const yillikCariToplamSet = new Set<string>()

  for (const [cariKod, ciro] of yillikCariCiroMap.entries()) {
    yillikCariToplamSet.add(cariKod)
    if (ciro.relux !== 0) yillikCariReluxSet.add(cariKod)
    if (ciro.ekea !== 0) yillikCariElectroluxSet.add(cariKod)
  }

  const aylikCariReluxSet = new Set<string>()
  const aylikCariElectroluxSet = new Set<string>()
  const aylikCariToplamSet = new Set<string>()

  for (const [cariKod, ciro] of aylikCariCiroMap.entries()) {
    aylikCariToplamSet.add(cariKod)
    if (ciro.relux !== 0) aylikCariReluxSet.add(cariKod)
    if (ciro.ekea !== 0) aylikCariElectroluxSet.add(cariKod)
  }

  // === METRIKLER ===
  const yillikCiro = yillikData.reduce((sum, d) => sum + d.netTutar, 0)
  const aylikCiro = aylikData.reduce((sum, d) => sum + d.netTutar, 0)

  // Grup bazında cirolar
  const yillikCiroGrup = {
    relux: yillikData.filter(d => d.grup === 'RELUX').reduce((sum, d) => sum + d.netTutar, 0),
    ekea: yillikData.filter(d => d.grup === 'EKEA').reduce((sum, d) => sum + d.netTutar, 0),
    ebe: yillikData.filter(d => d.grup === 'EBE').reduce((sum, d) => sum + d.netTutar, 0),
  }

  const aylikCiroGrup = {
    relux: aylikData.filter(d => d.grup === 'RELUX').reduce((sum, d) => sum + d.netTutar, 0),
    ekea: aylikData.filter(d => d.grup === 'EKEA').reduce((sum, d) => sum + d.netTutar, 0),
    ebe: aylikData.filter(d => d.grup === 'EBE').reduce((sum, d) => sum + d.netTutar, 0),
  }

  const yillikCariSayisi = {
    relux: yillikCariReluxSet.size,
    electrolux: yillikCariElectroluxSet.size,
    toplam: yillikCariToplamSet.size,
  }

  const aylikCariSayisi = {
    relux: aylikCariReluxSet.size,
    electrolux: aylikCariElectroluxSet.size,
    toplam: aylikCariToplamSet.size,
  }

  console.log('📊 Cari Sayıları:', {
    yillik: yillikCariSayisi,
    aylik: aylikCariSayisi,
    yillikDataCount: yillikData.length,
    aylikDataCount: aylikData.length,
    yillikReluxSample: Array.from(yillikCariReluxSet).slice(0, 3),
    yillikElectroluxSample: Array.from(yillikCariElectroluxSet).slice(0, 3),
    yillikToplamSample: Array.from(yillikCariToplamSet).slice(0, 3),
  })

  // === BSY SIRALAMA ===
  function calculateBsySiralama(data: typeof yillikData) {
    const bsyMap = new Map<string, { relux: number; ekea: number; toplam: number }>()

    data.forEach(d => {
      if (!bsyMap.has(d.bsyAdi)) {
        bsyMap.set(d.bsyAdi, { relux: 0, ekea: 0, toplam: 0 })
      }
      const entry = bsyMap.get(d.bsyAdi)!
      entry.toplam += d.netTutar

      if (d.grup === 'RELUX') {
        entry.relux += d.netTutar
      } else if (d.grup === 'EKEA') {
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
      .filter(d => !grupFilter || d.grup === grupFilter)
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

  // Hedefler
  const yillikCiroHedef = 610_000_000
  // aylikCiroHedef yukarıda Supabase'den çekildi

  const result: DashboardSalesMetrics = {
    excelGuncellemeZamani: excelMtime.toISOString(),
    yillikCiro,
    yillikCiroHedef,
    aylikCiro,
    aylikCiroHedef,
    yillikCiroGrup,
    aylikCiroGrup,
    yillikCariSayisi,
    aylikCariSayisi,

    yillikBsySiralama: calculateBsySiralama(yillikData),
    aylikBsySiralama: calculateBsySiralama(aylikData),

    yillikCariReluxTop10: calculateCariTop10(yillikData, 'RELUX'),
    yillikCariEkeaTop10: calculateCariTop10(yillikData, 'EKEA'),
    yillikCariToplamTop10: calculateCariTop10(yillikData),

    aylikCariReluxTop10: calculateCariTop10(aylikData, 'RELUX'),
    aylikCariEkeaTop10: calculateCariTop10(aylikData, 'EKEA'),
    aylikCariToplamTop10: calculateCariTop10(aylikData),
  }

  return NextResponse.json(result)
}
