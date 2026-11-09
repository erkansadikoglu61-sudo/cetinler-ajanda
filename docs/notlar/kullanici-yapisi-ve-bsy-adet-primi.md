# Kullanıcı yapısı optimizasyonu + BSY adet primi (2027) — çalışma notları

> Durum: **Henüz uygulanmadı.** Kullanıcı bilgisayara geçince birlikte başlanacak.
> Canlıya dokunmadan ayrı (paralel) hazırlanacak, kontrol sonrası canlıya alınacak.
> Kullanıcı yol boyunca ek notlar iletecek — buraya eklenecek.

## 1. Temel ilke: her şube bir "nokta"
- Kullanıcılar **carilere bağlı şubeler** üzerinden belirlenir.
- Her şube = bir nokta; o noktanın kullanıcıları vardır.

## 2. Kullanıcı seviyeleri (yukarıdan aşağıya)
1. **Admin** (Erkan Sadıkoğlu)
2. **BSY** — Bölge Satış Yöneticisi
3. **Süpervizör**
4. **Jr. Süpervizör**
5. **Çetinler Merch**
6. **Bayi Merch**
7. **Destek Personeli**
8. **Şube müdürleri** — şu an "Diğer" menüsü altında tutuluyor

Hepsinin sistemde kaydı var.

## 3. Görünürlük kuralları
- **BSY:** Kullanıcıları ERP'den gelir; ERP'de de yetki tanımı var. Ajandada BSY'nin
  görebildiği şubeler **cari üzerinden** takip edilir: carisi hangi ilde olursa olsun
  (İstanbul, Adıyaman, Trabzon, Van…) BSY'nin carilerine bağlı **tüm şubeler** görünür.
- **Süpervizör / Jr. Süpervizör:** Şube ataması **B2B'den** gelir (merch-detay'daki
  SUPERVIZOR / JR_SUPERVIZOR). Kendi bölgesindeki şubeleri bu atama üzerinden görür;
  bir carinin bölgesi dışındaki şubelerini görmez. Takip kaynağı: B2B şube ataması.
- **Hiyerarşi:** Herkes kendisine bağlı **alt kullanıcıların şubelerini** de görür.
  Planlar ve hedefler buna göre yapılır.
- **Prim:** Alt kullanıcının şubesindeki satış, bir üst kullanıcının **adedine** yansır.

## 4. Yeni: BSY adet primi (hedef: 2027 Ocak canlı)
- Şu an BSY'ler **ciro** üzerinden primlendiriliyor.
- **Kasım–Aralık 2026:** Ciro hedefleri girilmeye **devam edecek** (mevcut ciro primi aynen).
  Bunun **yanında paralel** bir **adet hedefi** girilebilecek → adet primi bu iki ayda
  **simüle** edilecek (ödemeye yansımadan takip).
- **2027 Ocak:** BSY adet primi canlıya alınacak.
- Yapı, Süpervizör / Jr. Süpervizör / Çetinler Merch'teki gibi olacak:
  **adet hedefi girişi** + **adet gerçekleşme takibi** + prim hesabı, ayrı bir başlık
  (tablo + hesaplama).
- BSY gerçekleşmesi: BSY'nin carilerine bağlı **tüm şubelerin** satış adedi.
- Önce eksikler kontrol edilecek, sonra canlıya alınacak.

## 5. Bilgisayara geçince ilk yapılacaklar
- Mevcut yapının envanteri: kim, hangi şubeyi, hangi kaynaktan görüyor
  (B2B merch-detay, `field_personnel`, `profiles`, `bsy_supervisors`, ERP/BSY kodları).
- Karışan noktaların listesi (aşağıdaki "bilinen karmaşa" maddeleri dahil).
- Hedef yapı önerisi: tek "şube → kullanıcılar" modeli + hiyerarşi.
- BSY adet primi tasarımı: hedef kaynağı, gerçekleşme (cari bazlı tüm şubeler),
  kategori/ürün oranları, ödeme listesine entegrasyon.
- Tümü ayrı branch / önizleme (preview) üzerinde, canlıya dokunmadan.

## 5b. Kararlaştırılan kurallar
- **Atama değişirse satış kime yazılır?** (BSY'nin carisi değişirse / şubenin
  süpervizörü-jr'ı değişirse — aynı kural) Satış/sipariş kaydı **oluştuğu andaki**
  yetkiliyle kalır. Değişiklikler pratikte **ay başında** yapıldığı için önceki ayın
  kayıtları eski kişide kalır; yani etki **ay bazında** yansır.
- **Şube müdürleri (8. seviye):**
  - Hiyerarşide şubenin yetkilisi olan **Jr. Süpervizör / Süpervizör'ün altında**.
  - Bir nevi **destek personeli** gibi şubeye bağlı.
  - Otomatik prim hesabı **yok**; prim **manuel** giriliyor (şu an "Diğer" menüsünde).
  - Yeni yapıda da manuel prim girişi yapılabilen **ayrı bir alt başlıkta** tutulacak.

## 6. Kodda bilinen karmaşa noktaları (mevcut durum)
- Görünürlük her ekranda ayrı yazılmış (ör. Noktalarımız: BSY → bsy_adi/kod,
  Sup → sup_adi, Jr → jr_adi; Sellout, Destek, Prim ekranlarında farklı kurallar).
- Destek personeli B2B'den değil Supabase `field_personnel`'dan; şube eşleşmesi isimle.
- Dönem bazlı düzeltmeler kodda sabit: `lib/supDevir` (Atilla ekibi, Eylül 2026 devri),
  `lib/merchSatis` BSY_DONEMLERI (Evkur MB9→MB10), `lib/sellout` AYRILANLAR.
- BSY primi: ciro bazlı (`BsyTakipView`, Nihai Prim'de BSY satırları `/api/nihai-prim-bsy`),
  `PRIM_EXCLUDED_BSYS`.
- B2B'de test/eski kayıtlar (ör. şube kodu boş satırlar) eşleşmeleri bozabiliyor.

## 7. Açık sorular (konuşulacak)
- BSY adet hedefi: kategori bazlı mı (Sup/Jr/Çetinler Merch gibi grup hedefleri)?
  Prim oranları/basamakları Sup'takiyle aynı mantıkta mı, tutarlar ne olacak?
- Bir cari aynı anda birden fazla BSY'ye bağlı olabilir mi?
- Ciro primi 2027'de tamamen mi kalkacak, yoksa adet primiyle birlikte mi sürecek?

## Ek notlar (kullanıcıdan gelenler)
- 2026-11-09: Sup/Jr görünürlüğü B2B şube atamasından; BSY Kasım–Aralık paralel adet
  hedefi (simülasyon), 2027 Ocak canlı; atama değişikliğinde kayıt oluştuğu andaki
  yetkilide kalır (ay bazında); şube müdürleri şubenin Jr/Sup'u altında, manuel prim
  alt başlığı.
