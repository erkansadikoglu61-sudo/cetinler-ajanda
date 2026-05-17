import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { BSY_KOD_TO_NAME } from '@/lib/bsy'

const EXCEL_PATH =
  process.env.BSY_EXCEL_PATH ??
  path.join(process.env.HOME ?? '/Users/erkansadikoglu', 'Desktop/SAHA.xlsx')

const BUCKET   = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getExcelBuffer(): Promise<Buffer | null> {
  if (fs.existsSync(EXCEL_PATH)) return fs.readFileSync(EXCEL_PATH)
  try {
    const sb = getSupabase()
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch { return null }
}

export interface DashboardCiroRow {
  bsyAdi: string
  elux: number
  relux: number
  toplam: number
}

export interface DashboardCariRow {
  cariIsim: string
  ciro: number
  pay: number
}

export interface DashboardSellinBrand {
  elux: number
  relux: number
}

export interface DashboardTahsilat {
  hedef: number                          // Tahsilat Hedef Datası H sütunu toplamı
  byTur: { tur: string; tutar: number }[] // Gerçekleşen Tahsilat, döneme göre gruplu
  toplam: number                         // byTur toplamı
}

export interface DashboardResponse {
  gercCiro: DashboardCiroRow[]
  allCari: DashboardCariRow[]
  fatKesilenSayi: number
  sellinByBrand: DashboardSellinBrand
  tahsilat: DashboardTahsilat
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yil = searchParams.get('yil') ? parseInt(searchParams.get('yil')!) : null
  const ay  = searchParams.get('ay')  ? parseInt(searchParams.get('ay')!)  : null

  const buf = await getExcelBuffer()

  const emptyTahsilat: DashboardTahsilat = { hedef: 0, byTur: [], toplam: 0 }

  if (!buf) {
    return NextResponse.json<DashboardResponse>({
      gercCiro: [],
      allCari: [],
      fatKesilenSayi: 0,
      sellinByBrand: { elux: 0, relux: 0 },
      tahsilat: emptyTahsilat,
    })
  }

  try {
    const wb = XLSX.read(buf, { type: 'buffer', dense: true })
    const ws = wb.Sheets['Data']
    if (!ws) throw new Error('Data sayfası bulunamadı')

    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Geçerli BSY adları seti (AG kolonundaki Plasiyer Adı doğrulaması için)
    const BSY_NAMES = new Set(Object.values(BSY_KOD_TO_NAME))

    // Accumulators
    const gercMap    = new Map<string, { elux: number; relux: number }>()
    const cariMap    = new Map<string, number>()
    const fatCariSet = new Set<string>()
    let sellinElux   = 0
    let sellinRelux  = 0

    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]
      if (!r) continue

      const cariKod     = String(r[1]  ?? '').trim()
      const cariIsim    = String(r[2]  ?? '').trim()
      const tur         = String(r[10] ?? '').toUpperCase().trim()
      const rawNetTutar = typeof r[11] === 'number' ? r[11] : (parseFloat(String(r[11] ?? '').replace(',', '.')) || 0)
      const rawAdet     = typeof r[15] === 'number' ? r[15] : (parseFloat(String(r[15] ?? '').replace(',', '.')) || 0)
      const grupKodu    = String(r[17] ?? '').toUpperCase().trim()   // R kolonu = Grup
      const gc          = String(r[18] ?? '').toUpperCase().trim()
      const rowAy       = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
      const rowYil      = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
      const bsyAdi      = String(r[32] ?? '').trim()                // AG kolonu = Plasiyer Adı
      const stokRapKod3 = String(r[41] ?? '').toUpperCase().trim()

      if (stokRapKod3 === 'MERCHX') continue
      if (!rowYil || !rowAy) continue
      if (yil && rowYil !== yil) continue
      if (ay  && rowAy  !== ay)  continue
      if (!BSY_NAMES.has(bsyAdi)) continue

      const isElux  = grupKodu === 'EKEA'
      const isRelux = grupKodu === 'RELUX'
      if (!isElux && !isRelux) continue

      const isIade = tur.includes('IADE')
      const isGc   = gc === 'C'
      const isGg   = gc === 'G'
      if (!isGc && !isGg) continue

      const netTutar = (isIade || isGg) ? -Math.abs(rawNetTutar) : rawNetTutar
      const adet     = (isIade || isGg) ? -Math.abs(rawAdet)     : rawAdet

      const entry = gercMap.get(bsyAdi) ?? { elux: 0, relux: 0 }
      if (isElux)  entry.elux  += netTutar
      if (isRelux) entry.relux += netTutar
      gercMap.set(bsyAdi, entry)

      if (isElux)  sellinElux  += adet
      if (isRelux) sellinRelux += adet

      if (isGc && !isIade) {
        cariMap.set(cariIsim, (cariMap.get(cariIsim) ?? 0) + rawNetTutar)
        if (cariKod) fatCariSet.add(cariKod)
      }
    }

    // Build sorted ciro rows helper
    function buildRows(map: Map<string, { elux: number; relux: number }>): DashboardCiroRow[] {
      const rows: DashboardCiroRow[] = [...map.entries()]
        .map(([bsyAdi, v]) => ({ bsyAdi, elux: v.elux, relux: v.relux, toplam: v.elux + v.relux }))
        .sort((a, b) => a.bsyAdi.localeCompare(b.bsyAdi, 'tr'))

      if (rows.length > 0) {
        const totElux  = rows.reduce((s, r) => s + r.elux,  0)
        const totRelux = rows.reduce((s, r) => s + r.relux, 0)
        rows.push({ bsyAdi: 'TOPLAM', elux: totElux, relux: totRelux, toplam: totElux + totRelux })
      }

      return rows
    }

    // Tüm cari (büyükten küçüğe)
    const allCariEntries = [...cariMap.entries()].sort((a, b) => b[1] - a[1])
    const totalCiro = allCariEntries.reduce((s, [, v]) => s + v, 0)
    const allCari: DashboardCariRow[] = allCariEntries.map(([cariIsim, ciro]) => ({
      cariIsim,
      ciro,
      pay: totalCiro > 0 ? ciro / totalCiro : 0,
    }))

    // ── Tahsilat Hedef Datası ─────────────────────────────────────
    const wsHedef = wb.Sheets['Tahsilat Hedef Datası']
    let tahsilHedef = 0
    if (wsHedef) {
      const hedefRaw: unknown[][] = XLSX.utils.sheet_to_json(wsHedef, { header: 1, defval: null })
      for (let i = 1; i < hedefRaw.length; i++) {
        const r = hedefRaw[i]
        if (!r) continue
        // H sütunu (index 7) = Toplam
        const h = typeof r[7] === 'number' ? r[7] : parseFloat(String(r[7] ?? '0').replace(',', '.'))
        if (!isNaN(h)) tahsilHedef += h
      }
    }

    // ── Gerçekleşen Tahsilat ──────────────────────────────────────
    const wsGerc = wb.Sheets['Gerçekleşen Tahsilat']
    const turMap = new Map<string, number>()
    if (wsGerc) {
      const gercRaw: unknown[][] = XLSX.utils.sheet_to_json(wsGerc, { header: 1, defval: null })
      for (let i = 1; i < gercRaw.length; i++) {
        const r = gercRaw[i]
        if (!r) continue
        // G=Ay (index 6), H=Yıl (index 7), I=Tür (index 8), J=Tutar (index 9)
        const rowAyT  = typeof r[6] === 'number' ? r[6] : parseInt(String(r[6] ?? '0'))
        const rowYilT = typeof r[7] === 'number' ? r[7] : parseInt(String(r[7] ?? '0'))
        if (ay  && rowAyT  !== ay)  continue
        if (yil && rowYilT !== yil) continue
        const tur   = String(r[8] ?? '').trim()
        const tutar = typeof r[9] === 'number' ? r[9] : parseFloat(String(r[9] ?? '0').replace(',', '.'))
        if (!tur || tur === 'Tür' || isNaN(tutar)) continue
        turMap.set(tur, (turMap.get(tur) ?? 0) + tutar)
      }
    }

    const byTur = [...turMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tur, tutar]) => ({ tur, tutar }))
    const tahsilToplam = byTur.reduce((s, r) => s + r.tutar, 0)

    return NextResponse.json<DashboardResponse>({
      gercCiro:      buildRows(gercMap),
      allCari,
      fatKesilenSayi: fatCariSet.size,
      sellinByBrand: { elux: sellinElux, relux: sellinRelux },
      tahsilat: { hedef: tahsilHedef, byTur, toplam: tahsilToplam },
    })
  } catch (err) {
    console.error('[dashboard] Excel okuma hatası:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
