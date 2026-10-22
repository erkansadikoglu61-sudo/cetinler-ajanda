// Çetinler Merch kullanıcılarını oluşturur (rol: 'merch').
//
// Kaynak: B2B export_merch_detay.php — MERCH_TIPI = 'Çetinler Merch' ve şubesi
// atanmış (aktif) personel. Kullanıcı adı: ad.soyad@cetinlerltd.com.tr
// (Türkçe karakterler sadeleştirilir; birden çok ad noktayla birleşir).
// Her kullanıcıya rastgele, birbirinden farklı şifre üretilir.
//
// Zaten var olan e-postalar ATLANIR (şifresi değiştirilmez).
// Şifreler yalnızca yerel CSV dosyasına yazılır: cetinler-merch-kullanicilar.csv
// (git'e girmez — .gitignore). Ekrana şifre yazılmaz.
//
// Önce kuru çalıştırma (hiçbir şey oluşturmaz, listeyi gösterir):
//   npx tsx --env-file=.env.local scripts/create-merch-users.ts --dry
// Oluşturmak için:
//   npx tsx --env-file=.env.local scripts/create-merch-users.ts

import { randomInt } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '../src/lib/merchSatis'

const DRY = process.argv.includes('--dry')
const DOMAIN = 'cetinlerltd.com.tr'
const OUT = 'cetinler-merch-kullanicilar.csv'
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY bulunamadı (--env-file=.env.local ile çalıştırın)')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  // 1) Aktif Çetinler Merch listesi (şubesi atanmış)
  const { rows } = parseHtmlTableByHeader(await fetchPhpHtml('https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php', { revalidateMs: 0 }))
  const names = new Map<string, string>()   // normalize(ad) → ad
  const subesiz = new Set<string>()
  for (const r of rows) {
    if (r['MERCH_TIPI'] !== 'Çetinler Merch') continue
    const ad = (r['MERCH_ADI'] || '').trim()
    if (!ad) continue
    if (!(r['SUBE_KODU'] || '').trim()) { subesiz.add(ad); continue }
    if (!names.has(ascii(ad))) names.set(ascii(ad), ad)
  }
  for (const ad of names.values()) subesiz.delete(ad)

  // 2) Mevcut kullanıcılar (e-posta) ve profiller
  const existingEmails = new Set<string>()
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    data.users.forEach(u => u.email && existingEmails.add(u.email.toLowerCase()))
    if (data.users.length < 1000) break
  }

  const plan = [...names.values()].sort((a, b) => a.localeCompare(b, 'tr')).map(ad => ({ ad, email: emailOf(ad) }))
  // Aynı e-postaya düşen iki kişi olursa sonrakine numara ekle
  const seen = new Map<string, number>()
  for (const p of plan) {
    const n = (seen.get(p.email) ?? 0) + 1
    seen.set(p.email, n)
    if (n > 1) p.email = p.email.replace('@', `${n}@`)
  }

  console.log(`Aktif Çetinler Merch: ${plan.length}  ·  şubesiz (atlandı): ${subesiz.size}`)
  if (subesiz.size) console.log('  Şubesiz:', [...subesiz].join(', '))

  if (DRY) {
    for (const p of plan) console.log(`  ${existingEmails.has(p.email) ? '[VAR]  ' : '[YENİ] '} ${p.ad.padEnd(28)} ${p.email}`)
    console.log('\nKuru çalıştırma — hiçbir şey oluşturulmadı.')
    return
  }

  const csv: string[] = ['Ad Soyad,Kullanıcı Adı (e-posta),Şifre']
  let olusan = 0, atlanan = 0, hata = 0
  for (const [i, p] of plan.entries()) {
    if (existingEmails.has(p.email)) { atlanan++; console.log(`  atlandı (zaten var): ${p.email}`); continue }
    const password = newPassword()
    const { data, error } = await sb.auth.admin.createUser({ email: p.email, password, email_confirm: true })
    if (error || !data.user) { hata++; console.log(`  HATA ${p.email}: ${error?.message}`); continue }
    const { error: pe } = await sb.from('profiles').upsert({
      id: data.user.id, full_name: p.ad, role: 'merch', color: COLORS[i % COLORS.length], email: p.email, manager_id: null,
    })
    if (pe) { hata++; console.log(`  PROFİL HATASI ${p.email}: ${pe.message}`); continue }
    csv.push(`"${p.ad}",${p.email},${password}`)
    olusan++
    console.log(`  oluşturuldu: ${p.email}`)
  }
  if (olusan) writeFileSync(OUT, '﻿' + csv.join('\n') + '\n')
  console.log(`\nOluşan: ${olusan} · Atlanan: ${atlanan} · Hata: ${hata}`)
  if (olusan) console.log(`Şifreler: ${OUT} (bu dosyayı güvenli yerde saklayın, paylaştıktan sonra silin)`)
}

main().catch(e => { console.error(e); process.exit(1) })
