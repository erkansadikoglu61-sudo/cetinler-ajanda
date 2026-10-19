// Adet prim oranları (stok kodu → Bayi Merch / Koşullu Destek) — TEK KAYNAK.
// SAHA.xlsx "Adet Primleri" sayfası → ay bazlı adet_prim_override ile üzerine
// yazılır. /api/adet-prim (Sellout ▸ Satışlar, Adet Prim parametre sayfası),
// /api/bayi-merch-prim (Prim Ödeme Listesi) ve /api/prim-analiz aynı oranı
// kullansın diye ortak fonksiyondur. Önceden bayi-merch-prim/prim-analiz
// koddaki ADET_PRIM_DEFAULTS'u okuyordu; Excel'de değişen bir oran (ör. RHC6800)
// Satışlar ile Prim Ödeme arasında fark üretiyordu.

import type { SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { ADET_PRIM_DEFAULTS, type AdetPrimRow } from '@/lib/adet-prim-defaults'

/** Excel'den oranları okur; Excel yoksa/okunamazsa ADET_PRIM_DEFAULTS'a düşer. */
async function loadBaseRates(sb: SupabaseClient): Promise<Record<string, AdetPrimRow>> {
  const fallback = () => Object.fromEntries(ADET_PRIM_DEFAULTS.map(r => [r.stokKodu, { ...r }]))
  try {
    const { data: excelData, error } = await sb.storage.from('bsy-excel').download('SAHA.xlsx')
    if (error || !excelData) {
      console.error('Excel download error:', error)
      return fallback()
    }
    const wb = XLSX.read(Buffer.from(await excelData.arrayBuffer()), { type: 'buffer' })
    if (!wb.SheetNames.includes('Adet Primleri')) {
      console.error('Adet Primleri sheet not found. Available sheets:', wb.SheetNames)
      return fallback()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonData: any[][] = XLSX.utils.sheet_to_json(wb.Sheets['Adet Primleri'], { header: 1, defval: '' })
    if (jsonData.length < 2) return fallback()

    // Başlık satırını bul (ilk 5 satırda tara)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const rowStr = jsonData[i].map(c => String(c ?? '').toLowerCase()).join(' ')
      if (rowStr.includes('stok') && (rowStr.includes('kod') || rowStr.includes('kategori'))) {
        headerRowIdx = i
        break
      }
    }

    const cols: { [key: string]: number } = {}
    jsonData[headerRowIdx].forEach((h, c: number) => {
      const hs = String(h ?? '').toLowerCase().trim()
      if (hs.includes('marka')) cols['marka'] = c
      if (hs.includes('kategori')) cols['kategori'] = c
      if (hs.includes('stok') && hs.includes('kod')) cols['stokKodu'] = c
      if (hs.includes('bayi') && hs.includes('merch')) cols['bayiMerch'] = c
      if (hs.includes('koşullu') || hs.includes('kosullu') || hs.includes('destek')) cols['kosulluDestek'] = c
    })

    const primData: Record<string, AdetPrimRow> = {}
    for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
      const row = jsonData[r]
      if (!row || row.length === 0) continue
      const stokKodu = cols['stokKodu'] >= 0 ? String(row[cols['stokKodu']] ?? '').trim() : ''
      const kategori = cols['kategori'] >= 0 ? String(row[cols['kategori']] ?? '').trim() : ''
      const bayiMerch = cols['bayiMerch'] >= 0 ? parseFloat(String(row[cols['bayiMerch']] ?? '0')) || null : null
      const kosulluDestek = cols['kosulluDestek'] >= 0 ? parseFloat(String(row[cols['kosulluDestek']] ?? '0')) || null : null
      if (stokKodu && stokKodu.toLowerCase() !== 'stok kodu' && stokKodu.toLowerCase() !== 'stok_kodu') {
        primData[stokKodu] = { stokKodu, kategori: kategori || null, bayiMerch, kosulluDestek }
      }
    }
    return primData
  } catch (e) {
    console.error('Adet prim Excel parse error:', e)
    return fallback()
  }
}

// SAHA.xlsx'te olmayan (sonradan eklenen) stokların kategorisi. Override'da
// kategori seçilmemişse ve Excel'de de yoksa buradan gelir.
const EK_KATEGORI: Record<string, string> = {
  IPL9750P: 'IPL Grubu',
  RMS9200V: 'Üflemeli Grup',
}

/** Belirli ay için nihai oranlar: Excel (veya defaults) + adet_prim_override. */
export async function loadAdetPrimRates(sb: SupabaseClient, yil: number, ay: number): Promise<Record<string, AdetPrimRow>> {
  const primData = await loadBaseRates(sb)
  try {
    // kategori kolonu: elle eklenen (Excel'de olmayan) stokların kategorisi.
    // Kolon henüz yoksa (migration çalışmadıysa) eski sorguya düşülür.
    let res = await sb
      .from('adet_prim_override')
      .select('stok_kodu, bayi_merch, kosullu_destek, kategori')
      .eq('yil', yil)
      .eq('ay', ay)
    if (res.error) {
      res = await sb
        .from('adet_prim_override')
        .select('stok_kodu, bayi_merch, kosullu_destek')
        .eq('yil', yil)
        .eq('ay', ay) as typeof res
    }
    const overrides = res.data as { stok_kodu: string; bayi_merch: number | null; kosullu_destek: number | null; kategori?: string | null }[] | null
    for (const row of overrides ?? []) {
      primData[row.stok_kodu] = {
        stokKodu:      row.stok_kodu,
        kategori:      row.kategori || primData[row.stok_kodu]?.kategori || null,
        bayiMerch:     row.bayi_merch,
        kosulluDestek: row.kosullu_destek,
      }
    }
  } catch (e) {
    console.error('DB override fetch error:', e)
  }
  for (const r of Object.values(primData)) {
    if (!r.kategori && EK_KATEGORI[r.stokKodu]) r.kategori = EK_KATEGORI[r.stokKodu]
  }
  return primData
}

// Prim Ödeme Listesi / Prim Analiz için Bayi Merch oranı. 2026-08 ve sonrası
// Sellout ▸ Satışlar ile aynı kaynak (loadAdetPrimRates). Daha önceki aylar
// ödenmiş tutarlar değişmesin diye ESKİ mantıkla (koddaki ADET_PRIM_DEFAULTS +
// adet_prim_override) hesaplanmaya devam eder — kullanıcı kararı (2026-10-02).
export const SATISLAR_ORAN_BASLANGIC = { yil: 2026, ay: 8 }

export async function loadBayiMerchRateMap(sb: SupabaseClient, yil: number, ay: number): Promise<Map<string, number | null>> {
  const primMap = new Map<string, number | null>()
  const yeni = yil * 100 + ay >= SATISLAR_ORAN_BASLANGIC.yil * 100 + SATISLAR_ORAN_BASLANGIC.ay
  if (yeni) {
    for (const r of Object.values(await loadAdetPrimRates(sb, yil, ay))) primMap.set(r.stokKodu, r.bayiMerch)
    return primMap
  }
  for (const r of ADET_PRIM_DEFAULTS) primMap.set(r.stokKodu, r.bayiMerch)
  try {
    const { data } = await sb
      .from('adet_prim_override')
      .select('stok_kodu, bayi_merch')
      .eq('yil', yil)
      .eq('ay', ay)
    for (const row of data ?? []) primMap.set(row.stok_kodu, row.bayi_merch)
  } catch { /* use defaults */ }
  return primMap
}
