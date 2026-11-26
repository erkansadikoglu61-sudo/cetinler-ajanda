// v2 — ağır hesaplar için kalıcı önbellek (bellek + Supabase Storage, gzip JSON).
// İlk açılışta (soğuk sunucu) bile son hesap Storage'dan hemen döner; süresi
// geçmişse yanıt gönderildikten sonra arka planda yeniden hesaplanır.
// `imza` girdilerin özeti (ör. hedefler): imza değişirse eski kayıt kullanılmaz,
// hemen yeniden hesaplanır — hedef girince sonuç anında güncellenir.
import { after } from 'next/server'
import { gzipSync, gunzipSync } from 'zlib'
import { createHash } from 'crypto'
import { servisIstemcisi } from '@/lib/v2/sunucu'

const BUCKET = 'bsy-excel'
const bellek = new Map<string, { at: number; imza: string; veri: unknown }>()
const yenileniyor = new Set<string>()

const yol = (ad: string) => `v2-cache/${createHash('sha1').update(ad).digest('hex').slice(0, 24)}.json.gz`

export function imzala(x: unknown): string {
  return createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16)
}

async function oku(ad: string): Promise<{ at: number; imza: string; veri: unknown } | null> {
  try {
    const { data, error } = await servisIstemcisi().storage.from(BUCKET).download(yol(ad))
    if (error || !data) return null
    return JSON.parse(gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf-8'))
  } catch {
    return null
  }
}

async function yaz(ad: string, kayit: { at: number; imza: string; veri: unknown }): Promise<void> {
  try {
    await servisIstemcisi().storage.from(BUCKET).upload(yol(ad), gzipSync(Buffer.from(JSON.stringify(kayit), 'utf-8')), {
      upsert: true, contentType: 'application/gzip', cacheControl: '0',
    })
  } catch { /* önbellek yazılamazsa sorun değil */ }
}

function sonra(fn: () => Promise<void>) {
  try { after(fn) } catch { void fn() }
}

export async function kaliciOnbellek<T>(ad: string, imza: string, tazeMs: number, hesapla: () => Promise<T>): Promise<T> {
  const m = bellek.get(ad)
  if (m && m.imza === imza && Date.now() - m.at < tazeMs) return m.veri as T

  const hesaplaVeKaydet = async (): Promise<T> => {
    const veri = await hesapla()
    const kayit = { at: Date.now(), imza, veri }
    bellek.set(ad, kayit)
    sonra(() => yaz(ad, kayit))
    return veri
  }

  const k = m && m.imza === imza ? m : await oku(ad)
  if (k && k.imza === imza) {
    bellek.set(ad, k)
    if (Date.now() - k.at >= tazeMs && !yenileniyor.has(ad)) {
      yenileniyor.add(ad)
      sonra(async () => {
        try { await hesaplaVeKaydet() } catch { /* eski kayıt kalır */ } finally { yenileniyor.delete(ad) }
      })
    }
    return k.veri as T
  }
  return hesaplaVeKaydet()
}
