# Çetinler Ajanda v2 — kullanıcı yapısı optimizasyonu + BSY adet primi (2027) — çalışma notları

## 0. Vizyon: Çetinler Ajanda **v2**
- Bu çalışma bir yama değil, **v2** olarak düşünülecek. v1 parça parça, üst üste
  geliştirildiği için ağır çalışıyor.
- Hedef: optimizasyonları baştan yapılmış, **hızlı**, tutarlı ve sade bir yapı.
- Canlı (v1) çalışmaya devam ederken v2 **yan yana** hazırlanacak; kontrol edilip
  uygun bir şekilde geçiş yapılacak.
- v2'de ciro tabanlı prim yok; **tamamen adet tabanlı** prim yönetimi.

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
- **Hedef kategori bazlı** (Sup/Jr/Çetinler Merch'teki grup hedefleri gibi).
- **Kategori ana prim tutarları (BSY):**
  | Kategori | Ana prim |
  |---|---|
  | IPL Grubu | 28.000 ₺ |
  | Üflemeli Grubu | 20.000 ₺ |
  | Düzleştirici&Maşa Grubu | 15.000 ₺ |
  | Erkek Bakım Grubu | 10.000 ₺ |
  | Epilatör&Baskül(&Mutfak) | 8.500 ₺ |
  (Önceki "her kategoriye 3.000 ₺" yer tutucusunun yerine bunlar kullanılacak;
  tutarlar parametrik, sonradan değiştirilebilir.)
- **2027'de ciro primi tamamen kalkacak**; prim yönetimi tamamen adete bağlı olacak.
- **Kategori prim formülü (BSY, tüm kategorilerde aynı baremler):**
  - Gerçekleşme **< %50** → **0 ₺**
  - **%50 – %80** arası → **(ana prim / 2) × gerçekleşme oranı**
    (ör. ana prim 30.000 ₺, %60 gerçekleşme → 15.000 × 0,60 = **9.000 ₺**)
  - **≥ %80** → **ana primin tamamı** (ör. 30.000 ₺)
  - Ciro priminde alt barem %80'di; adette %50 alt barem + yarım prim bandı.
  - %50 ve %80 eşikleri **parametrik** tutulacak.
- Önce eksikler kontrol edilecek, sonra canlıya alınacak.

## 4b. Yeni: Kişisel prim ana ekranı ("Hesabım" — bankacılık uygulaması tarzı)
- **Tüm kullanıcılar** (BSY, Sup, Jr, Çetinler Merch, Bayi Merch, Destek Personeli,
  şube müdürleri) uygulamayı açınca kendi **öz dashboard'unu** görür.
- Tasarım: bankacılık uygulamalarının açılış ekranı gibi **net ve şık**.
- **Üst kart (kimlik):** ad soyad, **IBAN**, **cari**, **şube(ler)**, (rol, bağlı Sup/Jr).
  Amaç: yanlış bilgi görülürse kullanıcı hemen fark edip bildirir
  (ör. şubesi yanlış kayıtlı → Jr/Sup'una bildirip şube değişikliği yaptırır).
  → "Hatalı bilgi bildir" aksiyonu düşünülecek (bağlı Jr/Sup'a bildirim).
- **Bakiye kartı:** **mevcut ayın** anlık hakedişi ("kasa bakiyesi" / "hesabındaki para").
- **Geçmiş tablo:** son **3 ay** kazanılan primler + ödeme durumu, ör.:
  - 3 ay önce → **Ödendi** (ödeme tarihiyle)
  - 2 ay önce → **Ödendi**
  - geçen ay → **Bekliyor**
  - bu ay → **Hakediş devam ediyor** (anlık tutar)
- Ödendi/bekliyor bilgisinin kaynağı: mevcut Nihai Prim Listesi "Ödendi" kayıtları
  (nihai-prim-odeme) ve Prim Ödeme Listesi — v2'de tek kaynakta birleştirilecek.

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
- **Bir cari her zaman tek BSY'ye bağlıdır.** BSY = carinin plasiyeri; ERP → B2B →
  ajanda akışıyla gelir. ERP'de plasiyer değişince B2B ve ajandada da değişir.
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

## 6b. v2 geçiş planı
- v2 kısa sürede hazır ve çalışır hale gelirse **beklemeden v2'ye geçilir**.
- İstisna: **BSY adet primi** Kasım–Aralık 2026 boyunca yalnızca **simüle** edilir;
  **2027 Ocak'ta** gerçek prim olarak devreye alınır (Jr'larla birlikte).

## 7. Açık sorular (konuşulacak)
- **Süpürge Grubu** ve **Mutfak ve Diğer Gruplar** BSY prim listesinde yok: bu
  kategorilerden BSY'ye prim yok mu, yoksa tutar sonra mı verilecek?
- %100 üstü gerçekleşmede ek prim var mı (yoksa tavan ana prim mi)?

## Ek notlar (kullanıcıdan gelenler)
- 2026-11-09: Sup/Jr görünürlüğü B2B şube atamasından; BSY Kasım–Aralık paralel adet
  hedefi (simülasyon), 2027 Ocak canlı; atama değişikliğinde kayıt oluştuğu andaki
  yetkilide kalır (ay bazında); şube müdürleri şubenin Jr/Sup'u altında, manuel prim
  alt başlığı.
- 2026-11-09: BSY adet hedefi kategori bazlı, prim şimdilik kategori başına 3.000 ₺;
  bir cari tek BSY (ERP plasiyeri); 2027'de ciro primi tamamen kalkacak; tüm çalışma
  "Çetinler Ajanda v2" olarak, performans odaklı yeniden yapılandırma.
- 2026-11-09: Herkes için bankacılık tarzı kişisel prim ana ekranı (IBAN, cari, şube,
  bu ayın bakiyesi, son 3 ay ödendi/bekliyor tablosu, hatalı bilgi bildirimi).
- 2026-11-09: BSY kategori priminde alt barem (öneri %50, parametrik; cirodaki %80'in
  karşılığı). v2 hazır olunca beklemeden geçiş; BSY adet primi 2 ay simülasyon,
  2027 Ocak'ta canlı.
- 2026-11-09: BSY formülü: <%50 → 0; %50–80 → (ana prim/2) × gerçekleşme; ≥%80 → ana
  prim. Ana primler: IPL 28.000, Üflemeli 20.000, Düzleştirici&Maşa 15.000, Erkek Bakım
  10.000, Epilatör&Baskül 8.500 ₺. Baremler tüm kategorilerde aynı.
