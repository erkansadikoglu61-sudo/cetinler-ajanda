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
  } catch { return null }
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(',', '.')) || 0
  return 0
}

export interface TahsilatRow {
  bsyAdi:       string
  acikHesap:    number
  hedef:        number
  gerceklesen:  number
  oran:         number
}

// Cari bazında ay+tip detay satırı
export interface TahsilatDetayRow {
  bsyAdi:      string
  cariIsim:    string
  ay:          number
  tur:         string   // tahsilat tipi (ör: NORMAL, İCRA, vb.)
  acikHesap:   number   // cari bazında açık hesap (hedef datası'ndan)
  gerceklesen: number
}

export interface TahsilatResponse {
  rows:  TahsilatRow[]
  detay: TahsilatDetayRow[]
}

export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay  = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1

  const buf = await getExcelBuffer()
  if (!buf) return NextResponse.json<TahsilatResponse>({ rows: [], detay: [] })

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })

  // ── 1. Tahsilat Hedef Datası ────────────────────────────────────
  // Kolon: [0]CariKod [1]GrupKodu [2]CariIsim [3]Aciklama
  //        [4]PlasiyerKodu [5]Önceki [6]Tutar [7]Toplam
  const hedefSheet = wb.Sheets['Tahsilat Hedef Datası']
  const hedefRaw: unknown[][] = hedefSheet
    ? XLSX.utils.sheet_to_json(hedefSheet, { header: 1, defval: null })
    : []

  // "Ay" sütun indeksini bul
  let hedefAyCol = -1
  if (hedefRaw.length > 0) {
    const header = hedefRaw[0] as unknown[]
    for (let c = 0; c < header.length; c++) {
      if (String(header[c] ?? '').trim().toLowerCase() === 'ay') { hedefAyCol = c; break }
    }
  }

  // BSY kodu → BSY toplam açık hesap
  const acikHesapMap = new Map<string, number>()
  // (bsyKod + cariIsim) → cari bazında açık hesap (detay için)
  const cariAcikMap  = new Map<string, number>()   // key: `${bsyKod}||${cariIsim}`

  for (let i = 1; i < hedefRaw.length; i++) {
    const r = hedefRaw[i]
    if (!r) continue
    const bsyKod   = String(r[1] ?? '').trim().toUpperCase()
    const cariIsim = String(r[2] ?? '').trim()
    if (!bsyKod) continue
    if (hedefAyCol >= 0) {
      const rowAy = typeof r[hedefAyCol] === 'number' ? r[hedefAyCol] : parseInt(String(r[hedefAyCol] ?? '0'))
      if (rowAy !== ay) continue
    }
    const toplam = toNum(r[7])
    acikHesapMap.set(bsyKod, (acikHesapMap.get(bsyKod) ?? 0) + toplam)
    if (cariIsim) {
      const ck = `${bsyKod}||${cariIsim}`
      cariAcikMap.set(ck, (cariAcikMap.get(ck) ?? 0) + toplam)
    }
  }

  // ── 2. Gerçekleşen Tahsilat ─────────────────────────────────────
  // Kolon: [0]BSY [1]CariKod [2]CariIsim [3]KayitTarihi
  //        [4]TahsilatVadesi [5]KayitliVade [6]Ay [7]Yil [8]Tur [9]Tutar
  const gercSheet = wb.Sheets['Gerçekleşen Tahsilat']
  const gercRaw: unknown[][] = gercSheet
    ? XLSX.utils.sheet_to_json(gercSheet, { header: 1, defval: null })
    : []

  // BSY → toplam (özet için)
  const gercMap = new Map<string, number>()
  // BSY + cariIsim + ay + tur → tutar (detay için)
  const detayMap = new Map<string, TahsilatDetayRow>()

  for (let i = 1; i < gercRaw.length; i++) {
    const r = gercRaw[i]
    if (!r) continue
    const bsyAdi   = String(r[0] ?? '').trim()
    const cariIsim = String(r[2] ?? '').trim()
    const rowAy    = typeof r[6] === 'number' ? r[6] : parseInt(String(r[6] ?? '0'))
    const rowYil   = typeof r[7] === 'number' ? r[7] : parseInt(String(r[7] ?? '0'))
    const tur      = String(r[8] ?? '').trim()
    if (!bsyAdi || rowYil !== yil) continue
    const tutar = toNum(r[9])

    // Özet: sadece seçili ay
    if (rowAy === ay) {
      gercMap.set(bsyAdi, (gercMap.get(bsyAdi) ?? 0) + tutar)
    }

    // Detay: seçili ay'ın verileri
    if (rowAy === ay && cariIsim) {
      const dk = `${bsyAdi}||${cariIsim}||${rowAy}||${tur}`
      const cur = detayMap.get(dk) ?? { bsyAdi, cariIsim, ay: rowAy, tur, acikHesap: 0, gerceklesen: 0 }
      cur.gerceklesen += tutar
      detayMap.set(dk, cur)
    }
  }

  // Detay satırlarına cari bazında açık hesap ekle
  // BSY adını koda çevirip cariAcikMap'ten al
  const bsyNameToKod = Object.fromEntries(
    Object.entries(BSY_KOD_TO_NAME).map(([k, v]) => [v.toLocaleLowerCase('tr'), k])
  )
  const detayRows: TahsilatDetayRow[] = [...detayMap.values()].map(row => {
    const kod = bsyNameToKod[row.bsyAdi.toLocaleLowerCase('tr')] ?? ''
    const ck  = `${kod}||${row.cariIsim}`
    return { ...row, acikHesap: cariAcikMap.get(ck) ?? 0 }
  }).sort((a, b) => a.bsyAdi.localeCompare(b.bsyAdi, 'tr') || a.cariIsim.localeCompare(b.cariIsim, 'tr') || a.ay - b.ay)

  // ── 3. Özet satırları ────────────────────────────────────────────
  const rows: TahsilatRow[] = []
  for (const [kod, bsyAdi] of Object.entries(BSY_KOD_TO_NAME)) {
    const acikHesap   = acikHesapMap.get(kod) ?? 0
    const hedef       = acikHesap * 0.9
    const gerceklesen = gercMap.get(bsyAdi) ?? 0
    const oran        = hedef > 0 ? (gerceklesen / hedef) * 100 : 0
    rows.push({ bsyAdi, acikHesap, hedef, gerceklesen, oran })
  }
  const filtered = rows.filter(r => r.acikHesap > 0 || r.gerceklesen > 0)
  filtered.sort((a, b) => b.gerceklesen - a.gerceklesen)

  return NextResponse.json<TahsilatResponse>({ rows: filtered, detay: detayRows })
}
