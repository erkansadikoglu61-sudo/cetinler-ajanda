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
  if (fs.existsSync(EXCEL_PATH)) {
    console.log('📂 Excel dosyası local path\'ten okunuyor:', EXCEL_PATH)
    return fs.readFileSync(EXCEL_PATH)
  }
  try {
    console.log('☁️ Excel dosyası Supabase Storage\'dan indiriliyor...')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await sb.storage.from(BUCKET).download(OBJ_NAME)
    if (error || !data) {
      console.error('❌ Excel indirme hatası:', error)
      return null
    }
    console.log('✅ Excel başarıyla indirildi, boyut:', data.size, 'bytes')
    return Buffer.from(await data.arrayBuffer())
  } catch (e) {
    console.error('❌ Excel indirme exception:', e)
    return null
  }
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(',', '.')) || 0
  return 0
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/i̇/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

export interface DashboardTahsilatMetrics {
  acikHesap: number // Tahsilat Planım sayfasından Toplam kolonu
  tahsilatHedef: number // Tahsilat Hedef datasından
  gerceklesenTahsilat: number // Gerçekleşen Tahsilat sayfasından
  tahsilatTurleri: Array<{ tur: string; tutar: number; oran: number }> // Türlere göre dağılım
  acikHesapCariDetay: Array<{ cariIsim: string; tutar: number; pay: number }> // Açık hesap cari detayı
  gerceklesenCariDetay: Array<{ cariIsim: string; tutar: number; pay: number }> // Gerçekleşen cari detayı
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : new Date().getMonth() + 1

  const buf = await getExcelBuffer()
  if (!buf) {
    return NextResponse.json<DashboardTahsilatMetrics>({
      acikHesap: 0,
      tahsilatHedef: 0,
      gerceklesenTahsilat: 0,
      tahsilatTurleri: [],
      acikHesapCariDetay: [],
      gerceklesenCariDetay: [],
    })
  }

  const wb = XLSX.read(buf, { type: 'buffer', dense: true })

  // === AÇIK HESAP ve TAHSİLAT HEDEF (Tahsilat_hedef_datası sayfasından) ===
  let acikHesap = 0
  let tahsilatHedef = 0
  const acikHesapCariMap = new Map<string, number>()

  // Excel'deki tam isim: "Tahsilat_Hedef_Datası" (büyük T, H, D)
  const hedefDatasiSheet = wb.Sheets['Tahsilat_Hedef_Datası']

  if (hedefDatasiSheet) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(hedefDatasiSheet, { header: 1, defval: null })
    if (rows.length > 1) {
      const header = rows[0] as unknown[]
      let yilCol = -1
      let ayCol = -1
      let acikHesapCol = -1
      let cariIsimCol = -1

      for (let c = 0; c < header.length; c++) {
        const h = normalizeText(String(header[c] ?? ''))
        if (h === 'yıl' || h === 'yil') yilCol = c
        if (h === 'ay') ayCol = c
        if (h === 'toplam') acikHesapCol = c
        if (h === 'cari isim' || h === 'cariisim') cariIsimCol = c
      }

      if (acikHesapCol >= 0) {
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i]
          if (!r) continue

          const rowYil = yilCol >= 0 ? toNum(r[yilCol]) : 0
          const rowAy = ayCol >= 0 ? toNum(r[ayCol]) : 0
          const tutar = toNum(r[acikHesapCol])
          const cariIsim = cariIsimCol >= 0 ? String(r[cariIsimCol] ?? '').trim() : 'Bilinmeyen'

          if (rowYil === yil && rowAy === ay && tutar > 0) {
            acikHesap += tutar
            acikHesapCariMap.set(cariIsim, (acikHesapCariMap.get(cariIsim) || 0) + tutar)
          }
        }

        tahsilatHedef = acikHesap * 0.90
      }
    }
  }

  // === GERÇEKLEŞEN TAHSİLAT ===
  let gerceklesenTahsilat = 0
  const turMap = new Map<string, number>()
  const gerceklesenCariMap = new Map<string, number>()

  const gerceklesenSheet = wb.Sheets['Gerçekleşen Tahsilat'] || wb.Sheets['gerceklesen_tahsilat']
  if (gerceklesenSheet) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(gerceklesenSheet, { header: 1, defval: null })
    if (rows.length > 1) {
      const header = rows[0] as unknown[]
      let yilCol = -1
      let ayCol = -1
      let tutarCol = -1
      let turCol = -1
      let cariIsimCol = -1

      for (let c = 0; c < header.length; c++) {
        const h = normalizeText(String(header[c] ?? ''))
        if (h === 'yıl' || h === 'yil') yilCol = c
        if (h === 'ay') ayCol = c
        if (h.includes('tutar') || h.includes('tahsilat')) tutarCol = c
        if (h.includes('tür') || h.includes('tur') || h.includes('tip')) turCol = c
        if (h === 'cari isim' || h === 'cariisim') cariIsimCol = c
      }

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        if (!r) continue

        const rowYil = yilCol >= 0 ? toNum(r[yilCol]) : 0
        const rowAy = ayCol >= 0 ? toNum(r[ayCol]) : 0
        const tutar = tutarCol >= 0 ? toNum(r[tutarCol]) : 0
        const tur = turCol >= 0 ? String(r[turCol] ?? '').trim() : 'Diğer'
        const cariIsim = cariIsimCol >= 0 ? String(r[cariIsimCol] ?? '').trim() : 'Bilinmeyen'

        if (rowYil === yil && rowAy === ay && tutar > 0) {
          gerceklesenTahsilat += tutar
          turMap.set(tur || 'Diğer', (turMap.get(tur || 'Diğer') || 0) + tutar)
          gerceklesenCariMap.set(cariIsim, (gerceklesenCariMap.get(cariIsim) || 0) + tutar)
        }
      }
    }
  }

  // Tahsilat türlerini oran ile hesapla
  const tahsilatTurleri = Array.from(turMap.entries())
    .map(([tur, tutar]) => ({
      tur,
      tutar,
      oran: gerceklesenTahsilat > 0 ? tutar / gerceklesenTahsilat : 0,
    }))
    .sort((a, b) => b.tutar - a.tutar)

  // Cari bazında detaylar
  const acikHesapCariDetay = Array.from(acikHesapCariMap.entries())
    .map(([cariIsim, tutar]) => ({
      cariIsim,
      tutar,
      pay: acikHesap > 0 ? tutar / acikHesap : 0
    }))
    .sort((a, b) => b.tutar - a.tutar)

  const gerceklesenCariDetay = Array.from(gerceklesenCariMap.entries())
    .map(([cariIsim, tutar]) => ({
      cariIsim,
      tutar,
      pay: gerceklesenTahsilat > 0 ? tutar / gerceklesenTahsilat : 0
    }))
    .sort((a, b) => b.tutar - a.tutar)

  const result: DashboardTahsilatMetrics = {
    acikHesap,
    tahsilatHedef,
    gerceklesenTahsilat,
    tahsilatTurleri,
    acikHesapCariDetay,
    gerceklesenCariDetay,
  }

  return NextResponse.json(result)
}
