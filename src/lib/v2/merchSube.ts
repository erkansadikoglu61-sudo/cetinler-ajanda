// v2 — Çetinler Merch görev şubeleri (elle seçim, tablo: v2_merch_sube).
// Merch için seçim varsa B2B merch kaydındaki şubeler yerine seçilen şubeler
// esas alınır (Hesabım, Şubelerim, Ajanda). Prim / satış B2B'den gelmeye devam eder.
import type { SupabaseClient } from '@supabase/supabase-js'
import { namesMatch } from '@/lib/sellout'
import type { V2Nokta, V2Profil } from '@/lib/v2/nokta'

export interface MerchSubeKaydi {
  merch_id: string
  sube_key: string
  sube_kod: string | null
  cari_adi: string | null
  sube_adi: string | null
}

export function merchSubeTabloYok(msg: string, code?: string): boolean {
  return code === '42P01' || code === 'PGRST205' || (/v2_merch_sube/.test(msg) && /exist|find/i.test(msg))
}

/** Tüm elle seçimler: merch id → kayıtlar (tablo yoksa boş) */
export async function merchSubeSecimleri(sb: SupabaseClient): Promise<Map<string, MerchSubeKaydi[]>> {
  const m = new Map<string, MerchSubeKaydi[]>()
  const { data, error } = await sb.from('v2_merch_sube').select('merch_id, sube_key, sube_kod, cari_adi, sube_adi')
  if (error) return m
  for (const r of (data ?? []) as MerchSubeKaydi[]) {
    const l = m.get(r.merch_id) ?? []
    l.push(r)
    m.set(r.merch_id, l)
  }
  return m
}

/**
 * Elle seçimleri modele uygular (modeli değiştirmez, kopya döner):
 * seçimi olan merch tüm noktalardaki Çetinler Merch listesinden çıkarılır,
 * yalnızca seçtiği noktalara eklenir.
 */
export function merchSecimleriniUygula(
  noktalar: V2Nokta[],
  secimler: Map<string, MerchSubeKaydi[]>,
  profiller: V2Profil[],
): V2Nokta[] {
  if (secimler.size === 0) return noktalar
  const merchler = [...secimler.keys()]
    .map(id => profiller.find(p => p.id === id))
    .filter((p): p is V2Profil => !!p)
  if (merchler.length === 0) return noktalar
  const hedef = new Map<string, V2Profil[]>()
  for (const p of merchler) {
    for (const r of secimler.get(p.id) ?? []) {
      const l = hedef.get(r.sube_key) ?? []
      l.push(p)
      hedef.set(r.sube_key, l)
    }
  }
  return noktalar.map(n => {
    const eski = n.cetinlerMerch
    const kalan = eski.filter(k => !merchler.some(p => namesMatch(k.ad, p.full_name)))
    const eklenecek = hedef.get(n.key) ?? []
    if (kalan.length === eski.length && eklenecek.length === 0) return n
    const yeni = [...kalan]
    for (const p of eklenecek) {
      const onceki = eski.find(k => namesMatch(k.ad, p.full_name))
      yeni.push({ ad: onceki?.ad ?? p.full_name, merchId: onceki?.merchId })
    }
    return { ...n, cetinlerMerch: yeni }
  })
}

/** B2B merch kaydı (merch-detay): merch adı → süpervizör / Jr */
export interface MerchSahipKaydi { merch_adi: string; merch_grubu: string; sup_adi: string; jr_adi: string }

/** Merch'in bağlı olduğu Jr / süpervizör adları — merch'in KENDİ B2B kaydından
 *  (şubedeki diğer kayıtların süpervizörleri dahil değil) */
export function merchinUstleri(kayitlar: MerchSahipKaydi[], merch: V2Profil): { sups: string[]; jrs: string[] } {
  const sups = new Set<string>()
  const jrs = new Set<string>()
  for (const r of kayitlar) {
    if (r.merch_grubu !== 'Çetinler Merch' || !namesMatch(r.merch_adi, merch.full_name)) continue
    if (r.sup_adi) sups.add(r.sup_adi)
    if (r.jr_adi) jrs.add(r.jr_adi)
  }
  return { sups: [...sups], jrs: [...jrs] }
}

/**
 * Bu kullanıcı (ben) bu merch'in şubelerini değiştirebilir mi?
 * Merch'in kendisi; merch'in B2B kaydındaki Jr / süpervizör; manager_id zinciri
 * (merch → Jr → süpervizör); kaydındaki Jr'ın süpervizörü. (Yönetici kontrolü çağıran tarafta.)
 */
export function merchiYonetebilir(
  ben: V2Profil,
  merch: V2Profil,
  profiller: V2Profil[],
  kayitlar: MerchSahipKaydi[],
): boolean {
  if (merch.role !== 'merch') return false
  if (ben.id === merch.id) return true
  if (ben.role !== 'sup' && ben.role !== 'jr') return false
  let p: V2Profil | undefined = merch
  for (let i = 0; i < 3 && p?.manager_id; i++) {
    if (p.manager_id === ben.id) return true
    p = profiller.find(x => x.id === p!.manager_id)
  }
  const u = merchinUstleri(kayitlar, merch)
  if (ben.role === 'sup') {
    if (u.sups.some(a => namesMatch(a, ben.full_name))) return true
    // Kaydındaki Jr bana bağlıysa
    return u.jrs.some(j => profiller.some(x => x.role === 'jr' && namesMatch(x.full_name, j) && x.manager_id === ben.id))
  }
  return u.jrs.some(a => namesMatch(a, ben.full_name))
}
