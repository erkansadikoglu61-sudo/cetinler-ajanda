// Çetinler Ajanda v2 — tek "şube (nokta) → kullanıcılar" modeli ve görünürlük kuralı.
//
// v1'de görünürlük her ekranda ayrı yazılmıştı (Noktalarımız, Sellout, Destek,
// Prim, görev penceresi…). v2'de tüm ekranlar bu dosyadaki tek modeli ve tek
// `gorunurNoktalar` fonksiyonunu kullanır.
//
// Kurallar (docs/notlar/kullanici-yapisi-ve-bsy-adet-primi.md):
//  - Her şube bir nokta; noktanın kullanıcıları vardır.
//  - BSY: carisinin plasiyeridir; carilerine bağlı TÜM şubeleri görür (il fark etmez).
//  - Süpervizör / Jr: B2B şube atamasındaki (SUPERVIZOR / JR_SUPERVIZOR) şubeleri görür.
//  - Herkes kendisine bağlı alt kullanıcıların şubelerini de görür.
//  - Çetinler Merch: kayıtlı olduğu şubeleri görür.
//  - Admin / İK / Yönetim: tümü.

import { BSY_NAME_TO_KOD } from '@/lib/bsy'
import { namesMatch, normalizeName } from '@/lib/sellout'
import { devraldiklari } from '@/lib/supDevir'

export interface V2Kisi {
  ad: string
  merchId?: string
}

export interface V2Nokta {
  key: string
  subeKod: string
  subeAdi: string
  cariKod: string
  cariAdi: string
  bsyKod: string
  bsyAdi: string
  sups: string[]
  jrs: string[]
  cetinlerMerch: V2Kisi[]
  bayiMerch: V2Kisi[]
  destek: V2Kisi[]
}

/** Görüntüleyen kullanıcıya göre noktanın kapsamı */
export type V2Kapsam = 'kendi' | 'ekip'

export interface V2GorunurNokta extends V2Nokta {
  kapsam: V2Kapsam
  /** Kapsam 'ekip' ise noktayı hangi alt kullanıcı üzerinden gördüğü */
  ekiptenKim?: string
}

export interface V2Profil {
  id: string
  full_name: string
  role: string
  manager_id: string | null
}

export interface V2BsyLink {
  bsy_id: string
  sup_id: string
}

/** Cari/şube adlarını karşılaştırmak için sade anahtar */
export function sadeAd(s: string): string {
  return normalizeName(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function noktaAnahtari(subeKod: string, cariAdi: string, subeAdi: string): string {
  const kod = (subeKod || '').trim()
  return kod ? `K:${kod}` : `A:${sadeAd(cariAdi)}||${sadeAd(subeAdi)}`
}

function icerir(liste: string[], ad: string): boolean {
  return liste.some(x => namesMatch(x, ad))
}

/** Bir kullanıcının doğrudan alt kullanıcıları (hiyerarşi) */
export function altKullanicilar(p: V2Profil, profiller: V2Profil[], links: V2BsyLink[]): V2Profil[] {
  if (p.role === 'bsy') {
    const supIds = new Set(links.filter(l => l.bsy_id === p.id).map(l => l.sup_id))
    const sups = profiller.filter(x => supIds.has(x.id))
    const jrs = profiller.filter(x => x.role === 'jr' && x.manager_id && supIds.has(x.manager_id))
    return [...sups, ...jrs]
  }
  if (p.role === 'sup') return profiller.filter(x => x.role === 'jr' && x.manager_id === p.id)
  return []
}

/** Kullanıcının bir noktayı "kendisi" olarak görüp görmediği (hiyerarşi hariç) */
function kendiNoktasi(n: V2Nokta, p: V2Profil, bsyCariler: Set<string>): boolean {
  switch (p.role) {
    case 'bsy':
      return bsyCariler.has(sadeAd(n.cariAdi))
    case 'sup':
      return icerir(n.sups, p.full_name)
    case 'jr': {
      if (icerir(n.jrs, p.full_name)) return true
      // Jr devri: öncülün (ör. Merve İnci → Burçin Acar) şubeleri de görünür
      return devraldiklari(p.full_name).some(a => icerir(n.jrs, a))
    }
    case 'merch':
      return n.cetinlerMerch.some(k => namesMatch(k.ad, p.full_name))
    default:
      return false
  }
}

/** BSY'nin carileri: B2B'de BSY kodu ya da adı kendisine ait olan noktaların carileri */
function bsyCarileri(noktalar: V2Nokta[], p: V2Profil): Set<string> {
  const set = new Set<string>()
  if (p.role !== 'bsy') return set
  const kod = (BSY_NAME_TO_KOD[p.full_name.toLocaleLowerCase('tr')] ?? '').toUpperCase()
  for (const n of noktalar) {
    const kodTutar = kod && n.bsyKod.trim().toUpperCase() === kod
    if (kodTutar || namesMatch(n.bsyAdi, p.full_name)) set.add(sadeAd(n.cariAdi))
  }
  return set
}

/** Tüm ekranların kullandığı tek görünürlük kuralı */
export function gorunurNoktalar(
  noktalar: V2Nokta[],
  p: V2Profil,
  profiller: V2Profil[],
  links: V2BsyLink[],
): V2GorunurNokta[] {
  if (['admin', 'ik', 'manager'].includes(p.role)) {
    return noktalar.map(n => ({ ...n, kapsam: 'kendi' as const }))
  }
  const altlar = altKullanicilar(p, profiller, links)
  const benimCariler = bsyCarileri(noktalar, p)
  const out: V2GorunurNokta[] = []
  for (const n of noktalar) {
    if (kendiNoktasi(n, p, benimCariler)) { out.push({ ...n, kapsam: 'kendi' }); continue }
    const alt = altlar.find(a => kendiNoktasi(n, a, new Set()))
    if (alt) out.push({ ...n, kapsam: 'ekip', ekiptenKim: alt.full_name })
  }
  return out
}

/** Noktaları cariye göre gruplar (cari adına göre sıralı) */
export function cariyeGoreGrupla<T extends V2Nokta>(noktalar: T[]): { cariAdi: string; cariKod: string; noktalar: T[] }[] {
  const m = new Map<string, { cariAdi: string; cariKod: string; noktalar: T[] }>()
  for (const n of noktalar) {
    const k = sadeAd(n.cariAdi)
    let g = m.get(k)
    if (!g) { g = { cariAdi: n.cariAdi, cariKod: n.cariKod, noktalar: [] }; m.set(k, g) }
    g.noktalar.push(n)
  }
  const gruplar = [...m.values()]
  for (const g of gruplar) g.noktalar.sort((a, b) => a.subeAdi.localeCompare(b.subeAdi, 'tr'))
  return gruplar.sort((a, b) => a.cariAdi.localeCompare(b.cariAdi, 'tr'))
}
