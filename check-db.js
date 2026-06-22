const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  // Tahsilat planı girişlerini kontrol et
  const { data: tahsilat } = await sb
    .from('tahsilat_planim')
    .select('bsy_adi')
    .eq('yil', 2026)
    .eq('ay', 6);
  
  const uniqueBsy = [...new Set(tahsilat?.map(t => t.bsy_adi) || [])].sort();
  console.log('\n📊 Tahsilat Planı Tablosundaki BSY Adları:');
  uniqueBsy.forEach(bsy => console.log(`  - ${bsy}`));
  
  // Profiles tablosundan BSY'leri al
  const { data: profiles } = await sb
    .from('profiles')
    .select('full_name, role')
    .eq('role', 'bsy')
    .order('full_name');
  
  console.log('\n👥 Profiles Tablosundaki BSY\'ler:');
  profiles?.forEach(p => console.log(`  - ${p.full_name} (${p.role})`));
}

checkData();
