import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bkqbtabkgwoewpjwxyoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWJ0YWJrZ3dvZXdwand4eW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTI4MjQsImV4cCI6MjA5MzM2ODgyNH0.WUNWp-IQ3U-uGVJgBlKoEWsdj9uNWhJ_FogTBuj_IpM'
)

const { data: erkans } = await supabase
  .from('profiles')
  .select('id, full_name, email, role, created_at')
  .eq('full_name', 'Erkan SADIKOĞLU')

console.log('İki Erkan SADIKOĞLU kaydı:\n')
erkans.forEach((e, i) => {
  console.log(`${i+1}. Erkan:`)
  console.log(`   ID: ${e.id}`)
  console.log(`   Email: ${e.email || 'YOK'}`)
  console.log(`   Rol: ${e.role}`)
  console.log(`   Oluşturulma: ${e.created_at}\n`)
})

// Her birinin görev sayısı
for (const e of erkans) {
  const { count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('pid', e.id)
  
  console.log(`${e.id.substring(0,8)} - ${count} görev`)
}
