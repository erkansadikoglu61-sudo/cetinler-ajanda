// v2 — BSY adet gerçekleşmesi: SAHA.xlsx "Data" sayfası (kullanıcı kararı 2026-11-15:
// BSY gerçekleşmesinin kaynağı Excel).
//
// Data sayfası kolonları (v1 bsy-ciro / kpi-adet / sellin-sellout ile aynı):
//   r[1] cari kodu · r[2] cari ismi · r[8] stok kodu · r[15] adet
//   r[18] G/Ç (C = satış, G = iade → eksi) · r[20] ay · r[21] yıl · r[31] plasiyer kodu
// Plasiyer kodu dönem kuralıyla düzeltilir (ör. Evkur: Ekim 2026'dan itibaren MB10).
// Ürün kategorisi: "Adet Primleri" sayfası + adet_prim_override (lib/adetPrimRates);
// orada olmayan stoklar için B2B satış raporundaki grup.

import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { downloadBsyExcel } from '@/lib/bsyExcel'
import { loadAdetPrimRates } from '@/lib/adetPrimRates'
import { donemBsyKodu } from '@/lib/merchSatis'
import { GRUP_NORMALIZE, normalizeName } from '@/lib/sellout'
import { BSY_ADET_KATEGORILER } from '@/lib/v2/bsyAdetPrim'
import { donemSatirlari } from '@/lib/v2/sunucu'

/** Excel / B2B kategori adını BSY adet kategorisine çevirir (yoksa null) */
export function bsyKategori(ad: string | null | undefined): string | null {
  // Türkçe harfler ASCII'ye (İ/ı → i, ş → s …); "IPL" büyük/küçük her biçimde eşleşir
  const s = normalizeName(ad ?? '')
  if (!s) return null
  if (s.includes('supurge')) return null
  if (s.includes('mutfak') && s.includes('diger')) return null
  if (s.includes('ipl')) return 'IPL Grubu'
  if (s.includes('uflemeli')) return 'Üflemeli Grubu'
  if (s.includes('duzle') || s.includes('masa')) return 'Düzleştirici&Maşa Grubu'
  if (s.includes('erkek')) return 'Erkek Bakım Grubu'
  if (s.includes('epilat') || s.includes('baskul')) return 'Epilatör&Baskül&Mutfak'
  return null
}

const KATEGORI_SET = new Set(BSY_ADET_KATEGORILER.map(k => k.grup))

// donem → bsyKod → stokKodu → adet
type Ham = Map<string, Map<string, Map<string, number>>>
let hamCache: { at: number; veri: Ham } | null = null
const TTL = 10 * 60 * 1000

async function hamVeri(sb: SupabaseClient): Promise<Ham> {
  if (hamCache && Date.now() - hamCache.at < TTL) return hamCache.veri
  const { data, error } = await downloadBsyExcel(sb)
  if (error || !data) throw new Error('SAHA.xlsx indirilemedi')
  const wb = XLSX.read(Buffer.from(await data.arrayBuffer()), { type: 'buffer', dense: true })
  const ws = wb.Sheets['Data']
  if (!ws) throw new Error('SAHA.xlsx: Data sayfası bulunamadı')
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const veri: Ham = new Map()
  const sayi = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(',', '.')) || 0)
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue
    const gc = String(r[18] ?? '').toUpperCase().trim()
    if (gc !== 'C' && gc !== 'G') continue
    const yil = Math.trunc(sayi(r[21]))
    const ay = Math.trunc(sayi(r[20]))
    const stok = String(r[8] ?? '').trim()
    const plasiyer = String(r[31] ?? '').trim()
    if (!yil || !ay || !stok || !plasiyer) continue
    const donem = `${yil}-${String(ay).padStart(2, '0')}`
    const kod = donemBsyKodu(plasiyer, String(r[1] ?? ''), String(r[2] ?? ''), donem)
    const adet = gc === 'G' ? -Math.abs(sayi(r[15])) : sayi(r[15])
    let d = veri.get(donem)
    if (!d) { d = new Map(); veri.set(donem, d) }
    let k = d.get(kod)
    if (!k) { k = new Map(); d.set(kod, k) }
    k.set(stok, (k.get(stok) ?? 0) + adet)
  }
  hamCache = { at: Date.now(), veri }
  return veri
}

/** Dönemin BSY kodu → kategori → adet tablosu (yalnızca 2027 BSY kategorileri) */
export async function bsyExcelAdetleri(sb: SupabaseClient, donem: string): Promise<Map<string, Record<string, number>>> {
  const [yil, ay] = donem.split('-').map(Number)
  const [ham, oranlar, satirlar] = await Promise.all([
    hamVeri(sb),
    loadAdetPrimRates(sb, yil, ay),
    donemSatirlari(donem).catch(() => []),
  ])
  // B2B satış raporundan yedek stok → kategori
  const b2bKategori = new Map<string, string>()
  for (const r of satirlar) {
    const g = GRUP_NORMALIZE[r.grup_aciklama]
    if (g && r.stok_kodu && !b2bKategori.has(r.stok_kodu.trim())) b2bKategori.set(r.stok_kodu.trim(), g)
  }
  const kategoriOf = (stok: string) =>
    bsyKategori(oranlar[stok]?.kategori) ?? bsyKategori(b2bKategori.get(stok))

  const out = new Map<string, Record<string, number>>()
  for (const [kod, stoklar] of ham.get(donem) ?? []) {
    const rec: Record<string, number> = {}
    for (const [stok, adet] of stoklar) {
      const k = kategoriOf(stok)
      if (!k || !KATEGORI_SET.has(k)) continue
      rec[k] = (rec[k] ?? 0) + adet
    }
    out.set(kod.toUpperCase(), rec)
  }
  return out
}
