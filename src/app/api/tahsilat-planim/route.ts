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

export interface TahsilatPlanimRow {
  cariKod:   string
  cariIsim:  string
  onceki:    number
  kasim:     number
  aralik:    number
  ocak:      number
  subat:     number
  mart:      number
  nisan:     number
  mayis:     number
  haziran:   number
  toplam:    number
  tahsilatHaftasi?: string  // Kullanıcı seçimi
  tahsilatTuru?: string     // Kullanıcı seçimi
}

export interface TahsilatPlanimResponse {
  rows: TahsilatPlanimRow[]
}

export async function GET(req: Request) {
  const sp     = new URL(req.url).searchParams
  const yil    = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay     = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1
  const bsyAdi = sp.get('bsyAdi') ?? ''

  const buf = await getExcelBuffer()
  if (!buf) return NextResponse.json<TahsilatPlanimResponse>({ rows: [] })

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })

  // "Tahsilat Planım" sekmesini oku
  const sheet = wb.Sheets['Tahsilat Planım']
  if (!sheet) return NextResponse.json<TahsilatPlanimResponse>({ rows: [] })

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  if (raw.length < 2) return NextResponse.json<TahsilatPlanimResponse>({ rows: [] })

  // Header'dan kolon indekslerini bul
  const header = raw[0] as unknown[]
  const cols: Record<string, number> = {}
  const colNames = ['Cari Kod', 'Cari İsim', 'Önceki', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Toplam']

  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] ?? '').trim()
    for (const name of colNames) {
      if (h.toLowerCase() === name.toLowerCase()) {
        cols[name] = c
        break
      }
    }
  }

  // BSY kodunu bul
  const bsyNameToKod = Object.fromEntries(
    Object.entries(BSY_KOD_TO_NAME).map(([k, v]) => [v.toLocaleLowerCase('tr'), k])
  )
  const bsyKod = bsyNameToKod[bsyAdi.toLocaleLowerCase('tr')] ?? ''

  // Supabase'den kullanıcı seçimlerini al
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: secimler } = await sb
    .from('tahsilat_planim')
    .select('*')
    .eq('bsy_adi', bsyAdi)
    .eq('yil', yil)
    .eq('ay', ay)

  const secimMap = new Map<string, { tahsilatHaftasi: string; tahsilatTuru: string }>()
  secimler?.forEach(s => {
    secimMap.set(s.cari_kod, {
      tahsilatHaftasi: s.tahsilat_haftasi ?? '',
      tahsilatTuru: s.tahsilat_turu ?? ''
    })
  })

  // BSY kodu kolonunu bul (header'dan)
  let bsyKodCol = -1
  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] ?? '').trim().toLowerCase()
    if (h === 'bsy kod' || h === 'bsy' || h === 'bsy kodu') {
      bsyKodCol = c
      break
    }
  }

  // Verileri oku
  const rows: TahsilatPlanimRow[] = []
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const cariKod  = String(r[cols['Cari Kod']] ?? '').trim()
    const cariIsim = String(r[cols['Cari İsim']] ?? '').trim()

    if (!cariKod || !cariIsim) continue

    // BSY filtrelemesi
    if (bsyAdi && bsyKod && bsyKodCol >= 0) {
      const rowBsyKod = String(r[bsyKodCol] ?? '').trim().toUpperCase()
      if (rowBsyKod !== bsyKod) continue
    }

    const onceki  = toNum(r[cols['Önceki']])
    const kasim   = toNum(r[cols['Kasım']])
    const aralik  = toNum(r[cols['Aralık']])
    const ocak    = toNum(r[cols['Ocak']])
    const subat   = toNum(r[cols['Şubat']])
    const mart    = toNum(r[cols['Mart']])
    const nisan   = toNum(r[cols['Nisan']])
    const mayis   = toNum(r[cols['Mayıs']])
    const haziran = toNum(r[cols['Haziran']])
    const toplam  = toNum(r[cols['Toplam']])

    const secim = secimMap.get(cariKod)
    rows.push({
      cariKod,
      cariIsim,
      onceki,
      kasim,
      aralik,
      ocak,
      subat,
      mart,
      nisan,
      mayis,
      haziran,
      toplam,
      tahsilatHaftasi: secim?.tahsilatHaftasi,
      tahsilatTuru: secim?.tahsilatTuru
    })
  }

  return NextResponse.json<TahsilatPlanimResponse>({ rows })
}

// POST: Kullanıcı seçimlerini kaydet
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { bsyAdi, yil, ay, cariKod, tahsilatHaftasi, tahsilatTuru } = body

    if (!bsyAdi || !cariKod) {
      return NextResponse.json({ error: 'BSY adı ve Cari kod gerekli' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await sb
      .from('tahsilat_planim')
      .upsert({
        bsy_adi: bsyAdi,
        cari_kod: cariKod,
        cari_isim: body.cariIsim ?? '',
        yil,
        ay,
        tahsilat_haftasi: tahsilatHaftasi,
        tahsilat_turu: tahsilatTuru,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'bsy_adi,cari_kod,yil,ay'
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
