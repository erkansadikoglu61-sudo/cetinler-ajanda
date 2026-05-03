import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bkqbtabkgwoewpjwxyoy.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const byEmail = Object.fromEntries(allUsers.map(u => [u.email, u.id]))

  // ── 1. Atilla Yılmaz: BSY → SUP rolüne al ──────────────────────────
  console.log('🔄 Atilla Yılmaz: BSY → Süpervizör...')

  const atillaId = byEmail['atilla@cetinlerltd.com.tr']
  if (atillaId) {
    await supabase.from('profiles').update({ role: 'sup' }).eq('id', atillaId)
    // BSY bağlantılarından çıkar (bsy olarak kayıtlı linkler)
    await supabase.from('bsy_supervisors').delete().eq('bsy_id', atillaId)
    console.log('✅ Atilla Yılmaz → sup, BSY linkleri silindi')
  }

  // Eski SUP versiyonu (atilla.yilmaz.sup) varsa sil
  const atillaOldSupId = byEmail['atilla.yilmaz.sup@cetinler.com']
  if (atillaOldSupId) {
    await supabase.from('bsy_supervisors').delete().or(`bsy_id.eq.${atillaOldSupId},sup_id.eq.${atillaOldSupId}`)
    await supabase.from('task_notes').delete().eq('author_id', atillaOldSupId)
    await supabase.from('tasks').delete().eq('pid', atillaOldSupId)
    await supabase.from('profiles').delete().eq('id', atillaOldSupId)
    await supabase.auth.admin.deleteUser(atillaOldSupId)
    console.log('✅ Eski Atilla Yılmaz (sup) silindi')
  }

  // ── 2. Pınar Güler: email güncelle + şifre ekle ────────────────────
  console.log('\n🔄 Pınar Güler güncelleniyor...')
  const pinarOldId = byEmail['pinar.guler@cetinler.com']
  if (pinarOldId) {
    await supabase.auth.admin.updateUserById(pinarOldId, {
      email: 'pinar@cetinlerltd.com.tr',
      password: 'pinar9821',
      email_confirm: true,
    })
    await supabase.from('profiles').update({ email: 'pinar@cetinlerltd.com.tr' }).eq('id', pinarOldId)
    console.log('✅ Pınar Güler → pinar@cetinlerltd.com.tr, şifre: pinar9821')
  } else if (byEmail['pinar@cetinlerltd.com.tr']) {
    // Zaten doğru emailde, sadece şifreyi güncelle
    await supabase.auth.admin.updateUserById(byEmail['pinar@cetinlerltd.com.tr'], { password: 'pinar9821' })
    console.log('✅ Pınar Güler şifresi güncellendi')
  } else {
    // Yoksa oluştur
    const { data } = await supabase.auth.admin.createUser({
      email: 'pinar@cetinlerltd.com.tr',
      password: 'pinar9821',
      email_confirm: true,
    })
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: 'Pınar Güler',
        role: 'sup',
        color: '#7F77DD',
        email: 'pinar@cetinlerltd.com.tr',
      })
      console.log('✅ Pınar Güler oluşturuldu')
    }
  }

  // ── 3. Yeni Süpervizör (placeholder) sil ───────────────────────────
  console.log('\n🗑️  Yeni Süpervizör siliniyor...')
  const yeniId = byEmail['yeni.supervizor@cetinler.com']
  if (yeniId) {
    await supabase.from('bsy_supervisors').delete().or(`bsy_id.eq.${yeniId},sup_id.eq.${yeniId}`)
    await supabase.from('task_notes').delete().eq('author_id', yeniId)
    await supabase.from('tasks').delete().eq('pid', yeniId)
    await supabase.from('profiles').delete().eq('id', yeniId)
    await supabase.auth.admin.deleteUser(yeniId)
    console.log('✅ Yeni Süpervizör silindi')
  } else {
    console.log('⚠️  Yeni Süpervizör zaten yok')
  }

  // ── 4. Nihai liste ───────────────────────────────────────────────────
  console.log('\n📋 Güncel kullanıcı listesi:\n')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('full_name, role, email')
    .order('role').order('full_name')

  const roleLabel = { admin: 'Yönetici', bsy: 'BSY', sup: 'Süpervizör', jr: 'Jr. Süp' }
  for (const p of profiles ?? []) {
    console.log(`  ${(roleLabel[p.role] ?? p.role).padEnd(12)} | ${(p.full_name ?? '').padEnd(22)} | ${p.email}`)
  }

  console.log('\n🎉 Tamamlandı! Toplam:', profiles?.length, 'kullanıcı')
}

main().catch(console.error)
