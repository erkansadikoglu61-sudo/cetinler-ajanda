// Şube yetkisi (sunucu): merch personeli olmayan şubelerin süpervizör / Jr ataması.
// Kaynaklar (birlikte):
//  1. B2B export_bsy_cari_sube.php — rapora SUPERVIZOR / JR_SUPERVIZOR kolonları eklenirse
//     otomatik okunur (başlık adına göre; şu an yoksa boş geçer)
//  2. Supabase sube_yetki — yöneticinin uygulamada elle yaptığı atamalar
// Merch-detay'dan gelen atamalar her zaman önceliklidir; bunlar yalnızca eksiği tamamlar.

import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'

export const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'

export interface SubeYetki {
  sube_kod: string
  cari_adi: string
  sube_adi: string
  sup_adi: string
  jr_adi: string
  bsy_kod: string
  bsy_adi: string
  kaynak: 'b2b' | 'elle'
}

function deger(r: Record<string, string>, ...adlar: string[]): string {
  for (const a of adlar) {
    const v = (r[a] ?? '').trim()
    if (v) return v
  }
  return ''
}

/** Cari-şube raporundaki satırlardan (varsa) süpervizör / Jr atamaları */
export function cariSubeYetkileri(csRows: Record<string, string>[]): SubeYetki[] {
  const out: SubeYetki[] = []
  for (const r of csRows) {
    const sube_kod = deger(r, 'SUBE_KOD', 'SUBE_KODU')
    const sup = deger(r, 'SUPERVIZOR', 'SUPERVIZOR_ADI', 'SUP_ADI')
    const jr = deger(r, 'JR_SUPERVIZOR', 'JR_SUPERVIZOR_ADI', 'JR_ADI')
    if (!sube_kod || (!sup && !jr)) continue
    out.push({
      sube_kod, cari_adi: deger(r, 'CARI_ADI', 'CARI_ISIM'), sube_adi: deger(r, 'SUBE_ADI'),
      sup_adi: sup, jr_adi: jr, bsy_kod: deger(r, 'BSY_KODU'), bsy_adi: deger(r, 'BSY_ADI'), kaynak: 'b2b',
    })
  }
  return out
}

/** Elle yapılan atamalar (tablo yoksa boş) */
export async function elleYetkiler(): Promise<SubeYetki[]> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    const { data, error } = await sb.from('sube_yetki').select('sube_kod, cari_adi, sube_adi, sup_adi, jr_adi')
    if (error) return []
    return (data ?? [])
      .filter(r => r.sube_kod && (r.sup_adi || r.jr_adi))
      .map(r => ({
        sube_kod: r.sube_kod, cari_adi: r.cari_adi ?? '', sube_adi: r.sube_adi ?? '',
        sup_adi: r.sup_adi ?? '', jr_adi: r.jr_adi ?? '', bsy_kod: '', bsy_adi: '', kaynak: 'elle' as const,
      }))
  } catch {
    return []
  }
}

/** Tüm ek şube yetkileri (B2B cari-şube kolonları + elle). csRows verilmezse rapor çekilir. */
export async function subeYetkileri(csRows?: Record<string, string>[]): Promise<SubeYetki[]> {
  const [cs, elle] = await Promise.all([
    csRows ? Promise.resolve(csRows) : fetchPhpHtml(CARI_SUBE_URL).then(h => parseHtmlTableByHeader(h).rows).catch(() => []),
    elleYetkiler(),
  ])
  // Aynı şube için elle atama B2B kolonundan önce gelir (yönetici bilerek atadı)
  const m = new Map<string, SubeYetki>()
  for (const y of cariSubeYetkileri(cs)) m.set(y.sube_kod, y)
  for (const y of elle) {
    const b = m.get(y.sube_kod)
    m.set(y.sube_kod, { ...y, bsy_kod: b?.bsy_kod ?? '', bsy_adi: b?.bsy_adi ?? '', cari_adi: y.cari_adi || b?.cari_adi || '', sube_adi: y.sube_adi || b?.sube_adi || '' })
  }
  return [...m.values()]
}
