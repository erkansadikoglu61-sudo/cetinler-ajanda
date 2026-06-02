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
  acikHesap:    number   // Toplam (önceki ay açık hesap)
  hedef:        number   // acikHesap * 0.90
  gerceklesen:  number
  oran:         number   // gerceklesen / hedef * 100
}

export interface TahsilatResponse {
  rows: TahsilatRow[]
}

export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay  = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1

  const buf = await getExcelBuffer()
  if (!buf) return NextResponse.json<TahsilatResponse>({ rows: [] })

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })

  // ── 1. Tahsilat Hedef Datası ────────────────────────────────────
  // Kolon: [0]CariKod [1]GrupKodu [2]CariIsim [3]Aciklama
  //        [4]PlasiyerKodu [5]Önceki [6]Tutar [7]Toplam
  const hedefSheet = wb.Sheets['Tahsilat Hedef Datası']
  const hedefRaw: unknown[][] = hedefSheet
    ? XLSX.utils.sheet_to_json(hedefSheet, { header: 1, defval: null })
    : []

  // Dinamik olarak "Ay" sütun indeksini bul (başlık satırında arar)
  let hedefAyCol = -1
  if (hedefRaw.length > 0) {
    const header = hedefRaw[0] as unknown[]
    for (let c = 0; c < header.length; c++) {
      if (String(header[c] ?? '').trim().toLowerCase() === 'ay') {
        hedefAyCol = c
        break
      }
    }
  }

  // BSY kodu → açık hesap toplamı (Toplam sütunu, col 7)
  const acikHesapMap = new Map<string, number>()
  for (let i = 1; i < hedefRaw.length; i++) {
    const r = hedefRaw[i]
    if (!r) continue
    const bsyKod = String(r[1] ?? '').trim().toUpperCase()
    if (!bsyKod) continue
    // Eğer "Ay" sütunu varsa o aya ait satırları filtrele
    if (hedefAyCol >= 0) {
      const rowAy = typeof r[hedefAyCol] === 'number' ? r[hedefAyCol] : parseInt(String(r[hedefAyCol] ?? '0'))
      if (rowAy !== ay) continue
    }
    const toplam = toNum(r[7])
    acikHesapMap.set(bsyKod, (acikHesapMap.get(bsyKod) ?? 0) + toplam)
  }

  // ── 2. Gerçekleşen Tahsilat ─────────────────────────────────────
  // Kolon: [0]BSY [1]CariKod [2]CariIsim [3]KayitTarihi
  //        [4]TahsilatVadesi [5]KayitliVade [6]Ay [7]Yil [8]Tur [9]Tutar
  const gercSheet = wb.Sheets['Gerçekleşen Tahsilat']
  const gercRaw: unknown[][] = gercSheet
    ? XLSX.utils.sheet_to_json(gercSheet, { header: 1, defval: null })
    : []

  // BSY adı → gerçekleşen tahsilat (filtrelenmiş ay+yıl)
  const gercMap = new Map<string, number>()
  for (let i = 1; i < gercRaw.length; i++) {
    const r = gercRaw[i]
    if (!r) continue
    const bsyAdi = String(r[0] ?? '').trim()
    const rowAy  = typeof r[6] === 'number' ? r[6] : parseInt(String(r[6] ?? '0'))
    const rowYil = typeof r[7] === 'number' ? r[7] : parseInt(String(r[7] ?? '0'))
    if (!bsyAdi || rowAy !== ay || rowYil !== yil) continue
    const tutar = toNum(r[9])
    gercMap.set(bsyAdi, (gercMap.get(bsyAdi) ?? 0) + tutar)
  }

  // ── 3. Birleştir ────────────────────────────────────────────────
  const rows: TahsilatRow[] = []

  // BSY_KOD_TO_NAME içindeki tüm BSY'leri dahil et
  for (const [kod, bsyAdi] of Object.entries(BSY_KOD_TO_NAME)) {
    const acikHesap   = acikHesapMap.get(kod) ?? 0
    const hedef       = acikHesap * 0.9
    const gerceklesen = gercMap.get(bsyAdi) ?? 0
    const oran        = hedef > 0 ? (gerceklesen / hedef) * 100 : 0
    rows.push({ bsyAdi, acikHesap, hedef, gerceklesen, oran })
  }

  // Açık hesabı olmayanları gercekleşeni de yoksa gösterme
  const filtered = rows.filter(r => r.acikHesap > 0 || r.gerceklesen > 0)

  // Gerçekleşen büyükten küçüğe
  filtered.sort((a, b) => b.gerceklesen - a.gerceklesen)

  return NextResponse.json<TahsilatResponse>({ rows: filtered })
}
