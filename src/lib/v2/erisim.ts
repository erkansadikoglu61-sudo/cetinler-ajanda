// v2 erişim anahtarı — kimler /v2'yi kullanabilir.
// ŞU AN: yalnızca yönetici. Geçiş kullanıcı onayıyla yapılır:
//  1) Pilot: V2_PILOT_KULLANICILAR'a birkaç kişinin profil adı eklenir.
//  2) Tam geçiş: V2_ACIK_ROLLER'e roller eklenir (ör. 'bsy', 'sup', 'jr', 'merch').
// v1 (/app) bu ayardan etkilenmez.

import { namesMatch } from '@/lib/sellout'

export const V2_ACIK_ROLLER: string[] = ['admin']

export const V2_PILOT_KULLANICILAR: string[] = []

export function v2Erisimi(rol: string, ad: string): boolean {
  return V2_ACIK_ROLLER.includes(rol) || V2_PILOT_KULLANICILAR.some(p => namesMatch(p, ad))
}
