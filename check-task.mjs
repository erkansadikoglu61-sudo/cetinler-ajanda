import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bkqbtabkgwoewpjwxyoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWJ0YWJrZ3dvZXdwand4eW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTI4MjQsImV4cCI6MjA5MzM2ODgyNH0.WUNWp-IQ3U-uGVJgBlKoEWsdj9uNWhJ_FogTBuj_IpM'
)

// Son eklenen notları göster
const { data: notes } = await supabase
  .from('task_notes')
  .select('created_at, text, tasks(customer, date, pid, profiles(full_name, push_token))')
  .order('created_at', { ascending: false })
  .limit(3)

console.log('📝 Son Eklenen Notlar:\n')
notes.forEach(n => {
  const task = n.tasks
  const owner = task?.profiles
  console.log(`Not: "${n.text}"`)
  console.log(`Görev: ${task?.customer} (${task?.date})`)
  console.log(`Görev Sahibi: ${owner?.full_name}`)
  console.log(`Push Token: ${owner?.push_token ? 'VAR ✅' : 'YOK ❌'}`)
  console.log(`Zaman: ${n.created_at}\n`)
})
