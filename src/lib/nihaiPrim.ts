// Nihai Prim Listesi — ortak tipler ve Sellout (Süpervizör/Jr/Çetinler Merch)
// prim hesabı. Sellout tarafı SelloutView'deki hesapla birebir aynı mantığı
// izler; nihai tabloda rakamların Sellout sayfasıyla tutması için buraya
// saf fonksiyon olarak alınmıştır.

import {
  SELLOUT_GROUPS, GRUP_NORMALIZE, PRIM_SUP, PRIM_JR, PRIM_MERCH,
  calcPrim, normalizeName,
} from '@/lib/sellout'
import type { Profile } from '@/lib/supabase'

export const NP_MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export type PrimTip = 'BSY' | 'Süpervizör' | 'Jr. Süpervizör' | 'Çetinler Merch'

export interface NihaiPrimRow {
  tip: PrimTip
  ad: string
  aylar: Record<number, number>   // 1..12 → prim
  // Görünürlük meta:
  selfProfileId?: string          // BSY/Süpervizör/Jr için kendi profil id
  ownerSupAd?: string             // Jr/Merch → bağlı olduğu süpervizör adı
  ownerJrAd?: string              // Merch → bağlı olduğu Jr adı (varsa)
}

// Sellout satırının nihai prim için ihtiyaç duyulan alanları
export interface NPSelloutRow {
  merch_personel: string
  supervisor_adi: string
  grup_aciklama:  string
  satilan_adet:   number
  merch_tipi:     string
  cari_isim?:     string
  sube_adi?:      string
}

export interface NPProfileTarget { profile_id: string; grup: string; hedef: number }
export interface NPMerchTarget   { merch_name: string;  grup: string; hedef: number }
export interface NPMerchDetay {
  merch_adi: string; merch_grubu: string; sup_adi: string; jr_adi: string
}

/**
 * Bir dönemin (tek ay) satır verisi + hedefleri üzerinden Süpervizör, Jr ve
 * Çetinler Merch prim hakedişlerini hesaplar. Her kişi için o ayın toplam
 * primini döndürür ({tip, ad, prim, meta}).
 */
export function computeSelloutPrimForMonth(params: {
  periodRows: NPSelloutRow[]
  profileTargets: NPProfileTarget[]
  merchTargets: NPMerchTarget[]
  merchDetay: NPMerchDetay[]
  team: Profile[]
}): Array<{ tip: PrimTip; ad: string; prim: number; selfProfileId?: string; ownerSupAd?: string; ownerJrAd?: string }> {
  const { periodRows, profileTargets, merchTargets, merchDetay, team } = params

  const getProfileHedef = (profileId: string, grup: string) =>
    profileTargets.find(t => t.profile_id === profileId && t.grup === grup)?.hedef ?? 0
  const getMerchHedef = (merchName: string, grup: string) =>
    merchTargets.find(t => t.merch_name === merchName && t.grup === grup)?.hedef ?? 0

  const getGerc = (apiNames: string[], grup: string): number => {
    const norm = apiNames.map(normalizeName)
    return periodRows
      .filter(r =>
        norm.includes(normalizeName(r.supervisor_adi)) &&
        GRUP_NORMALIZE[r.grup_aciklama] === grup
      )
      .reduce((s, r) => s + r.satilan_adet, 0)
  }

  const out: Array<{ tip: PrimTip; ad: string; prim: number; selfProfileId?: string; ownerSupAd?: string; ownerJrAd?: string }> = []

  const sups = team.filter(p => p.role === 'sup')
  const jrs  = team.filter(p => p.role === 'jr')

  // ── Süpervizör ──
  for (const sup of sups) {
    const myJrs = jrs.filter(j => j.manager_id === sup.id)
    const apiNames = [sup.full_name, ...myJrs.map(j => j.full_name)]
    let tPrim = 0
    for (const g of SELLOUT_GROUPS) {
      const h = getProfileHedef(sup.id, g)
      const v = getGerc(apiNames, g)
      tPrim += calcPrim(h, v, PRIM_SUP[g])
    }
    out.push({ tip: 'Süpervizör', ad: sup.full_name, prim: tPrim, selfProfileId: sup.id })
  }

  // ── Jr. Süpervizör ──
  for (const jr of jrs) {
    const sup = team.find(p => p.id === jr.manager_id)
    let tPrim = 0
    for (const g of SELLOUT_GROUPS) {
      const h = getProfileHedef(jr.id, g)
      const v = getGerc([jr.full_name], g)
      tPrim += calcPrim(h, v, PRIM_JR[g])
    }
    out.push({ tip: 'Jr. Süpervizör', ad: jr.full_name, prim: tPrim, selfProfileId: jr.id, ownerSupAd: sup?.full_name })
  }

  // ── Çetinler Merch ──
  // Unique merch listesi: satış yapanlar (periodRows) + merch-detay'daki tümü
  const merchMeta = new Map<string, { supAd: string; jrAd: string }>()
  for (const m of merchDetay) {
    if (m.merch_grubu === 'Çetinler Merch' && m.merch_adi && !merchMeta.has(m.merch_adi)) {
      merchMeta.set(m.merch_adi, { supAd: m.sup_adi || '', jrAd: m.jr_adi || '' })
    }
  }
  const merchNames = new Set<string>()
  for (const r of periodRows) {
    if (r.merch_tipi === 'Çetinler Merch' && r.merch_personel) merchNames.add(r.merch_personel)
  }
  for (const name of merchMeta.keys()) merchNames.add(name)

  for (const name of merchNames) {
    let tPrim = 0
    for (const g of SELLOUT_GROUPS) {
      const h = getMerchHedef(name, g)
      const v = periodRows
        .filter(r => r.merch_personel === name && GRUP_NORMALIZE[r.grup_aciklama] === g)
        .reduce((s, r) => s + r.satilan_adet, 0)
      tPrim += calcPrim(h, v, PRIM_MERCH[g])
    }
    const meta = merchMeta.get(name)
    out.push({ tip: 'Çetinler Merch', ad: name, prim: tPrim, ownerSupAd: meta?.supAd, ownerJrAd: meta?.jrAd })
  }

  return out
}
