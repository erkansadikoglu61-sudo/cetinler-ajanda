import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bkqbtabkgwoewpjwxyoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWJ0YWJrZ3dvZXdwand4eW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTI4MjQsImV4cCI6MjA5MzM2ODgyNH0.WUNWp-IQ3U-uGVJgBlKoEWsdj9uNWhJ_FogTBuj_IpM'
)

// Son notlar
const { data: notes, error } = await supabase
  .from('task_notes')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3)

console.log('Son 3 not:')
if (error) {
  console.log('Hata:', error)
} else {
  notes.forEach(n => console.log(`- "${n.text}" (${n.created_at})`))
}

// Erkan kullanıcıları
const { data: erkans } = await supabase
  .from('profiles')
  .select('id, full_name, push_token')
  .eq('full_name', 'Erkan SADIKOĞLU')

console.log('\nErkan kullanıcıları:')
erkans.forEach(e => {
  console.log(`ID: ${e.id.substring(0,8)} - Token: ${e.push_token ? 'VAR' : 'YOK'}`)
})
