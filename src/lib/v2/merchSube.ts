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

/** Merch'in bağlı olduğu Jr / süpervizör adları (B2B şube kayıtlarından) */
export function merchinUstleri(noktalar: V2Nokta[], merch: V2Profil): { sups: string[]; jrs: string[] } {
  const sups = new Set<string>()
  const jrs = new Set<string>()
  for (const n of noktalar) {
    if (!n.cetinlerMerch.some(k => namesMatch(k.ad, merch.full_name))) continue
    n.sups.forEach(s => sups.add(s))
    n.jrs.forEach(j => jrs.add(j))
  }
  return { sups: [...sups], jrs: [...jrs] }
}

/**
 * Bu kullanıcı (ben) bu merch'in şubelerini değiştirebilir mi?
 * Merch'in kendisi, bağlı olduğu Jr / süpervizör (B2B kaydı ya da manager_id zinciri).
 * (Yönetici kontrolü çağıran tarafta.)
 */
export function merchiYonetebilir(
  ben: V2Profil,
  merch: V2Profil,
  profiller: V2Profil[],
  hamNoktalar: V2Nokta[],
  uygulanmisNoktalar: V2Nokta[],
): boolean {
  if (merch.role !== 'merch') return false
  if (ben.id === merch.id) return true
  if (ben.role !== 'sup' && ben.role !== 'jr') return false
  // manager_id zinciri (merch → jr → sup)
  let p: V2Profil | undefined = merch
  for (let i = 0; i < 3 && p?.manager_id; i++) {
    if (p.manager_id === ben.id) return true
    p = profiller.find(x => x.id === p!.manager_id)
  }
  // B2B şube kayıtları: merch'in (B2B'deki ya da seçtiği) şubelerinde sup / jr
  for (const liste of [hamNoktalar, uygulanmisNoktalar]) {
    const u = merchinUstleri(liste, merch)
    if ((ben.role === 'sup' ? u.sups : u.jrs).some(a => namesMatch(a, ben.full_name))) return true
  }
  return false
}
