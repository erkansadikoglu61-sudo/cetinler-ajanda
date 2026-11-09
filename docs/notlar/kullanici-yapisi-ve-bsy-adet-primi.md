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
- **Süpervizör:** Yetki **coğrafi** bölünmüş. Bir carinin bazı şubelerini görür,
  kendi bölgesinde olmayanları görmez.
- **Jr. Süpervizör:** Kendisine bağlı coğrafyadaki noktaları görür.
- **Hiyerarşi:** Herkes kendisine bağlı **alt kullanıcıların şubelerini** de görür.
  Planlar ve hedefler buna göre yapılır.
- **Prim:** Alt kullanıcının şubesindeki satış, bir üst kullanıcının **adedine** yansır.

## 4. Yeni: BSY adet primi (hedef: 2027 Ocak canlı)
- Şu an BSY'ler **ciro** üzerinden primlendiriliyor.
- 2027'den itibaren BSY de **adet** yapısında değerlendirilecek.
- Süpervizör / Jr. Süpervizör / Çetinler Merch / Bayi Merch'teki gibi **ayrı bir başlık**
  (tablo + hesaplama) olarak hazırlanacak.
- Önce eksikler kontrol edilecek, sonra canlıya alınacak.

## 5. Bilgisayara geçince ilk yapılacaklar
- Mevcut yapının envanteri: kim, hangi şubeyi, hangi kaynaktan görüyor
  (B2B merch-detay, `field_personnel`, `profiles`, `bsy_supervisors`, ERP/BSY kodları).
- Karışan noktaların listesi (aşağıdaki "bilinen karmaşa" maddeleri dahil).
- Hedef yapı önerisi: tek "şube → kullanıcılar" modeli + hiyerarşi.
- BSY adet primi tasarımı: hedef kaynağı, gerçekleşme (cari bazlı tüm şubeler),
  kategori/ürün oranları, ödeme listesine entegrasyon.
- Tümü ayrı branch / önizleme (preview) üzerinde, canlıya dokunmadan.

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
- BSY adet primi: hedefler nereden girilecek (BSY bazlı mı, cari bazlı mı)? Oranlar
  kategori bazlı mı (Sup gibi), ürün bazlı mı (Adet Prim Tablosu gibi)?
- Bir cari birden fazla BSY'ye bağlı olabilir mi? Dönem içinde BSY değişirse satış kime?
- Şube müdürleri (8. seviye) hiyerarşide nereye bağlanacak, primleri var mı?
- Ciro bazlı BSY primi 2026 Aralık'a kadar aynen kalacak mı?

## Ek notlar (kullanıcıdan gelenler)
- _(henüz yok)_
