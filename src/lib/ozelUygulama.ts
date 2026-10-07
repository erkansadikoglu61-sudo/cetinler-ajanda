import { normalizeName } from '@/lib/sellout'

// ─── EKSTRA Prim uygulaması (Sellout ▸ Özel Uygulama Takip) ───
// Şube bazında (Cari + Şube), tanımlı ürün gruplarından eşik ve üzeri satış
// yapılırsa o şubede satış giren Bayi Merch'lerin ilgili grubun stoklarındaki
// adet primi 2 katına çıkar. Yalnızca Bayi Merch satışları sayılır.
// Tek kaynak: takip ekranı + Bayi Merch Hakediş + Prim Ödeme + Prim Analiz +
// Sellout ▸ Satışlar hepsi buradan beslenir.
export interface OzelGrup { key: string; label: string; badge: string; codes: string[]; hedef: number; renk: string }

const IPL: OzelGrup          = { key: 'IPL',          label: 'IPL Grubu',           badge: 'IPL',          hedef: 5,  codes: ['IPL9650', 'IPL9750', 'IPL9850', 'IPL9950'], renk: 'bg-indigo-100 text-indigo-700' }
const RMS: OzelGrup          = { key: 'RMS',          label: 'RMS Grubu',           badge: 'RMS',          hedef: 5,  codes: ['RMS9200B', 'RMS9200P'],                     renk: 'bg-pink-100 text-pink-700' }
const EASYFOLD: OzelGrup     = { key: 'EasyFold',     label: 'EasyFold Serisi',     badge: 'EasyFold',     hedef: 5,  codes: ['RHD7130B', 'RHD7130P'],                     renk: 'bg-sky-100 text-sky-700' }
const EASYSTRAIGHT: OzelGrup = { key: 'EasyStraight', label: 'EasyStraight Serisi', badge: 'EasyStraight', hedef: 5,  codes: ['RHS8900B', 'RHS8900P'],                     renk: 'bg-teal-100 text-teal-700' }
const KERATIN: OzelGrup      = { key: 'Keratin',      label: 'Keratin Serisi',      badge: 'Keratin',      hedef: 10, codes: ['RS9500', 'RS9505', 'RC9525', 'RC9532'],     renk: 'bg-amber-100 text-amber-700' }
const ERKEK: OzelGrup        = { key: 'ErkekBakim',   label: 'Erkek Bakım',         badge: 'Erkek Bakım',  hedef: 5,  codes: ['RPG7500'],                                  renk: 'bg-purple-100 text-purple-700' }

export const OZEL_CARPAN = 2

/** Dönemde ('YYYY-MM') geçerli EKSTRA prim grupları.
 *  2026-08: yalnız IPL + RMS · 2026-09 ve sonrası: 6 grup · öncesi: yok. */
export function getOzelGruplar(donem: string): OzelGrup[] {
  if (donem < '2026-08') return []
  if (donem === '2026-08') return [IPL, RMS]
  return [IPL, RMS, EASYFOLD, EASYSTRAIGHT, KERATIN, ERKEK]
}

export function ozelSubeKey(cari: string, sube: string): string {
  return `${normalizeName(cari)}||${normalizeName(sube)}`
}

export interface OzelSatis { cari: string; sube: string; stokKodu: string; adet: number; merchTipi: string; donem: string }

/** Şube (cari+şube) bazında her grubun Bayi Merch satış adedi. */
export function ozelSubeAdetleri(rows: OzelSatis[], donem: string) {
  const codeToKey: Record<string, string> = {}
  getOzelGruplar(donem).forEach(g => g.codes.forEach(c => { codeToKey[c.toUpperCase()] = g.key }))
  const groups = new Map<string, { cari: string; sube: string; adet: Record<string, number> }>()
  for (const r of rows) {
    if (r.donem !== donem || r.merchTipi !== 'Bayi Merch') continue
    const gkey = codeToKey[(r.stokKodu || '').toUpperCase()]
    if (!gkey) continue
    const k = ozelSubeKey(r.cari, r.sube)
    const g = groups.get(k) ?? { cari: r.cari, sube: r.sube, adet: {} }
    g.adet[gkey] = (g.adet[gkey] ?? 0) + r.adet
    groups.set(k, g)
  }
  return groups
}

/** Bayi Merch satır primi için çarpanı döndüren fonksiyon üretir:
 *  şube o grubun eşiğine ulaştıysa ve satır o grubun stoğuysa 2, değilse 1. */
export function buildOzelCarpan(rows: OzelSatis[], donem: string) {
  const gruplar = getOzelGruplar(donem)
  const codeToGrup: Record<string, OzelGrup> = {}
  gruplar.forEach(g => g.codes.forEach(c => { codeToGrup[c.toUpperCase()] = g }))
  const adetler = ozelSubeAdetleri(rows, donem)
  return (cari: string, sube: string, stokKodu: string, merchTipi: string): number => {
    if (merchTipi !== 'Bayi Merch') return 1
    const grp = codeToGrup[(stokKodu || '').toUpperCase()]
    if (!grp) return 1
    const adet = adetler.get(ozelSubeKey(cari, sube))?.adet[grp.key] ?? 0
    return adet >= grp.hedef ? OZEL_CARPAN : 1
  }
}
