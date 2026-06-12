import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bkqbtabkgwoewpjwxyoy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWJ0YWJrZ3dvZXdwand4eW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTI4MjQsImV4cCI6MjA5MzM2ODgyNH0.WUNWp-IQ3U-uGVJgBlKoEWsdj9uNWhJ_FogTBuj_IpM'
)

const { data: erkans } = await supabase
  .from('profiles')
  .select('id, full_name, email, role')
  .eq('full_name', 'Erkan SADIKOĞLU')

console.log('Kalan Erkan kayıtları:\n')
erkans.forEach(e => {
  console.log(`ID: ${e.id.substring(0,8)} - ${e.email} (${e.role})`)
})
