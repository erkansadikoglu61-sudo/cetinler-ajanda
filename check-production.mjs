import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bkqbtabkgwoewpjwxyoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWJ0YWJrZ3dvZXdwand4eW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTI4MjQsImV4cCI6MjA5MzM2ODgyNH0.WUNWp-IQ3U-uGVJgBlKoEWsdj9uNWhJ_FogTBuj_IpM'
)

// Push token kontrolü
const { data: users } = await supabase
  .from('profiles')
  .select('full_name, push_token')
  .in('full_name', ['Erkan SADIKOĞLU', 'Sinem Bektaş'])

console.log('📱 Push Token Durumu:')
users.forEach(u => {
  console.log(`${u.push_token ? '✅' : '❌'} ${u.full_name}`)
})

// İstanbul AVM görevi kime ait?
const { data: tasks } = await supabase
  .from('tasks')
  .select('id, date, customer, pid, profiles(full_name)')
  .eq('date', '2026-06-12')
  .ilike('customer', '%istanbul%')
  .limit(5)

console.log('\n🗓️ İstanbul AVM Görevleri (12 Haziran):')
tasks.forEach(t => {
  console.log(`- ${t.customer} → ${t.profiles?.full_name}`)
})
