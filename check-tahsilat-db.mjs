import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from('tahsilat_planim')
  .select('*')
  .eq('cari_kod', 'M34001240')
  .eq('yil', 2026)
  .eq('ay', 6);

console.log('\n📊 M34001240 için Tahsilat Planı Kaydı:');
if (error) {
  console.error('Hata:', error);
} else if (!data || data.length === 0) {
  console.log('❌ Kayıt bulunamadı!');
} else {
  console.log(JSON.stringify(data, null, 2));
}

// Tüm plan girişlerini göster
const { data: all } = await sb
  .from('tahsilat_planim')
  .select('bsy_adi, cari_kod, tahsilat_haftasi, tahsilat_turu')
  .eq('yil', 2026)
  .eq('ay', 6)
  .not('tahsilat_haftasi', 'is', null)
  .order('bsy_adi');

console.log('\n📋 Plan Girilmiş Tüm Kayıtlar:');
console.log(`Toplam: ${all?.length || 0} kayıt`);
if (all && all.length > 0) {
  const byBsy = {};
  all.forEach(r => {
    if (!byBsy[r.bsy_adi]) byBsy[r.bsy_adi] = [];
    byBsy[r.bsy_adi].push(r);
  });
  
  Object.keys(byBsy).sort().forEach(bsy => {
    console.log(`\n🔹 ${bsy} (${byBsy[bsy].length} kayıt)`);
    byBsy[bsy].slice(0, 3).forEach(r => {
      console.log(`   ${r.cari_kod}: ${r.tahsilat_haftasi} / ${r.tahsilat_turu}`);
    });
  });
}
