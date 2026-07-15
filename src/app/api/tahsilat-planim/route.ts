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
  bsyAdi?:   string
  onceki:    number
  ocak:      number
  subat:     number
  mart:      number
  nisan:     number
  mayis:     number
  haziran:   number
  temmuz:    number
  agustos:   number
  eylul:     number
  ekim:      number
  kasim:     number
  aralik:    number
  toplam:    number
  tahsilatHaftasi?: string
  tutar?: number
  tahsilatTuru?: string
}

export interface TahsilatPlanimResponse {
  rows: TahsilatPlanimRow[]
}

export async function GET(req: Request) {
  const sp     = new URL(req.url).searchParams
  const yil    = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay     = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1
  const bsyAdi = sp.get('bsyAdi') ?? ''
  const showAll = sp.get('showAll') === 'true' // Admin için tümünü göster

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
  const colNames = ['Cari Kod', 'Cari İsim', 'Önceki', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', 'Toplam']

  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] ?? '').trim()
    for (const name of colNames) {
      if (h.toLowerCase() === name.toLowerCase()) {
        cols[name] = c
        break
      }
    }
  }

  // BSY kodunu bul (Burak Kılıç için hem IB1 hem IB2)
  const bsyNameToKod = Object.fromEntries(
    Object.entries(BSY_KOD_TO_NAME).map(([k, v]) => [v.toLocaleLowerCase('tr'), k])
  )
  const bsyKod = bsyNameToKod[bsyAdi.toLocaleLowerCase('tr')] ?? ''

  // Burak Kılıç (IB1) için IB2'yi de ekle
  const allowedBsyKods: string[] = bsyKod ? [bsyKod] : []
  if (bsyKod === 'IB1') {
    allowedBsyKods.push('IB2')
  }

  // Supabase'den kullanıcı seçimlerini al
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Admin için tüm seçimleri çek, normal kullanıcı için sadece kendi BSY'sini
  let secimlerQuery = sb
    .from('tahsilat_planim')
    .select('*')
    .eq('yil', yil)
    .eq('ay', ay)

  if (!showAll && bsyAdi) {
    secimlerQuery = secimlerQuery.eq('bsy_adi', bsyAdi)
  }

  const { data: secimler, error: secimlerError } = await secimlerQuery

  // Debug log
  console.log('📊 Tahsilat Planı Query:', {
    showAll,
    bsyAdi,
    yil,
    ay,
    secimCount: secimler?.length,
    error: secimlerError,
    sampleData: secimler?.slice(0, 2)
  })

  const secimMap = new Map<string, { tahsilatHaftasi: string; tutar: number | null; tahsilatTuru: string }>()
  secimler?.forEach(s => {
    secimMap.set(s.cari_kod, {
      tahsilatHaftasi: s.tahsilat_haftasi ?? '',
      tutar: s.tutar ?? null,
      tahsilatTuru: s.tahsilat_turu ?? ''
    })
  })

  // BSY kodu kolonunu bul (header'dan)
  let bsyKodCol = -1
  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] ?? '').trim().toLowerCase()
    if (h === 'bsy kod' || h === 'bsy' || h === 'bsy kodu' || h === 'bsy_kod') {
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

    // BSY kodunu al
    const rowBsyKod = bsyKodCol >= 0 ? String(r[bsyKodCol] ?? '').trim().toUpperCase() : ''
    const rowBsyAdi = rowBsyKod ? BSY_KOD_TO_NAME[rowBsyKod] : ''

    // BSY filtrelemesi - showAll true ise filtre yapma
    if (!showAll && bsyAdi && allowedBsyKods.length > 0 && bsyKodCol >= 0) {
      if (!allowedBsyKods.includes(rowBsyKod)) continue
    }

    const onceki  = toNum(r[cols['Önceki']])
    const ocak    = toNum(r[cols['Ocak']])
    const subat   = toNum(r[cols['Şubat']])
    const mart    = toNum(r[cols['Mart']])
    const nisan   = toNum(r[cols['Nisan']])
    const mayis   = toNum(r[cols['Mayıs']])
    const haziran = toNum(r[cols['Haziran']])
    const temmuz  = toNum(r[cols['Temmuz']])
    const agustos = toNum(r[cols['Ağustos']])
    const eylul   = toNum(r[cols['Eylül']])
    const ekim    = toNum(r[cols['Ekim']])
    const kasim   = toNum(r[cols['Kasım']])
    const aralik  = toNum(r[cols['Aralık']])
    const toplam  = toNum(r[cols['Toplam']])

    const secim = secimMap.get(cariKod)
    rows.push({
      cariKod,
      cariIsim,
      ...(showAll && rowBsyAdi ? { bsyAdi: rowBsyAdi } : {}),
      onceki,
      ocak,
      subat,
      mart,
      nisan,
      mayis,
      haziran,
      temmuz,
      agustos,
      eylul,
      ekim,
      kasim,
      aralik,
      toplam,
      tahsilatHaftasi: secim?.tahsilatHaftasi,
      tutar: secim?.tutar ?? undefined,
      tahsilatTuru: secim?.tahsilatTuru
    })
  }

  return NextResponse.json<TahsilatPlanimResponse>({ rows })
}

// POST: Kullanıcı seçimlerini kaydet
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { bsyAdi, yil, ay, cariKod, tahsilatHaftasi, tutar, tahsilatTuru } = body

    console.log('💾 Tahsilat Planı Kaydet:', { bsyAdi, cariKod, yil, ay, tahsilatHaftasi, tutar, tahsilatTuru })

    if (!bsyAdi || !cariKod) {
      console.error('❌ Validation Error: BSY adı veya Cari kod eksik')
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
        tutar: tutar ?? null,
        tahsilat_turu: tahsilatTuru,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'bsy_adi,cari_kod,yil,ay'
      })

    if (error) {
      console.error('❌ Supabase Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Kayıt başarılı')
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
