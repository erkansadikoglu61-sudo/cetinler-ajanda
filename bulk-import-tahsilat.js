// Excel'den kopyalanan verileri toplu yükleme script'i
// Kullanım: node bulk-import-tahsilat.js

const data = `M27000020	IB2	22-26 Haziran haftası	Nakit
M06002530	IB1	8-14 Haziran haftası	Çek
M34008520	MB4	8-14 Haziran haftası	Çek
M06000090	IB1	8-14 Haziran haftası	Çek
M34003100	MB2	15-19 Haziran haftası	Çek
M35001720	EB1
M34013000	MB4	8-14 Haziran haftası	Çek
M46000010	IB2	15-19 Haziran haftası	Çek
M34001240	MB4	22-26 Haziran haftası	Çek
M55000280	KB1	8-14 Haziran haftası	Çek
M34013030	MB2	8-14 Haziran haftası	Kredi kartı
M35002120	EB1	22-26 Haziran haftası	Kredi kartı
M34000580	MB4	8-14 Haziran haftası	Çek
M38000330	IB2	22-26 Haziran haftası	Kredi kartı
M55000200	KB1
M35002130	EB1		Çek
M55000320	KB1
M34014310	MB1	8-14 Haziran haftası	Çek
M09000280	EB1	8-14 Haziran haftası	Çek
M35002040	EB1	8-14 Haziran haftası	Çek
M10000070	MB2	15-19 Haziran haftası	Çek
M34013740	MB2	15-19 Haziran haftası	Çek
M06001080	IB1	15-19 Haziran haftası	Çek
M44000010	KB1
M34005380	MB1
M16000100	MB5	22-26 Haziran haftası	Çek
M06001420	IB1	22-26 Haziran haftası	Kredi kartı
M34014420	IB1
M34001220	MB2	22-26 Haziran haftası	Nakit
M10000360	MB5	8-14 Haziran haftası	Çek
M59000030	MB1	15-19 Haziran haftası	Kredi kartı
M55000400	KB1
M20000410	EB1	8-14 Haziran haftası	Çek
M34014370	MB1	8-14 Haziran haftası	Çek
M06000880	IB1	Fatura
M16002060	MB5	8-14 Haziran haftası	Çek
M16002320	MB5	8-14 Haziran haftası	Çek
M16001020	MB5	22-26 Haziran haftası	Kredi kartı
M34002900	MB9
M23000010	KB1
M34004960	MB4
M16002280	MB5	8-14 Haziran haftası	Çek
M61000010	KB1
M06001890	IB2
M16000820	MB5	8-14 Haziran haftası	Çek
M16001810	MB5	22-26 Haziran haftası	Kredi kartı
M16001860	MB5	8-14 Haziran haftası	Kredi kartı
M06002810	IB2	22-26 Haziran haftası	Kredi kartı
M35000070	EB1	8-14 Haziran haftası	Çek
M35002020	EB1
M35002150	EB1
M34014050	MB1	15-19 Haziran haftası	Kredi kartı
M06000990	IB2
M35001030	EB1	8-14 Haziran haftası	Kredi kartı
M10000220	MB5	8-14 Haziran haftası	Çek
M34009120	MB1
M35000190	EB1
M06002080	IB2
M06002040	IB2
M16001140	MB5	8-14 Haziran haftası	Kredi kartı
M06002430	IB2
M41001620	MB4
M16002300	MB5	8-14 Haziran haftası	Çek
M34014410	MB2	8-14 Haziran haftası	Nakit
M36000030	KB1	8-14 Haziran haftası	Çek
M16002020	MB5	8-14 Haziran haftası	Kredi kartı
M16001760	MB5	8-14 Haziran haftası	Çek
M17000280	MB1
M16002290	MB5	8-14 Haziran haftası	Çek
M22000040	MB1	22-26 Haziran haftası	Çek
M41001280	MB4
M32000250	EB1	8-14 Haziran haftası	Kredi kartı
M11001590	MB5	8-14 Haziran haftası	Çek
M34014440	MB2
M42000560	IB1	8-14 Haziran haftası	Kredi kartı
M35002030	EB1
M55000180	KB1
M41001440	MB4	22-26 Haziran haftası	Çek
M06002640	IB2
M41001650	MB4	22-26 Haziran haftası	Kredi kartı
M16000490	MB5	8-14 Haziran haftası	Çek
M77000060	MB5
M34013700	MB4
M38000090	IB2
M55000380	KB1	22-26 Haziran haftası	Kredi kartı
M64000100	EB1	8-14 Haziran haftası	Kredi kartı
M34012830	MB1
M09000320	EB1	8-14 Haziran haftası	Kredi kartı
M41001630	MB4
M55000410	KB1	15-19 Haziran haftası	Çek
M34011890	MB1
M17000170	MB1
M35001840	EB1
M35001880	EB1	8-14 Haziran haftası	Kredi kartı
M16000890	MB5
M06000700	IB2
M77000180	MB5
PRK00012	PERSONEL
M35001450	EB1	22-26 Haziran haftası	Nakit
M34012780	MB4
M53000040	KB1	22-26 Haziran haftası	Kredi kartı
M14000390	MB4	22-26 Haziran haftası	Kredi kartı
M61000050	KB1
M34009400	MB1
M48000430	EB1
M39000130	MB1	8-14 Haziran haftası	Kredi kartı
M34012770	MB1
M34002780	MB2
M41001330	MB4
M34010010	MB10
M34004430	MB1
M60000130	KB1
M34013460	MB4
M39000150	MB1	8-14 Haziran haftası	Kredi kartı
M58000030	KB1
M41000640	MB4
M16001280	MB5
M34008470	MB4
M34005090	MB4
M06001460	IB2
M06002410	IB1
M68000060	IB2
M06002770	IB2
M06000390	IB2
M06000130	IB2
M06000660	IB2
M38000140	IB2
M34014110	MB2
M67001020	MB4
M06001950	IB1
M16002260	MB5
PRK00011	PERSONEL
M34012540	MB4
M06002370	IB2
M35001920	EB1
M34013880	MB2
M34012460	MB1
M35002100	EB1
M06001560	IB1
M34003680	MB1
M41001430	MB4
M06001870	IB2
M34002330	MB2
M42000370	IB1
M23000020	IB2
M77000170	MB5
M06001920	IB2
M34013400	MB2		`;

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
