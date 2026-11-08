import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET   = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

/**
 * SAHA.xlsx'i Storage'dan en güncel haliyle indirir; dönüş şekli
 * `storage.download()` ile aynıdır.
 *
 * "Excel Güncelle" dosyayı aynı adla üzerine yazıyor; `download()` hep aynı URL'yi
 * çağırdığı için CDN'deki eski kopya dönebiliyor. Her istekte yeni imzalı URL
 * alınır, başarısız olursa klasik `download()`'a düşülür.
 */
export async function downloadBsyExcel(sb: SupabaseClient): Promise<{ data: Blob | null; error: unknown }> {
  try {
    const { data: signed, error } = await sb.storage.from(BUCKET).createSignedUrl(OBJ_NAME, 60)
    if (!error && signed?.signedUrl) {
      const sep = signed.signedUrl.includes('?') ? '&' : '?'
      const res = await fetch(`${signed.signedUrl}${sep}t=${Date.now()}`, {
        cache:   'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) return { data: await res.blob(), error: null }
      console.error('[bsyExcel] imzalı URL indirme hatası:', res.status)
    }
  } catch (e) {
    console.error('[bsyExcel] imzalı URL hatası:', e)
  }
  return sb.storage.from(BUCKET).download(OBJ_NAME)
}
