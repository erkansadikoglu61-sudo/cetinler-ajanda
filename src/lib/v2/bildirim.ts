// v2 — telefona bildirim (Web Push). Abonelikler: v2_push_abonelik (v2_push_migration.sql).
// Gizli anahtar yalnızca Vercel ortam değişkeninde: VAPID_PRIVATE_KEY.
// Açık anahtar herkese açıktır (tarayıcı aboneliği için), kodda durur.

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BKHvI7YB2D5DX-LeUFP77lATlkfVCARKIc1RsOTlQhBUHNXevS21kiKsH8zHzpSzM0bOJznaAmCRSTTpqrZn9Ys'

export interface BildirimIcerik {
  baslik: string
  govde: string
  url?: string
}

let hazir: boolean | null = null
function kur(): boolean {
  if (hazir !== null) return hazir
  const gizli = process.env.VAPID_PRIVATE_KEY
  if (!gizli) { hazir = false; return false }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@cetinlerltd.com.tr', VAPID_PUBLIC_KEY, gizli)
  hazir = true
  return true
}

export function bildirimHazirMi(): boolean {
  return kur()
}

/** Kişilere bildirim gönderir; süresi dolmuş abonelikleri siler. Hata fırlatmaz. */
export async function bildirimGonder(sb: SupabaseClient, profilIdleri: string[], icerik: BildirimIcerik): Promise<number> {
  const idler = [...new Set(profilIdleri.filter(Boolean))]
  if (idler.length === 0 || !kur()) return 0
  const { data } = await sb.from('v2_push_abonelik').select('id, endpoint, p256dh, auth').in('profile_id', idler)
  const yuk = JSON.stringify({ baslik: icerik.baslik, govde: icerik.govde, url: icerik.url || '/v2' })
  let gonderilen = 0
  await Promise.all((data ?? []).map(async a => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, yuk, { TTL: 24 * 3600 })
      gonderilen++
    } catch (e) {
      const kod = (e as { statusCode?: number }).statusCode
      if (kod === 404 || kod === 410) await sb.from('v2_push_abonelik').delete().eq('id', a.id)
    }
  }))
  return gonderilen
}
