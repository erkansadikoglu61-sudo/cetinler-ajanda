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
  // Excel'deki tam isim: "Tahsilat_Hedef_Datası" (büyük T, H, D, son İ)
  const hedefSheet = wb.Sheets['Tahsilat_Hedef_Datası']

  if (!hedefSheet) {
    console.warn('⚠️ Tahsilat_Hedef_Datası sayfası bulunamadı! Mevcut sayfalar:', Object.keys(wb.Sheets))
  } else {
    console.log('✅ Tahsilat_Hedef_Datası sayfası bulundu!')
  }

  const hedefRaw: unknown[][] = hedefSheet
    ? XLSX.utils.sheet_to_json(hedefSheet, { header: 1, defval: null })
    : []

  // Header'dan kolon indexlerini bul
  let hedefAyCol = -1
  let hedefYilCol = -1
  let hedefPlasiyerCol = -1
  let hedefCariIsimCol = -1
  let hedefToplamCol = -1

  if (hedefRaw.length > 0) {
    const header = hedefRaw[0] as unknown[]
    console.log('📊 Tahsilat_Hedef_Datası - Header:', header.slice(0, 12))

    for (let c = 0; c < header.length; c++) {
      const h = String(header[c] ?? '')
        .trim()
        .toLowerCase()
        .replace(/i̇/g, 'i')  // Türkçe İ → i
        .replace(/ı/g, 'i')   // Türkçe ı → i
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/_/g, '')     // Alt çizgi
        .replace(/\s/g, '')    // Boşluk

      if (h === 'ay') hedefAyCol = c
      if (h === 'yil') hedefYilCol = c
      if (h.includes('plasiyer') && h.includes('kod')) hedefPlasiyerCol = c
      if (h.includes('cari') && h.includes('isim')) hedefCariIsimCol = c
      if (h === 'toplam') hedefToplamCol = c
    }

    console.log('📊 Kolonlar:', { hedefAyCol, hedefYilCol, hedefPlasiyerCol, hedefCariIsimCol, hedefToplamCol })
  }

  // BSY kodu → BSY toplam açık hesap
  const acikHesapMap = new Map<string, number>()
  // (bsyKod + cariIsim) → cari bazında açık hesap (detay için)
  const cariAcikMap  = new Map<string, number>()   // key: `${bsyKod}||${cariIsim}`

  let matchCount = 0
  for (let i = 1; i < hedefRaw.length; i++) {
    const r = hedefRaw[i]
    if (!r) continue

    // Plasiyer Kodu'ndan BSY kodu al (format: "IB2 / Okan OĞUZ" veya "IB2")
    const plasiyerKod = hedefPlasiyerCol >= 0 ? String(r[hedefPlasiyerCol] ?? '').trim() : ''
    // Slash varsa öncesini al, yoksa tamamını al
    const bsyKod = plasiyerKod ? plasiyerKod.split('/')[0].trim().toUpperCase() : ''
    const cariIsim = hedefCariIsimCol >= 0 ? String(r[hedefCariIsimCol] ?? '').trim() : ''

    if (!bsyKod) continue

    // Yıl ve Ay filtresi
    if (hedefYilCol >= 0) {
      const rowYil = typeof r[hedefYilCol] === 'number' ? r[hedefYilCol] : parseInt(String(r[hedefYilCol] ?? '0'))
      if (rowYil !== yil) continue
    }
    if (hedefAyCol >= 0) {
      const rowAy = typeof r[hedefAyCol] === 'number' ? r[hedefAyCol] : parseInt(String(r[hedefAyCol] ?? '0'))
      if (rowAy !== ay) continue
    }

    const toplam = hedefToplamCol >= 0 ? toNum(r[hedefToplamCol]) : 0

    // BSY adına çevir
    const bsyAdi = BSY_KOD_TO_NAME[bsyKod] || bsyKod

    acikHesapMap.set(bsyAdi, (acikHesapMap.get(bsyAdi) ?? 0) + toplam)
    matchCount++
    if (matchCount <= 3) {
      console.log(`  ✓ Satır ${i}: plasiyerKod=[${plasiyerKod}], bsyAdi=[${bsyAdi}], toplam=${toplam}`)
    }
    if (cariIsim) {
      const ck = `${bsyAdi}||${cariIsim}`
      cariAcikMap.set(ck, (cariAcikMap.get(ck) ?? 0) + toplam)
    }
  }
  console.log(`📊 Açık Hesap Map: ${acikHesapMap.size} BSY, ${matchCount} satır işlendi`)
  console.log('📊 İlk 3 BSY:', Array.from(acikHesapMap.entries()).slice(0, 3))

  // ── 2. Gerçekleşen Tahsilat ─────────────────────────────────────
  const gercSheet = wb.Sheets['Gerçekleşen Tahsilat']
  const gercRaw: unknown[][] = gercSheet
    ? XLSX.utils.sheet_to_json(gercSheet, { header: 1, defval: null })
    : []

  // Header'dan kolon indexlerini bul
  let gercPlasiyerCol = -1
  let gercCariIsimCol = -1
  let gercAyCol = -1
  let gercYilCol = -1
  let gercTurCol = -1
  let gercTutarCol = -1

  if (gercRaw.length > 0) {
    const header = gercRaw[0] as unknown[]
    for (let c = 0; c < header.length; c++) {
      const h = String(header[c] ?? '')
        .trim()
        .toLowerCase()
        .replace(/i̇/g, 'i')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/_/g, '')
        .replace(/\s/g, '')

      if (h.includes('plasiyer') && h.includes('kod')) gercPlasiyerCol = c
      if (h.includes('cari') && h.includes('isim')) gercCariIsimCol = c
      if (h === 'ay') gercAyCol = c
      if (h === 'yil') gercYilCol = c
      if (h.includes('tur') || h.includes('tip')) gercTurCol = c
      if (h.includes('tutar') || h === 'tutar') gercTutarCol = c
    }
    console.log('📊 Gerçekleşen Tahsilat - Kolonlar:', { gercPlasiyerCol, gercCariIsimCol, gercAyCol, gercYilCol, gercTurCol, gercTutarCol })
  }

  // BSY → toplam (özet için)
  const gercMap = new Map<string, number>()
  // BSY + cariIsim + ay + tur → tutar (detay için)
  const detayMap = new Map<string, TahsilatDetayRow>()

  for (let i = 1; i < gercRaw.length; i++) {
    const r = gercRaw[i]
    if (!r) continue

    // Plasiyer Kodu'ndan BSY kodu al (format: "IB2 / Okan OĞUZ" veya "IB2")
    const plasiyerKod = gercPlasiyerCol >= 0 ? String(r[gercPlasiyerCol] ?? '').trim() : ''
    // Slash varsa öncesini al, yoksa tamamını al
    const bsyKod = plasiyerKod ? plasiyerKod.split('/')[0].trim().toUpperCase() : ''
    const bsyAdi = bsyKod ? (BSY_KOD_TO_NAME[bsyKod] || bsyKod) : ''
    const cariIsim = gercCariIsimCol >= 0 ? String(r[gercCariIsimCol] ?? '').trim() : ''
    const rowAy = gercAyCol >= 0 ? (typeof r[gercAyCol] === 'number' ? r[gercAyCol] : parseInt(String(r[gercAyCol] ?? '0'))) : 0
    const rowYil = gercYilCol >= 0 ? (typeof r[gercYilCol] === 'number' ? r[gercYilCol] : parseInt(String(r[gercYilCol] ?? '0'))) : 0
    const tur = gercTurCol >= 0 ? String(r[gercTurCol] ?? '').trim() : ''

    if (!bsyAdi || rowYil !== yil) continue
    const tutar = gercTutarCol >= 0 ? toNum(r[gercTutarCol]) : 0

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
