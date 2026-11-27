// v1 (/app) erişim anahtarı. v1 kapatıldı: yalnızca aşağıdaki kullanıcı(lar) girebilir,
// diğer herkes "erişim kapalı" ekranı görür. Yeniden açmak için V1_KAPALI = false yapın.
// (v2 erişimi ayrıdır: lib/v2/erisim.ts)
import { namesMatch } from '@/lib/sellout'

export const V1_KAPALI = true
export const V1_ACIK_KULLANICILAR = ['Erkan SADIKOĞLU']

export function v1Erisimi(p: { role: string; full_name: string }): boolean {
  if (!V1_KAPALI) return true
  return p.role === 'admin' && V1_ACIK_KULLANICILAR.some(a => namesMatch(a, p.full_name))
}
