// Çetinler Merch kullanıcı hesapları (rol: 'merch') — ortak mantık.
// Kullananlar: /api/merch-hesaplari (Kullanıcılar ekranındaki admin butonu)
// ve scripts/create-merch-users.ts.
//
// Kaynak: B2B export_merch_detay.php — MERCH_TIPI = 'Çetinler Merch' ve şubesi
// atanmış (aktif) personel. Kullanıcı adı: ad.soyad@cetinlerltd.com.tr
// (Türkçe karakterler sadeleştirilir; birden çok ad noktayla birleşir).

import { randomInt } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'

const DOMAIN = 'cetinlerltd.com.tr'
const COLORS = ['#085041', '#1D6B4E', '#993C1D', '#3B6D11', '#854F0B', '#A32D2D', '#534AB7', '#185FA5', '#6B3FA0', '#0C447C']

const ascii = (s: string) => s
  .replace(/İ/g, 'I').replace(/I/g, 'i').toLowerCase()
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
  .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
  .replace(/[^a-z\s]/g, '').trim()

const emailOf = (name: string) => `${ascii(name).split(/\s+/).filter(Boolean).join('.')}@${DOMAIN}`

// Karışması kolay karakterler yok (0/O, 1/l/I)
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newPassword(): string {
  let p = ''
  for (let i = 0; i < 10; i++) p += ALPHABET[randomInt(ALPHABET.length)]
  return p
}

export interface MerchHesapPlan {
  hesaplar: { ad: string; email: string; mevcut: boolean }[]
  subesiz: string[]
}

/** Oluşturulacak hesap listesi (hiçbir şey oluşturmaz). */
export async function merchHesapPlani(sb: SupabaseClient): Promise<MerchHesapPlan> {
  const { rows } = parseHtmlTableByHeader(await fetchPhpHtml('https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php', { revalidateMs: 0 }))
  const names = new Map<string, string>()   // ascii(ad) → ad
  const subesiz = new Set<string>()
  for (const r of rows) {
    if (r['MERCH_TIPI'] !== 'Çetinler Merch') continue
    const ad = (r['MERCH_ADI'] || '').trim()
    if (!ad || ascii(ad) === 'merch') continue
    if (!(r['SUBE_KODU'] || '').trim()) { subesiz.add(ad); continue }
    if (!names.has(ascii(ad))) names.set(ascii(ad), ad)
  }
  for (const ad of names.values()) subesiz.delete(ad)

  const existing = new Set<string>()
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    data.users.forEach(u => u.email && existing.add(u.email.toLowerCase()))
    if (data.users.length < 1000) break
  }

  const hesaplar = [...names.values()].sort((a, b) => a.localeCompare(b, 'tr')).map(ad => ({ ad, email: emailOf(ad), mevcut: false }))
  // Aynı e-postaya düşen iki kişi olursa sonrakine numara ekle
  const seen = new Map<string, number>()
  for (const h of hesaplar) {
    const n = (seen.get(h.email) ?? 0) + 1
    seen.set(h.email, n)
    if (n > 1) h.email = h.email.replace('@', `${n}@`)
    h.mevcut = existing.has(h.email)
  }
  return { hesaplar, subesiz: [...subesiz].sort((a, b) => a.localeCompare(b, 'tr')) }
}

export interface MerchHesapSonuc {
  olusan: { ad: string; email: string; sifre: string }[]
  atlanan: string[]
  hata: { email: string; mesaj: string }[]
  subesiz: string[]
}

/** Eksik hesapları oluşturur. Var olan e-postalar atlanır (şifresi değişmez).
 *  Profil yazılamazsa oluşturulan auth kullanıcısı geri silinir. */
export async function merchHesaplariOlustur(sb: SupabaseClient): Promise<MerchHesapSonuc> {
  const plan = await merchHesapPlani(sb)
  const out: MerchHesapSonuc = { olusan: [], atlanan: [], hata: [], subesiz: plan.subesiz }
  for (const [i, h] of plan.hesaplar.entries()) {
    if (h.mevcut) { out.atlanan.push(h.email); continue }
    const sifre = newPassword()
    const { data, error } = await sb.auth.admin.createUser({ email: h.email, password: sifre, email_confirm: true })
    if (error || !data.user) { out.hata.push({ email: h.email, mesaj: error?.message ?? 'bilinmeyen hata' }); continue }
    const { error: pe } = await sb.from('profiles').upsert({
      id: data.user.id, full_name: h.ad, role: 'merch', color: COLORS[i % COLORS.length], email: h.email, manager_id: null,
    })
    if (pe) {
      await sb.auth.admin.deleteUser(data.user.id)
      out.hata.push({ email: h.email, mesaj: `profil yazılamadı: ${pe.message}` })
      continue
    }
    out.olusan.push({ ad: h.ad, email: h.email, sifre })
  }
  return out
}
