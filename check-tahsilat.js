const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// .env.local dosyasından manuel olarak oku
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTahsilatPlanim() {
  const { data, error } = await sb
    .from('tahsilat_planim')
    .select('bsy_adi, cari_kod, cari_isim, tahsilat_haftasi, tahsilat_turu, yil, ay, updated_at')
    .eq('yil', 2026)
    .eq('ay', 6)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Hata:', error);
    return;
  }

  console.log('\n📊 Tahsilat Planı Girişleri (Haziran 2026)\n');
  
  const byBsy = {};
  data.forEach(row => {
    if (!byBsy[row.bsy_adi]) {
      byBsy[row.bsy_adi] = [];
    }
    byBsy[row.bsy_adi].push(row);
  });

  Object.keys(byBsy).sort().forEach(bsy => {
    console.log(`\n🔹 ${bsy} (${byBsy[bsy].length} kayıt)`);
    const withPlan = byBsy[bsy].filter(r => r.tahsilat_haftasi || r.tahsilat_turu);
    console.log(`   Plan girilmiş: ${withPlan.length} kayıt`);
    if (withPlan.length > 0) {
      withPlan.slice(0, 3).forEach(row => {
        console.log(`   - ${row.cari_kod}: ${row.tahsilat_haftasi || '-'} / ${row.tahsilat_turu || '-'}`);
      });
    }
  });

  console.log('\n\n📌 Toplam:', data.length, 'kayıt');
}

checkTahsilatPlanim();
