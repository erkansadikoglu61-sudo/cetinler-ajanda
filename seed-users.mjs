/**
 * Çetinler Saha Ajandası — Kullanıcı Seed Scripti
 * Çalıştır: node seed-users.mjs
 *
 * SERVICE_ROLE_KEY gereklidir:
 * Supabase Dashboard → Settings → API Keys → Legacy → service_role → Reveal
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bkqbtabkgwoewpjwxyoy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('HATA: SUPABASE_SERVICE_ROLE_KEY env değişkeni gerekli!')
  console.error('Çalıştır: SUPABASE_SERVICE_ROLE_KEY=eyJ... node seed-users.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_PASSWORD = 'Cetinler2026!'

const USERS = [
  // Admin
  { email: 'erkan@cetinler.com', full_name: 'Erkan SADIKOĞLU', role: 'admin', color: '#083325' },

  // BSY'ler
  { email: 'atilla.yilmaz.bsy@cetinler.com', full_name: 'Atilla YILMAZ',      role: 'bsy', color: '#085041' },
  { email: 'burak.kilic@cetinler.com',        full_name: 'Burak KILIÇ',        role: 'bsy', color: '#1D6B4E' },
  { email: 'erdem.bozyel@cetinler.com',       full_name: 'Erdem BOZYEL',       role: 'bsy', color: '#993C1D' },
  { email: 'kemal.tunali@cetinler.com',       full_name: 'Kemal TUNALI',       role: 'bsy', color: '#3B6D11' },
  { email: 'mehmet.katirci@cetinler.com',     full_name: 'Mehmet KATIRCI',     role: 'bsy', color: '#854F0B' },
  { email: 'mustafa.cetinkaya@cetinler.com',  full_name: 'Mustafa CETİNKAYA', role: 'bsy', color: '#A32D2D' },
  { email: 'mutlu.topay@cetinler.com',        full_name: 'Mutlu TOPAY',        role: 'bsy', color: '#534AB7' },
  { email: 'okan.uguz@cetinler.com',          full_name: 'Okan UĞUZ',          role: 'bsy', color: '#185FA5' },
  { email: 'orcun.soyubitmez@cetinler.com',   full_name: 'Orçun SOYUBİTMEZ',  role: 'bsy', color: '#6B3FA0' },

  // Süpervizörler
  { email: 'atilla.yilmaz.sup@cetinler.com',  full_name: 'Atilla Yılmaz',   role: 'sup', color: '#0C447C' },
  { email: 'burak.alagoz@cetinler.com',        full_name: 'Burak Alagöz',    role: 'sup', color: '#533AB7' },
  { email: 'pinar.guler@cetinler.com',         full_name: 'Pınar Güler',     role: 'sup', color: '#7F77DD' },
  { email: 'sinem.bektas@cetinler.com',        full_name: 'Sinem Bektaş',    role: 'sup', color: '#D85A30' },
  { email: 'songul.durukan@cetinler.com',      full_name: 'Songül Durukan',  role: 'sup', color: '#378ADD' },
  { email: 'yeni.supervizor@cetinler.com',     full_name: 'Yeni Süpervizör', role: 'sup', color: '#059669' },

  // Jr. Süpervizörler
  { email: 'duygu.duman@cetinler.com',     full_name: 'Duygu Duman',     role: 'jr', color: '#D4537E', manager_email: 'sinem.bektas@cetinler.com' },
  { email: 'nagihan.erdonmez@cetinler.com',full_name: 'Nagihan Erdönmez',role: 'jr', color: '#BA7517', manager_email: 'sinem.bektas@cetinler.com' },
  { email: 'merve.inci@cetinler.com',      full_name: 'Merve İnci',      role: 'jr', color: '#E24B4A', manager_email: 'sinem.bektas@cetinler.com' },
  { email: 'tugba.ayata@cetinler.com',     full_name: 'Tuğba Ayata',     role: 'jr', color: '#639922', manager_email: 'songul.durukan@cetinler.com' },
]

// BSY → Süpervizör bağlantıları
const BSY_LINKS = {
  'atilla.yilmaz.bsy@cetinler.com':  ['atilla.yilmaz.sup@cetinler.com'],
  'burak.kilic@cetinler.com':         ['pinar.guler@cetinler.com','sinem.bektas@cetinler.com','duygu.duman@cetinler.com','songul.durukan@cetinler.com','tugba.ayata@cetinler.com'],
  'erdem.bozyel@cetinler.com':        ['pinar.guler@cetinler.com','sinem.bektas@cetinler.com','duygu.duman@cetinler.com','nagihan.erdonmez@cetinler.com','songul.durukan@cetinler.com'],
  'kemal.tunali@cetinler.com':        ['burak.alagoz@cetinler.com','sinem.bektas@cetinler.com','nagihan.erdonmez@cetinler.com'],
  'mehmet.katirci@cetinler.com':      ['atilla.yilmaz.sup@cetinler.com','burak.alagoz@cetinler.com','pinar.guler@cetinler.com','sinem.bektas@cetinler.com','duygu.duman@cetinler.com','merve.inci@cetinler.com','nagihan.erdonmez@cetinler.com','songul.durukan@cetinler.com'],
  'mustafa.cetinkaya@cetinler.com':   ['pinar.guler@cetinler.com','sinem.bektas@cetinler.com','duygu.duman@cetinler.com','songul.durukan@cetinler.com'],
  'mutlu.topay@cetinler.com':         ['burak.alagoz@cetinler.com','pinar.guler@cetinler.com','sinem.bektas@cetinler.com','duygu.duman@cetinler.com','merve.inci@cetinler.com','nagihan.erdonmez@cetinler.com','songul.durukan@cetinler.com'],
  'okan.uguz@cetinler.com':           ['pinar.guler@cetinler.com','songul.durukan@cetinler.com','tugba.ayata@cetinler.com'],
  'orcun.soyubitmez@cetinler.com':    ['burak.alagoz@cetinler.com','sinem.bektas@cetinler.com','nagihan.erdonmez@cetinler.com','songul.durukan@cetinler.com'],
}

async function main() {
  console.log('🚀 Kullanıcılar oluşturuluyor...\n')

  const emailToId = {}

  // 1. Auth kullanıcılarını oluştur
  for (const u of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    })

    if (error) {
      if (error.message.includes('already registered')) {
        // Mevcut kullanıcıyı bul
        const { data: list } = await supabase.auth.admin.listUsers()
        const existing = list?.users?.find(x => x.email === u.email)
        if (existing) {
          emailToId[u.email] = existing.id
          console.log(`⚠️  Mevcut: ${u.full_name} (${u.email})`)
        }
      } else {
        console.error(`❌ HATA ${u.email}: ${error.message}`)
      }
    } else {
      emailToId[u.email] = data.user.id
      console.log(`✅ Oluşturuldu: ${u.full_name} (${u.email})`)
    }
  }

  console.log('\n📋 Profiller ekleniyor...')

  // 2. Profiles tablosuna ekle
  for (const u of USERS) {
    const uid = emailToId[u.email]
    if (!uid) { console.error(`⚠️  UID bulunamadı: ${u.email}`); continue }

    const managerId = u.manager_email ? emailToId[u.manager_email] : null

    const { error } = await supabase.from('profiles').upsert({
      id: uid,
      full_name: u.full_name,
      role: u.role,
      color: u.color,
      manager_id: managerId,
      email: u.email,
    })

    if (error) {
      console.error(`❌ Profil hatası ${u.full_name}: ${error.message}`)
    } else {
      console.log(`✅ Profil: ${u.full_name} [${u.role}]`)
    }
  }

  console.log('\n🔗 BSY bağlantıları ekleniyor...')

  // 3. BSY bağlantılarını ekle
  for (const [bsyEmail, supEmails] of Object.entries(BSY_LINKS)) {
    const bsyId = emailToId[bsyEmail]
    if (!bsyId) continue

    for (const supEmail of supEmails) {
      const supId = emailToId[supEmail]
      if (!supId) continue

      const { error } = await supabase.from('bsy_supervisors').upsert({
        bsy_id: bsyId,
        sup_id: supId,
      })

      if (error && !error.message.includes('duplicate')) {
        console.error(`❌ BSY link hatası: ${bsyEmail} → ${supEmail}: ${error.message}`)
      }
    }
    console.log(`✅ BSY bağlantıları: ${bsyEmail.split('@')[0]}`)
  }

  console.log('\n🎉 Tamamlandı!')
  console.log(`\n📧 Tüm kullanıcıların şifresi: ${DEFAULT_PASSWORD}`)
  console.log('   Kullanıcılar ilk girişte şifrelerini değiştirebilir.')
}

main().catch(console.error)
