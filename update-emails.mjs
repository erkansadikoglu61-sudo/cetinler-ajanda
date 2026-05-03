import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bkqbtabkgwoewpjwxyoy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Eski e-posta → Yeni e-posta
const EMAIL_MAP = [
  { old: 'erkan@cetinler.com',              newEmail: 'erkan@cetinlerltd.com.tr' },
  { old: 'burak.kilic@cetinler.com',        newEmail: 'burakkilic@cetinlerltd.com.tr' },
  { old: 'erdem.bozyel@cetinler.com',       newEmail: 'erdem@cetinlerltd.com.tr' },
  { old: 'orcun.soyubitmez@cetinler.com',   newEmail: 'orcun@cetinlerltd.com.tr' },
  { old: 'kemal.tunali@cetinler.com',       newEmail: 'kemal@cetinlerltd.com.tr' },
  { old: 'mustafa.cetinkaya@cetinler.com',  newEmail: 'mustafa@cetinlerltd.com.tr' },
  { old: 'mehmet.katirci@cetinler.com',     newEmail: 'mehmet@cetinlerltd.com.tr' },
  { old: 'mutlu.topay@cetinler.com',        newEmail: 'mutlu@cetinlerltd.com.tr' },
  { old: 'okan.uguz@cetinler.com',          newEmail: 'okan@cetinlerltd.com.tr' },
  { old: 'atilla.yilmaz.bsy@cetinler.com', newEmail: 'atilla@cetinlerltd.com.tr' },
  { old: 'burak.alagoz@cetinler.com',       newEmail: 'burak.alagoz@cetinlerltd.com.tr' },
  { old: 'nagihan.erdonmez@cetinler.com',   newEmail: 'nagihan.erdonmez@cetinlerltd.com.tr' },
  { old: 'duygu.duman@cetinler.com',        newEmail: 'duygu.duman@cetinlerltd.com.tr' },
  { old: 'gulcan.bayer@cetinler.com',       newEmail: 'gulcan.bayer@cetinlerltd.com.tr' },
  { old: 'songul.durukan@cetinler.com',     newEmail: 'songul@cetinlerltd.com.tr' },
  { old: 'sinem.bektas@cetinler.com',       newEmail: 'sinem@cetinlerltd.com.tr' },
  { old: 'tugba.ayata@cetinler.com',        newEmail: 'tugba.ayata@cetinlerltd.com.tr' },
  { old: 'merve.inci@cetinler.com',         newEmail: 'merve.inci@cetinlerltd.com.tr' },
]

async function main() {
  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailToUid = Object.fromEntries(allUsers.map(u => [u.email, u.id]))

  console.log('📧 E-posta adresleri güncelleniyor...\n')

  for (const { old: oldEmail, newEmail } of EMAIL_MAP) {
    const uid = emailToUid[oldEmail]
    if (!uid) {
      // Belki zaten güncellenmiş
      const alreadyNew = emailToUid[newEmail]
      if (alreadyNew) {
        console.log(`✅ Zaten güncel: ${newEmail}`)
      } else {
        console.log(`⚠️  Bulunamadı: ${oldEmail}`)
      }
      continue
    }

    // Auth email güncelle
    const { error: authErr } = await supabase.auth.admin.updateUserById(uid, {
      email: newEmail,
      email_confirm: true,
    })
    if (authErr) {
      console.error(`❌ Auth hatası ${oldEmail}: ${authErr.message}`)
      continue
    }

    // Profiles email güncelle
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', uid)
    if (profErr) {
      console.error(`❌ Profil hatası ${oldEmail}: ${profErr.message}`)
    } else {
      console.log(`✅ ${oldEmail.padEnd(38)} → ${newEmail}`)
    }
  }

  console.log('\n📋 Güncel kullanıcı listesi:\n')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('full_name, role, email')
    .order('role').order('full_name')

  const roleLabel = { admin: 'Yönetici', bsy: 'BSY', sup: 'Süpervizör', jr: 'Jr. Süp' }
  for (const p of profiles ?? []) {
    console.log(`  ${(roleLabel[p.role] ?? p.role).padEnd(12)} | ${(p.full_name ?? '').padEnd(22)} | ${p.email}`)
  }

  console.log('\n🎉 Tamamlandı!')
}

main().catch(console.error)
