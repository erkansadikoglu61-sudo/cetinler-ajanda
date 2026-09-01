import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import {
  GRUP_TO_BRAND, BSY_KOD_TO_NAME, PRIM_EXCLUDED_BSYS,
  calcTieredPrimBsy, DEFAULT_BSY_PARAMS, type BsyParams,
} from '@/lib/bsy'

export const maxDuration = 60

// BSY prim hakedişini (Ciro ve Tahsilat sayfasındaki "Hakedilen Prim" ile
// aynı mantık) bir yılın 12 ayı için tek Excel okumasıyla hesaplar.
//   ay ≥ 5 → parametrik kademeli motor (calcTieredPrimBsy, tahsilat çarpanı dahil)
//   ay < 5 → bsy_kisi_hedef.hakedilen_prim (DB'deki manuel değer)

const EXCEL_PATH =
  process.env.BSY_EXCEL_PATH ??
  path.join(process.env.HOME ?? '/Users/erkansadikoglu', 'Desktop/SAHA.xlsx')

const BUCKET = 'bsy-excel'
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

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
  return 0
}

const lc = (s: string) => s.toLocaleLowerCase('tr')

export interface NihaiPrimBsyRow {
  bsyAdi: string
  aylar: Record<number, number>
}

export async function GET(req: Request) {
  const yil = parseInt(new URL(req.url).searchParams.get('yil') ?? String(new Date().getFullYear()))

  const sb = getSupabase()

  // ── Paralel: Excel + Supabase (kisi hedef, parametreler, bsy profilleri) ──
  const [buf, kisiRes, paramRes, profRes] = await Promise.all([
    getExcelBuffer(),
    sb.from('bsy_kisi_hedef').select('*').eq('yil', yil),
    sb.from('bsy_parametreler').select('*'),
    sb.from('profiles').select('full_name').eq('role', 'bsy').order('full_name'),
  ])

  if (!buf) return NextResponse.json<{ rows: NihaiPrimBsyRow[] }>({ rows: [] })

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })

  // ── 1. BSY ciro: (ay, bsyAdiLower) → { elx, relux } ──
  const ciro = new Map<string, { elx: number; relux: number }>()
  const ckey = (ay: number, adiLower: string) => `${ay}||${adiLower}`
  const dataWs = wb.Sheets['Data']
  if (dataWs) {
    const raw: unknown[][] = XLSX.utils.sheet_to_json(dataWs, { header: 1, defval: null })
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]
      if (!r) continue
      const grupKodu     = String(r[16] ?? '').toUpperCase().trim()
      const gc           = String(r[18] ?? '').toUpperCase().trim()
      const tur          = String(r[10] ?? '').toUpperCase().trim()
      const netTutar     = typeof r[11] === 'number' ? r[11] : (parseFloat(String(r[11] ?? '').replace(',', '.')) || 0)
      const rowYil       = typeof r[21] === 'number' ? r[21] : parseInt(String(r[21] ?? '0'))
      const rowAy        = typeof r[20] === 'number' ? r[20] : parseInt(String(r[20] ?? '0'))
      const plasiyerKodu = String(r[31] ?? '').trim()
      if (!plasiyerKodu || !grupKodu || !rowYil || !rowAy) continue
      if (rowYil !== yil) continue
      const bsyAdi = BSY_KOD_TO_NAME[plasiyerKodu]
      if (!bsyAdi) continue
      if (gc !== 'C' && gc !== 'G') continue
      const brand = GRUP_TO_BRAND[grupKodu]
      if (brand !== 'ELECTROLUX' && brand !== 'RELUX') continue
      const tutar = tur.includes('IADE') ? -Math.abs(netTutar) : netTutar
      const k = ckey(rowAy, lc(bsyAdi))
      const cur = ciro.get(k) ?? { elx: 0, relux: 0 }
      if (brand === 'ELECTROLUX') cur.elx += tutar
      else cur.relux += tutar
      ciro.set(k, cur)
    }
  }

  // ── 2. Tahsilat oranı: (ay, bsyAdiLower) → oran(%) ──
  // açıkHesap (Tahsilat_Hedef_Datası, Plasiyer Kodu → BSY kodu, Toplam) → hedef = açık × 0.9
  // gerçekleşen (Gerçekleşen Tahsilat, Tutar) → oran = gerç / hedef × 100
  const acik = new Map<string, number>()   // key: `${ay}||${kod}`
  const gerc = new Map<string, number>()   // key: `${ay}||${bsyAdiLower}`
  const normHeader = (h: unknown) => String(h ?? '').trim().toLowerCase()
    .replace(/i̇/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/_/g, '').replace(/\s/g, '')

  const hedefWs = wb.Sheets['Tahsilat_Hedef_Datası']
  if (hedefWs) {
    const raw: unknown[][] = XLSX.utils.sheet_to_json(hedefWs, { header: 1, defval: null })
    let ayC = -1, yilC = -1, plasC = -1, topC = -1
    if (raw.length > 0) {
      const hdr = raw[0] as unknown[]
      for (let c = 0; c < hdr.length; c++) {
        const h = normHeader(hdr[c])
        if (h === 'ay') ayC = c
        if (h === 'yil') yilC = c
        if (h.includes('plasiyer') && h.includes('kod')) plasC = c
        if (h === 'toplam') topC = c
      }
    }
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]; if (!r) continue
      const plasiyerKod = plasC >= 0 ? String(r[plasC] ?? '').trim() : ''
      const kod = plasiyerKod ? plasiyerKod.split('/')[0].trim().toUpperCase() : ''
      if (!kod) continue
      if (yilC >= 0) { const ry = typeof r[yilC] === 'number' ? r[yilC] as number : parseInt(String(r[yilC] ?? '0')); if (ry !== yil) continue }
      const ay = ayC >= 0 ? (typeof r[ayC] === 'number' ? r[ayC] as number : parseInt(String(r[ayC] ?? '0'))) : 0
      if (!ay) continue
      const toplam = topC >= 0 ? toNum(r[topC]) : 0
      const k = `${ay}||${kod}`
      acik.set(k, (acik.get(k) ?? 0) + toplam)
    }
  }

  const gercWs = wb.Sheets['Gerçekleşen Tahsilat']
  if (gercWs) {
    const raw: unknown[][] = XLSX.utils.sheet_to_json(gercWs, { header: 1, defval: null })
    let ayC = -1, yilC = -1, plasC = -1, tutC = -1
    if (raw.length > 0) {
      const hdr = raw[0] as unknown[]
      for (let c = 0; c < hdr.length; c++) {
        const h = normHeader(hdr[c])
        if (h.includes('plasiyer') && h.includes('kod')) plasC = c
        if (h === 'ay') ayC = c
        if (h === 'yil') yilC = c
        if (h.includes('tutar')) tutC = c
      }
    }
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]; if (!r) continue
      const plasiyerKod = plasC >= 0 ? String(r[plasC] ?? '').trim() : ''
      const kod = plasiyerKod ? plasiyerKod.split('/')[0].trim().toUpperCase() : ''
      const bsyAdi = kod ? (BSY_KOD_TO_NAME[kod] || kod) : ''
      if (!bsyAdi) continue
      if (yilC >= 0) { const ry = typeof r[yilC] === 'number' ? r[yilC] as number : parseInt(String(r[yilC] ?? '0')); if (ry !== yil) continue }
      const ay = ayC >= 0 ? (typeof r[ayC] === 'number' ? r[ayC] as number : parseInt(String(r[ayC] ?? '0'))) : 0
      if (!ay) continue
      const tutar = tutC >= 0 ? toNum(r[tutC]) : 0
      const k = `${ay}||${lc(bsyAdi)}`
      gerc.set(k, (gerc.get(k) ?? 0) + tutar)
    }
  }

  const tahsilatOran = (ay: number, bsyAdi: string): number => {
    const kod = Object.entries(BSY_KOD_TO_NAME).find(([, n]) => lc(n) === lc(bsyAdi))?.[0] ?? ''
    const acikH = acik.get(`${ay}||${kod}`) ?? 0
    const hedef = acikH * 0.9
    const g = gerc.get(`${ay}||${lc(bsyAdi)}`) ?? 0
    return hedef > 0 ? (g / hedef) * 100 : 0
  }

  // ── 3. Kişi hedef: (ay, bsyAdiLower, brand) → { hedefCiro, hakedilenPrim } ──
  const kisi = new Map<string, { hedefCiro: number; hakedilenPrim: number | null }>()
  for (const row of (kisiRes.data ?? [])) {
    const k = `${row.ay}||${lc(String(row.bsy_adi ?? ''))}||${row.brand}`
    kisi.set(k, { hedefCiro: (row.hedef_ciro as number) ?? 0, hakedilenPrim: (row.hakedilen_prim as number | null) ?? null })
  }
  const getKisi = (ay: number, bsyAdi: string, brand: string) =>
    kisi.get(`${ay}||${lc(bsyAdi)}||${brand}`) ?? { hedefCiro: 0, hakedilenPrim: null }

  // ── 4. Parametreler ──
  const params: BsyParams = { ...DEFAULT_BSY_PARAMS }
  for (const row of (paramRes.data ?? [])) {
    if (row.key != null) params[row.key as string] = row.value as number
  }

  // ── 5. BSY listesi (profiles) ──
  const bsyAdlar: string[] = (profRes.data ?? []).map((p: { full_name: string }) => p.full_name)
  const isExcluded = (bsyAdi: string) =>
    PRIM_EXCLUDED_BSYS.some(n => lc(bsyAdi) === lc(n))

  // ── 6. Her ay için prim ──
  const rows: NihaiPrimBsyRow[] = bsyAdlar.map(bsyAdi => ({ bsyAdi, aylar: {} as Record<number, number> }))

  for (let ay = 1; ay <= 12; ay++) {
    // Şirket toplamı (bu ay) — mergedRows = tüm BSY profilleri
    let compGerc = 0, compHedef = 0
    for (const bsyAdi of bsyAdlar) {
      const c = ciro.get(ckey(ay, lc(bsyAdi))) ?? { elx: 0, relux: 0 }
      compGerc += c.elx + c.relux
      compHedef += getKisi(ay, bsyAdi, 'ELECTROLUX').hedefCiro + getKisi(ay, bsyAdi, 'RELUX').hedefCiro
    }

    for (const row of rows) {
      const bsyAdi = row.bsyAdi
      const excluded = isExcluded(bsyAdi)
      const c = ciro.get(ckey(ay, lc(bsyAdi))) ?? { elx: 0, relux: 0 }
      const elxK = getKisi(ay, bsyAdi, 'ELECTROLUX')
      const reluxK = getKisi(ay, bsyAdi, 'RELUX')

      let prim = 0
      if (ay >= 5) {
        prim = calcTieredPrimBsy(
          c.elx, elxK.hedefCiro,
          c.relux, reluxK.hedefCiro,
          compGerc, compHedef,
          tahsilatOran(ay, bsyAdi), params, excluded,
        ).topPrim
      } else {
        prim = excluded ? 0 : ((elxK.hakedilenPrim ?? 0) + (reluxK.hakedilenPrim ?? 0))
      }
      row.aylar[ay] = prim
    }
  }

  return NextResponse.json<{ rows: NihaiPrimBsyRow[] }>({ rows })
}
