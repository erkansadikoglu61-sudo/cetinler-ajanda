import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bkqbtabkgwoewpjwxyoy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Kullanıcı adı → { email, şifre, yeni kullanıcıysa bilgileri }
const UPDATES = [
  { email: 'erkan@cetinler.com',              password: 'erkan2003'   },
  { email: 'burak.kilic@cetinler.com',        password: 'burak5246'   },
  { email: 'erdem.bozyel@cetinler.com',       password: 'erdem4843'   },
  { email: 'orcun.soyubitmez@cetinler.com',   password: 'orcun5464'   },
  { email: 'kemal.tunali@cetinler.com',       password: 'kemal5925'   },
  { email: 'mustafa.cetinkaya@cetinler.com',  password: 'mustafa2322' },
  { email: 'mehmet.katirci@cetinler.com',     password: 'mehmet6899'  },
  { email: 'mutlu.topay@cetinler.com',        password: 'mutlu7687'   },
  { email: 'okan.uguz@cetinler.com',          password: 'okan7877'    },
  // Atilla Yılmaz — hem BSY hem Süp versiyonu
  { email: 'atilla.yilmaz.bsy@cetinler.com', password: 'atilla2737'  },
  { email: 'atilla.yilmaz.sup@cetinler.com', password: 'atilla2737'  },
  { email: 'burak.alagoz@cetinler.com',       password: 'burak5675'   },
  { email: 'nagihan.erdonmez@cetinler.com',   password: 'nagihan1757' },
  { email: 'duygu.duman@cetinler.com',        password: 'duygu6117'   },
  { email: 'songul.durukan@cetinler.com',     password: 'songul5579'  },
  { email: 'sinem.bektas@cetinler.com',       password: 'sinem9045'   },
  { email: 'tugba.ayata@cetinler.com',        password: 'tugba3492'   },
  { email: 'merve.inci@cetinler.com',         password: 'merve1257'   },
]

// Yeni kullanıcı: Gülcan Bayer (Süpervizör)
const NEW_USER = {
  email:     'gulcan.bayer@cetinler.com',
  password:  'gulcan2894',
  full_name: 'Gülcan Bayer',
  role:      'sup',
  color:     '#D4537E',
}

async function main() {
  // Tüm mevcut auth kullanıcılarını yükle
  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailToUid = Object.fromEntries(allUsers.map(u => [u.email, u.id]))

  console.log('🔑 Şifreler güncelleniyor...\n')

  for (const u of UPDATES) {
    const uid = emailToUid[u.email]
    if (!uid) {
      console.log(`⚠️  Bulunamadı (atlandı): ${u.email}`)
      continue
    }
    const { error } = await supabase.auth.admin.updateUserById(uid, { password: u.password })
    if (error) {
      console.error(`❌ ${u.email}: ${error.message}`)
    } else {
      console.log(`✅ Şifre güncellendi: ${u.email}`)
    }
  }

  console.log('\n➕ Gülcan Bayer oluşturuluyor...')

  let gulcanId = emailToUid[NEW_USER.email]

  if (gulcanId) {
    // Mevcut kullanıcının şifresini güncelle
    await supabase.auth.admin.updateUserById(gulcanId, { password: NEW_USER.password })
    console.log('⚠️  Gülcan Bayer zaten mevcut, şifre güncellendi.')
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: NEW_USER.email,
      password: NEW_USER.password,
      email_confirm: true,
    })
    if (error) {
      console.error(`❌ Gülcan Bayer oluşturulamadı: ${error.message}`)
    } else {
      gulcanId = data.user.id
      console.log(`✅ Gülcan Bayer oluşturuldu: ${gulcanId}`)
    }
  }

  if (gulcanId) {
    const { error } = await supabase.from('profiles').upsert({
      id:        gulcanId,
      full_name: NEW_USER.full_name,
      role:      NEW_USER.role,
      color:     NEW_USER.color,
      email:     NEW_USER.email,
    })
    if (error) console.error(`❌ Profil hatası: ${error.message}`)
    else console.log('✅ Gülcan Bayer profili eklendi [sup]')
  }

  // Merve İnci rolünü jr olarak garantile
  console.log('\n🔄 Merve İnci rolü kontrol ediliyor...')
  const merveId = emailToUid['merve.inci@cetinler.com']
  if (merveId) {
    await supabase.from('profiles').update({ role: 'jr' }).eq('id', merveId)
    console.log('✅ Merve İnci: jr olarak doğrulandı')
  }

  console.log('\n📋 Güncel kullanıcı listesi:\n')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('full_name, role, email')
    .order('role')
    .order('full_name')

  const roleLabel = { admin: 'Yönetici', bsy: 'BSY', sup: 'Süpervizör', jr: 'Jr. Süpervizör' }
  for (const p of profiles ?? []) {
    console.log(`  ${roleLabel[p.role]?.padEnd(14)} | ${p.full_name?.padEnd(22)} | ${p.email}`)
  }

  console.log('\n🎉 Tüm güncellemeler tamamlandı!')
  console.log('\n💡 Şifre sıfırlama: Kullanıcılar http://localhost:3000/login → "Şifremi Unuttum" ile e-postalarına sıfırlama linki alabilir.')
}

main().catch(console.error)
