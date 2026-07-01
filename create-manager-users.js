// Manager kullanıcılarını Supabase'de oluşturmak için script
// Çalıştırmak için: node create-manager-users.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// .env.local dosyasını manuel parse et
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ .env.local dosyasında NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY bulunamadı!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const managers = [
  {
    email: 'hakancetinkaya@cetinlerltd.com.tr',
    password: 'hakan123',
    full_name: 'Hakan Çetinkaya',
    color: '#10B981'
  },
  {
    email: 'h.cetinkaya@cetinlerltd.com.tr',
    password: 'huseyin123',
    full_name: 'Hüseyin Çetinkaya',
    color: '#3B82F6'
  },
  {
    email: 'e.cetinkaya@cetinlerltd.com.tr',
    password: 'emir123',
    full_name: 'Emir Çetinkaya',
    color: '#8B5CF6'
  }
]

async function createManagers() {
  console.log('🚀 Manager kullanıcıları oluşturuluyor...\n')

  for (const manager of managers) {
    try {
      // 1. Auth kullanıcısı oluştur
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: manager.email,
        password: manager.password,
        email_confirm: true
      })

      if (authError) {
        console.error(`❌ ${manager.email} - Auth hatası:`, authError.message)
        continue
      }

      console.log(`✅ ${manager.email} - Auth kullanıcısı oluşturuldu (ID: ${authData.user.id})`)

      // 2. Profile oluştur
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: manager.full_name,
          role: 'manager',
          color: manager.color,
          email: manager.email
        })

      if (profileError) {
        console.error(`❌ ${manager.email} - Profile hatası:`, profileError.message)
        continue
      }

      console.log(`✅ ${manager.email} - Profile oluşturuldu`)
      console.log(`   İsim: ${manager.full_name}`)
      console.log(`   Rol: manager`)
      console.log(`   Şifre: ${manager.password}\n`)

    } catch (error) {
      console.error(`❌ ${manager.email} - Genel hata:`, error.message)
    }
  }

  console.log('✨ İşlem tamamlandı!')
}

createManagers()
