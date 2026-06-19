// Excel'den kopyalanan verileri toplu yükleme script'i
// Kullanım: node bulk-import-tahsilat.js

const data = `M27000020	IB2	22-26 Haziran haftası	Nakit
M06002530	IB1	8-14 Haziran haftası	Çek
M34008520	MB4	8-14 Haziran haftası	Çek
M06000090	IB1	8-14 Haziran haftası	Çek
M34003100	MB2	15-19 Haziran haftası	Çek
M34013000	MB4	8-14 Haziran haftası	Çek
M46000010	IB2	15-19 Haziran haftası	Çek
M34001240	MB4	22-26 Haziran haftası	Çek
M55000280	KB1	8-14 Haziran haftası	Çek
M34013030	MB2	8-14 Haziran haftası	Kredi kartı
M35002120	EB1	22-26 Haziran haftası	Kredi kartı
M34000580	MB4	8-14 Haziran haftası	Çek
M38000330	IB2	22-26 Haziran haftası	Kredi kartı
M35002130	EB1		Çek
M34014310	MB1	8-14 Haziran haftası	Çek
M09000280	EB1	8-14 Haziran haftası	Çek
M35002040	EB1	8-14 Haziran haftası	Çek
M10000070	MB2	15-19 Haziran haftası	Çek
M34013740	MB2	15-19 Haziran haftası	Çek
M06001080	IB1	15-19 Haziran haftası	Çek
M16000100	MB5	22-26 Haziran haftası	Çek
M06001420	IB1	22-26 Haziran haftası	Kredi kartı
M34001220	MB2	22-26 Haziran haftası	Nakit
M10000360	MB5	8-14 Haziran haftası	Çek
M59000030	MB1	15-19 Haziran haftası	Kredi kartı
M20000410	EB1	8-14 Haziran haftası	Çek
M34014370	MB1	8-14 Haziran haftası	Çek
M06000880	IB1	Fatura
M16002060	MB5	8-14 Haziran haftası	Çek
M16002320	MB5	8-14 Haziran haftası	Çek
M16001020	MB5	22-26 Haziran haftası	Kredi kartı
M16002280	MB5	8-14 Haziran haftası	Çek
M16000820	MB5	8-14 Haziran haftası	Çek
M16001810	MB5	22-26 Haziran haftası	Kredi kartı
M16001860	MB5	8-14 Haziran haftası	Kredi kartı
M06002810	IB2	22-26 Haziran haftası	Kredi kartı
M35000070	EB1	8-14 Haziran haftası	Çek
M35001030	EB1	8-14 Haziran haftası	Kredi kartı
M10000220	MB5	8-14 Haziran haftası	Çek
M16001140	MB5	8-14 Haziran haftası	Kredi kartı
M16002300	MB5	8-14 Haziran haftası	Çek
M34014410	MB2	8-14 Haziran haftası	Nakit
M36000030	KB1	8-14 Haziran haftası	Çek
M16002020	MB5	8-14 Haziran haftası	Kredi kartı
M16001760	MB5	8-14 Haziran haftası	Çek
M16002290	MB5	8-14 Haziran haftası	Çek
M22000040	MB1	22-26 Haziran haftası	Çek
M32000250	EB1	8-14 Haziran haftası	Kredi kartı
M11001590	MB5	8-14 Haziran haftası	Çek
M42000560	IB1	8-14 Haziran haftası	Kredi kartı
M41001440	MB4	22-26 Haziran haftası	Çek
M41001650	MB4	22-26 Haziran haftası	Kredi kartı
M16000490	MB5	8-14 Haziran haftası	Çek
M55000380	KB1	22-26 Haziran haftası	Kredi kartı
M64000100	EB1	8-14 Haziran haftası	Kredi kartı
M09000320	EB1	8-14 Haziran haftası	Kredi kartı
M55000410	KB1	15-19 Haziran haftası	Çek
M35001880	EB1	8-14 Haziran haftası	Kredi kartı
M35001450	EB1	22-26 Haziran haftası	Nakit
M53000040	KB1	22-26 Haziran haftası	Kredi kartı
M14000390	MB4	22-26 Haziran haftası	Kredi kartı
M39000130	MB1	8-14 Haziran haftası	Kredi kartı
M16000890	EB1	8-14 Haziran haftası	Kredi kartı`;

const rows = data.trim().split('\n').map(line => {
  const parts = line.split('\t');
  return {
    cariKod: parts[0],
    bsyKod: parts[1],
    cariIsim: '', // Excel'den alınacak
    tahsilatHaftasi: parts[2] || null,
    tahsilatTuru: parts[3] || null
  };
}).filter(r => r.tahsilatHaftasi || r.tahsilatTuru);

async function bulkImport() {
  const API_URL = 'https://cetinler-ajanda.vercel.app/api/tahsilat-planim/bulk-import';

  console.log(`📦 ${rows.length} kayıt yüklenecek...`);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows })
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`✅ Başarılı! ${result.count} kayıt eklendi.`);
  } else {
    console.error(`❌ Hata: ${result.error}`);
  }
}

bulkImport();
