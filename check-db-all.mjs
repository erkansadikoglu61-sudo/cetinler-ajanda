import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sb = createClient(url, key);

const { data, error } = await sb
  .from('tahsilat_planim')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Hata:', error);
} else {
  console.log('\n📊 Son 10 Tahsilat Planı Kaydı:\n');
  data?.forEach(r => {
    console.log(`${r.bsy_adi} | ${r.cari_kod} | ${r.yil}-${r.ay} | ${r.tahsilat_haftasi} | ${r.tahsilat_turu}`);
  });
}
