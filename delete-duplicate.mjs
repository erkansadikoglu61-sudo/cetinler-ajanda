import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bkqbtabkgwoewpjwxyoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWJ0YWJrZ3dvZXdwand4eW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTI4MjQsImV4cCI6MjA5MzM2ODgyNH0.WUNWp-IQ3U-uGVJgBlKoEWsdj9uNWhJ_FogTBuj_IpM'
)

const bsyErkanId = '1a00615d-48ff-4a08-bf62-d1dde92c3e51'

console.log('BSY Erkan SADIKOĞLU siliniyor...')

const { error } = await supabase
  .from('profiles')
  .delete()
  .eq('id', bsyErkanId)

if (error) {
  console.log('❌ Hata:', error.message)
} else {
  console.log('✅ BSY Erkan SADIKOĞLU silindi!')
  
  // Kontrol et
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('full_name', 'Erkan SADIKOĞLU')
  
  console.log(`\nKalan Erkan sayısı: ${data.length}`)
}
