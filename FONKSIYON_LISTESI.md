# Fonksiyon Listesi

Kaynak: CodeGraph 1.6.2, commit `47656fd`. Toplam 568 fonksiyon, ada göre A-Z sıralı.

- **Export:** Fonksiyonun tanımlandığı satır `export` ile başlıyor.
- **Çağıranlar / Çağırdıkları:** CodeGraph'ın proje içinde çözebildiği doğrudan çağrılar. JSX içindeki kullanımlar (`onClick={...}`, `<Bileşen />`) çağrı sayılmayabilir; "—" görünmesi fonksiyonun kullanılmadığı anlamına gelmez.

| # | Fonksiyon | Konum | Export | Async | Çağıranlar | Çağırdıkları |
|---|---|---|---|---|---|---|
| 1 | `addAylikAdet` | `src/app/api/dashboard-sellout/route.ts:283` |  |  | `GET` | — |
| 2 | `addNewRow` | `src/components/AdetPrimView.tsx:492` |  |  | — | — |
| 3 | `addNote` | `src/hooks/useTasks.ts:169` |  | ✓ | `handleAddNote` | `load`, `supabase` |
| 4 | `addRow` | `src/components/AdetPrimView.tsx:231` |  | ✓ | — | `EMPTY_OZEL`, `authFetch` |
| 5 | `addRow` | `src/components/DigerPrimView.tsx:130` |  |  | — | — |
| 6 | `addTask` | `src/hooks/useTasks.ts:55` |  | ✓ | `handleSaveTask` | `load`, `supabase` |
| 7 | `adetOf` | `src/components/DigerPrimView.tsx:112` |  |  | `DigerPrimView`, `saveRow` | `subeKey` |
| 8 | `AdetPrimTablosu` | `src/components/AdetPrimView.tsx:453` | ✓ |  | `AppPage` | `OzelPrimler`, `generateAdetPrimPdf`, `load`, `removeNewRow`, `updateDraft`, `updateNewRow` |
| 9 | `AdminDashboardView` | `src/components/AdminDashboardView.tsx:16` | ✓ |  | `AppPage` | `TopCard`, `fmtN`, `fmtPct`, `fmtTL`, `loadData` |
| 10 | `AnalizView` | `src/components/AnalizView.tsx:115` | ✓ |  | `AppPage` | `OranBadge`, `RiskBadge`, `Section`, `StatusBadge`, `fmtNum`, `fmtTime`, `loadSellin`, `marka`, `normStok`, `pctStr`, `useSellout` |
| 11 | `anonClient` | `src/lib/apiAuth.ts:19` |  |  | `requireRole` | — |
| 12 | `ApiAuthFetch` | `src/components/ApiAuthFetch.tsx:32` | ✓ |  | `RootLayout` | — |
| 13 | `apiUrl` | `src/components/KpiView.tsx:128` |  |  | `load` | — |
| 14 | `applyBsyOverride` | `src/lib/merchSatis.ts:244` |  |  | `parseHtmlTableByHeader` | `bugununDonemi` |
| 15 | `applyButce` | `src/components/PersonelliNoktaAnalizView.tsx:126` |  |  | `PersonelliNoktaAnalizView` | — |
| 16 | `applySupervisorOverride` | `src/lib/merchSatis.ts:265` |  |  | `parseHtmlTableByHeader` | `normKisi` |
| 17 | `AppPage` | `src/app/app/page.tsx:2038` | ✓ |  | `/app` | `AdetPrimTablosu`, `AdminDashboardView`, `AnalizView`, `Avatar`, `BayiMerchHakdis`, `BsyView`, `CompletedVisitsView`, `DayView`, `DestekPersonelHakedisView`, `DigerPrimView`, `GET /api/merch-detay`, `GenelRaporlarView`, `KpiView`, `KullanicilarView`, `MonthView`, `NihaiPrimListesi`, `NoktalarimizView`, `PersonSheet`, `PersonelliNoktaAnalizView`, `PrimAnalizView`, `PrimOdemeListesi`, `ReportView`, `SellinSelloutView`, `SelloutView`, `Sidebar`, `StatsSheet`, `TahsilatPlanimView`, `TahsilatTakvimiView`, `TaskSheet`, `WeekView`, `normalizeName`, `profileById`, `signOut`, `useAuth`, `useTasks`, `useTeam`, `visibleIds` |
| 18 | `ArrayBadge` | `src/components/AdetPrimView.tsx:158` |  |  | `OzelPrimler` | — |
| 19 | `ascii` | `src/lib/merchHesap.ts:16` |  |  | `emailOf`, `merchHesapPlani` | — |
| 20 | `authed` | `src/app/api/sellout-targets/route.ts:10` |  | ✓ | `GET`, `POST` | — |
| 21 | `authFetch` | `src/lib/authFetch.ts:5` | ✓ | ✓ | `ParametrelerModal`, `SelloutAciklama`, `SelloutView`, `SubeDetail`, `addRow`, `deleteRow`, `handleAdd`, `handleBulkImport`, `handleDelete`, `handleExcelUpload`, `handleImgUpload`, `kaydet`, `load`, `loadData`, `save`, `saveBulk`, `saveEdit`, `saveOdeme`, `saveRow`, `saveSecim`, `upsertMerchTargets`, `upsertProfileTargets` | — |
| 22 | `Avatar` | `src/app/app/page.tsx:46` |  |  | `AppPage`, `PersonSheet`, `Sidebar`, `StatsSheet`, `renderRow` | — |
| 23 | `Avatar` | `src/components/NoktalarimizView.tsx:166` |  |  | `SubeDetail` | — |
| 24 | `BayiMerchHakdis` | `src/components/AdetPrimView.tsx:1364` | ✓ |  | `AppPage` | `load`, `namesMatch` |
| 25 | `BsyKisiTable` | `src/components/BsyTakipView.tsx:559` |  |  | `BsyTakipView` | `OranCell`, `fmtCur`, `fmtPct`, `getPrims`, `getTahsilatOran`, `isExcluded` |
| 26 | `BsyKisiTable` | `src/components/BsyView.tsx:503` |  |  | `BsyView` | `OranCell`, `fmtCur`, `fmtPct`, `getPrims`, `getTahsilatOran`, `isExcluded` |
| 27 | `BsyRaporTablosu` | `src/components/BsyView.tsx:1303` |  |  | — | — |
| 28 | `BsyRaporTablosu` | `src/components/GenelRaporlarView.tsx:11` |  |  | `GenelRaporlarView` | — |
| 29 | `BsyTakipView` | `src/components/BsyTakipView.tsx:871` | ✓ |  | — | `BsyKisiTable`, `GET /api/tahsilat`, `HedefModal`, `KisiHedefModal`, `PRIM_EXCLUDED_BSYS`, `ParametreGirModal`, `ParametrelerModal`, `SummaryRow`, `TahsilatTablosu`, `calcBsyPrims`, `fmtCur`, `fmtPct`, `supabase`, `useBsyCiro`, `useBsyHedef`, `useBsyKisiHedef`, `useBsyParametreler` |
| 30 | `BsyView` | `src/components/BsyView.tsx:740` | ✓ |  | `AppPage` | `BsyKisiTable`, `HedefModal`, `KisiHedefModal`, `ParametreGirModal`, `ParametrelerModal`, `TahsilatDetayTablosu`, `TahsilatTablosu`, `calcBsyPrims`, `loadTahsilat`, `supabase`, `useBsyCiro`, `useBsyHedef`, `useBsyKisiHedef`, `useBsyParametreler` |
| 31 | `bugununDonemi` | `src/lib/merchSatis.ts:240` |  |  | `applyBsyOverride` | — |
| 32 | `buildJrResolver` | `src/app/api/sellout/route.ts:28` |  |  | `GET` | `normalizeName`, `parseHtmlTableByHeader` |
| 33 | `buildOzelCarpan` | `src/lib/ozelUygulama.ts:59` | ✓ |  | `GET`, `SelloutView` | `getOzelGruplar`, `ozelSubeAdetleri`, `ozelSubeKey` |
| 34 | `buildRows` | `src/app/api/dashboard/route.ts:168` |  |  | `GET` | — |
| 35 | `buildSubeListFromDetay` | `src/components/NoktalarimizView.tsx:55` |  |  | `NoktalarimizView` | `findProfile`, `normalizeName` |
| 36 | `bulkImport` | `bulk-import-tahsilat.js:164` |  | ✓ | `bulk-import-tahsilat.js` | — |
| 37 | `bySales` | `src/components/SelloutView.tsx:686` |  |  | — | — |
| 38 | `calcBsyPrims` | `src/lib/bsy.ts:129` | ✓ |  | `BsyTakipView`, `BsyView` | — |
| 39 | `calcPrim` | `src/lib/sellout.ts:137` | ✓ |  | `SelloutView`, `computeSelloutPrimForMonth` | — |
| 40 | `calcTieredPrim` | `src/components/BsyTakipView.tsx:37` |  |  | `getPrims` | `tierRate` |
| 41 | `calcTieredPrimBsy` | `src/lib/bsy.ts:226` | ✓ |  | `GET`, `getPrims` | `tierRate` |
| 42 | `calcTop20` | `src/components/SelloutView.tsx:40` |  |  | `SelloutView` | — |
| 43 | `calculateBsySiralama` | `src/app/api/dashboard-sales/route.ts:330` |  |  | `GET` | — |
| 44 | `calculateCariTop10` | `src/app/api/dashboard-sales/route.ts:361` |  |  | `GET` | — |
| 45 | `calculateTop10` | `src/app/api/dashboard-sellout/route.ts:148` |  |  | `GET` | `shortenCari` |
| 46 | `cancelEdit` | `src/components/AdetPrimView.tsx:486` |  |  | — | — |
| 47 | `CariSubeModal` | `src/components/DigerPrimView.tsx:346` |  |  | `DigerPrimView` | `GET /api/bsy-cari-sube`, `normalizeName` |
| 48 | `checkIn` | `src/hooks/useTasks.ts:95` |  | ✓ | `handleCheckIn` | `updateTask` |
| 49 | `CiroTable` | `src/components/DashboardView.tsx:28` |  |  | `DashboardView` | `fmtTL` |
| 50 | `ckey` | `src/app/api/nihai-prim-bsy/route.ts:73` |  |  | `GET` | — |
| 51 | `clearAll` | `src/components/SellinSelloutView.tsx:380` |  |  | — | — |
| 52 | `CompletedVisitsView` | `src/app/app/page.tsx:1349` |  |  | `AppPage` | `VisitsMap` |
| 53 | `computeSelloutPrimForMonth` | `src/lib/nihaiPrim.ts:52` | ✓ |  | `NihaiPrimListesi` | `calcPrim`, `getGerc`, `getMerchHedef`, `getProfileHedef` |
| 54 | `cozMerch` | `src/components/AdetPrimView.tsx:950` |  |  | `load` | `duzeltIsim`, `normOdeme` |
| 55 | `createManagers` | `create-manager-users.js:55` |  | ✓ | `create-manager-users.js` | — |
| 56 | `currentDonem` | `src/lib/sellout.ts:150` | ✓ |  | — | — |
| 57 | `DashboardView` | `src/components/DashboardView.tsx:90` | ✓ |  | — | `CiroTable`, `SELLOUT_GROUPS`, `fetchAll`, `fmtN`, `fmtPct`, `fmtTL` |
| 58 | `dayTasks` | `src/app/app/page.tsx:936` |  |  | `MonthView` | — |
| 59 | `DayView` | `src/app/app/page.tsx:1130` |  |  | `AppPage` | `hexWithAlpha`, `tasksForHour` |
| 60 | `decodeHtml` | `src/lib/merchSatis.ts:186` | ✓ |  | `parseHtmlTableByHeader` | — |
| 61 | `DELETE` | `src/app/api/destek-personel/route.ts:112` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 62 | `DELETE` | `src/app/api/diger-prim/route.ts:92` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 63 | `DELETE` | `src/app/api/prim-ozel/route.ts:88` | ✓ | ✓ | — | `requireRole`, `sb` |
| 64 | `deleteRow` | `src/components/AdetPrimView.tsx:267` |  | ✓ | `OzelPrimler` | `authFetch` |
| 65 | `deleteRow` | `src/components/DigerPrimView.tsx:160` |  | ✓ | `DigerPrimView` | `authFetch` |
| 66 | `deleteTask` | `src/hooks/useTasks.ts:89` |  | ✓ | `handleDeleteTask` | `load`, `supabase` |
| 67 | `DestekPersonelHakedisView` | `src/components/DestekPersonelHakedisView.tsx:30` | ✓ |  | `AppPage` | `SayfaParametreleri`, `fmt`, `handleHakedisChange`, `loadData`, `rowKey` |
| 68 | `DestekPersoneliPrimView` | `src/components/DestekPersoneliPrimView.tsx:30` | ✓ |  | — | `loadData` |
| 69 | `DigerPrimView` | `src/components/DigerPrimView.tsx:49` | ✓ |  | `AppPage` | `CariSubeModal`, `GET /api/merch-detay`, `adetOf`, `deleteRow`, `edit`, `fmtTl`, `load`, `normalizeName`, `onKullanici`, `saveRow`, `toNum` |
| 70 | `display` | `src/components/BsyTakipView.tsx:420` |  |  | `KisiHedefModal` | — |
| 71 | `display` | `src/components/BsyView.tsx:402` |  |  | `KisiHedefModal` | — |
| 72 | `donemdeAktif` | `src/lib/sellout.ts:116` | ✓ |  | `SelloutView` | `namesMatch` |
| 73 | `donemLabel` | `src/lib/sellout.ts:167` | ✓ |  | `SelloutView`, `TargetEntryModal` | — |
| 74 | `donemOptions` | `src/lib/sellout.ts:156` | ✓ |  | `SelloutView` | — |
| 75 | `downloadBsyExcel` | `src/lib/bsyExcel.ts:14` | ✓ | ✓ | `getExcelBuffer`, `loadBaseRates` | — |
| 76 | `dropCache` | `src/hooks/useAuth.ts:35` |  |  | `init`, `signOut`, `useAuth` | — |
| 77 | `dupKey` | `src/components/AdetPrimView.tsx:1095` |  |  | `PrimOdemeListesi` | `normOdeme` |
| 78 | `duzeltIsim` | `src/components/AdetPrimView.tsx:816` |  |  | `cozMerch` | `normOdeme` |
| 79 | `edit` | `src/components/DigerPrimView.tsx:110` |  |  | `DigerPrimView`, `onKullanici` | `patch` |
| 80 | `effectivePSayisi` | `src/components/PersonelliNoktaAnalizView.tsx:188` |  |  | `PersonelliNoktaAnalizView`, `getButce`, `getPersonelAy` | — |
| 81 | `ekOf` | `src/components/NihaiPrimListesi.tsx:201` |  |  | `NihaiPrimListesi`, `openCell`, `totalOf` | `okey` |
| 82 | `emailOf` | `src/lib/merchHesap.ts:22` |  |  | `merchHesapPlani` | `ascii` |
| 83 | `EMPTY_OZEL` | `src/components/AdetPrimView.tsx:152` |  |  | `OzelPrimler`, `addRow` | — |
| 84 | `ensureLeaflet` | `src/app/app/page.tsx:1220` |  | ✓ | `initMap` | — |
| 85 | `escapeHtml` | `src/app/app/page.tsx:1200` |  |  | `initMap` | — |
| 86 | `eVal` | `src/components/AdetPrimView.tsx:280` |  |  | `OzelPrimler` | — |
| 87 | `exportExcel` | `src/components/AdetPrimView.tsx:1102` |  |  | — | `formatIban`, `hesaplaOdenecek` |
| 88 | `exportExcel` | `src/components/NihaiPrimListesi.tsx:207` |  |  | — | `NP_MONTHS_TR`, `totalOf`, `yilTotal` |
| 89 | `exportOzelExcel` | `src/components/SelloutView.tsx:1283` |  |  | — | — |
| 90 | `exportSatislarExcel` | `src/components/SelloutView.tsx:899` |  |  | — | `getEffectiveBayiMerch`, `getEffectiveKosulluDestek`, `kolon`, `r2` |
| 91 | `exportToExcel` | `src/app/app/page.tsx:1412` |  | ✓ | — | — |
| 92 | `exportToPDF` | `src/app/app/page.tsx:1427` |  | ✓ | — | — |
| 93 | `fallback` | `src/lib/adetPrimRates.ts:16` |  |  | `loadBaseRates` | `ADET_PRIM_DEFAULTS` |
| 94 | `fetchAll` | `src/components/DashboardView.tsx:101` |  | ✓ | `DashboardView` | `GET /api/dashboard`, `GET /api/dashboard-sellout`, `GET /api/sellout` |
| 95 | `fetchCustomers` | `src/app/app/page.tsx:145` |  | ✓ | `TaskSheet` | `GET /api/bsy-cari-sube`, `isVisible`, `kisaCariAdi`, `toOpt` |
| 96 | `fetchFromPhp` | `src/lib/merchSatis.ts:101` |  | ✓ | `fetchPhpHtml`, `scheduleRefresh` | — |
| 97 | `fetchPhpHtml` | `src/lib/merchSatis.ts:142` | ✓ | ✓ | `GET`, `fetchPhpSellout`, `merchHesapPlani` | `fetchFromPhp`, `looksValid`, `runAfter`, `scheduleRefresh`, `storeRead`, `storeWrite` |
| 98 | `fetchPhpSellout` | `src/app/api/dashboard-sellout/route.ts:23` |  | ✓ | `GET` | `fetchPhpHtml`, `num`, `parseHtmlTableByHeader` |
| 99 | `fetchProfile` | `src/hooks/useAuth.ts:79` |  | ✓ | `init`, `useAuth` | `loadProfile`, `writeCache` |
| 100 | `FilterSelect` | `src/components/KullanicilarView.tsx:34` |  |  | `KullanicilarView` | — |
| 101 | `FilterSelect` | `src/components/NoktalarimizView.tsx:393` |  |  | `NoktalarimizView` | — |
| 102 | `findOzel` | `src/components/SelloutView.tsx:805` |  |  | `getEffectiveBayiMerch`, `getEffectiveKosulluDestek` | `normStr`, `tarihToIso` |
| 103 | `findOzelRule` | `src/app/api/bayi-merch-prim/route.ts:71` |  |  | `GET` | `normStr` |
| 104 | `findOzelRule` | `src/app/api/prim-analiz/route.ts:64` |  |  | `GET` | `normStr` |
| 105 | `findProfile` | `src/components/NoktalarimizView.tsx:119` |  |  | `buildSubeListFromDetay` | `normalizeName` |
| 106 | `fmt` | `src/components/DestekPersonelHakedisView.tsx:270` |  |  | `DestekPersonelHakedisView` | — |
| 107 | `fmt` | `src/components/MerchSatisPivotTable.tsx:8` |  |  | `MerchSatisPivotTable` | — |
| 108 | `fmt` | `src/components/PersonelliNoktaAnalizView.tsx:13` |  |  | `PersonelliNoktaAnalizView` | — |
| 109 | `fmt2` | `src/components/SelloutView.tsx:1671` |  |  | `SelloutView` | — |
| 110 | `fmt2` | `src/components/SelloutView.tsx:1788` |  |  | `SelloutView` | — |
| 111 | `fmtCur` | `src/components/BsyTakipView.tsx:126` |  |  | `BsyKisiTable`, `BsyTakipView`, `TahsilatTablosu` | — |
| 112 | `fmtCur` | `src/components/BsyView.tsx:155` |  |  | `BsyKisiTable`, `TahsilatDetayTablosu`, `TahsilatTablosu` | — |
| 113 | `fmtCur` | `src/components/NihaiPrimListesi.tsx:17` |  |  | `NihaiPrimListesi` | — |
| 114 | `fmtCur` | `src/components/TahsilatPlanimView.tsx:14` |  |  | — | — |
| 115 | `fmtCur` | `src/components/TahsilatTakvimiView.tsx:10` |  |  | `TahsilatTakvimiView` | — |
| 116 | `fmtCur` | `src/lib/sellout.ts:145` | ✓ |  | `SelloutTable` | — |
| 117 | `fmtN` | `src/components/AdminDashboardView.tsx:11` |  |  | `AdminDashboardView`, `TopCard` | — |
| 118 | `fmtN` | `src/components/DashboardView.tsx:15` |  |  | `DashboardView` | — |
| 119 | `fmtNum` | `src/components/AnalizView.tsx:46` |  |  | `AnalizView` | — |
| 120 | `fmtNum` | `src/components/SellinSelloutView.tsx:140` |  |  | `SellinSelloutView` | — |
| 121 | `fmtPct` | `src/components/AdminDashboardView.tsx:12` |  |  | `AdminDashboardView` | — |
| 122 | `fmtPct` | `src/components/BsyTakipView.tsx:129` |  |  | `BsyKisiTable`, `BsyTakipView`, `OranCell`, `TahsilatTablosu` | — |
| 123 | `fmtPct` | `src/components/BsyView.tsx:158` |  |  | `BsyKisiTable`, `OranCell`, `TahsilatTablosu` | — |
| 124 | `fmtPct` | `src/components/DashboardView.tsx:16` |  |  | `DashboardView` | — |
| 125 | `fmtPct` | `src/components/PersonelliNoktaAnalizView.tsx:16` |  |  | `PersonelliNoktaAnalizView` | — |
| 126 | `fmtPct` | `src/components/SellinSelloutView.tsx:142` |  |  | `SellinSelloutView` | — |
| 127 | `fmtPrim` | `src/lib/pdf.ts:254` |  |  | `generateBayiMerchPdf` | — |
| 128 | `fmtTime` | `src/components/AnalizView.tsx:52` |  |  | `AnalizView` | — |
| 129 | `fmtTL` | `src/components/AdetPrimView.tsx:1555` |  |  | `PrimAnalizView` | — |
| 130 | `fmtTL` | `src/components/AdminDashboardView.tsx:10` |  |  | `AdminDashboardView` | — |
| 131 | `fmtTL` | `src/components/DashboardView.tsx:11` |  |  | `CiroTable`, `DashboardView` | — |
| 132 | `fmtTl` | `src/components/DigerPrimView.tsx:47` |  |  | `DigerPrimView` | — |
| 133 | `formatIban` | `src/components/AdetPrimView.tsx:839` |  |  | `PrimOdemeListesi`, `exportExcel` | — |
| 134 | `GenelRaporlarView` | `src/components/GenelRaporlarView.tsx:108` | ✓ |  | `AppPage` | `BsyRaporTablosu`, `GET /api/bsy-rapor` |
| 135 | `generateAdetPrimPdf` | `src/lib/pdf.ts:167` | ✓ |  | `AdetPrimTablosu` | — |
| 136 | `generateBayiMerchPdf` | `src/lib/pdf.ts:238` | ✓ |  | — | `fmtPrim` |
| 137 | `generateVisitReport` | `src/lib/pdf.ts:14` | ✓ |  | `handlePdf` | `VISIT_TYPES` |
| 138 | `GET` | `src/app/api/adet-prim/route.ts:16` | ✓ | ✓ | — | `fetchPhpHtml`, `getSupabase`, `loadAdetPrimRates` |
| 139 | `GET` | `src/app/api/admin-seed-bsy/route.ts:17` | ✓ | ✓ | — | — |
| 140 | `GET` | `src/app/api/bayi-merch-prim/route.ts:21` | ✓ | ✓ | — | `buildOzelCarpan`, `fetchPhpHtml`, `findOzelRule`, `loadBayiMerchRateMap`, `num`, `parseHtmlTableByHeader`, `tarihToIso` |
| 141 | `GET` | `src/app/api/bsy-cari-sube/route.ts:20` | ✓ | ✓ | — | `fetchPhpHtml`, `parseHtmlTableByHeader` |
| 142 | `GET` | `src/app/api/bsy-ciro/route.ts:47` | ✓ | ✓ | — | `getExcelBuffer` |
| 143 | `GET` | `src/app/api/bsy-hedef/route.ts:14` | ✓ | ✓ | — | `getAdmin` |
| 144 | `GET` | `src/app/api/bsy-kisi-hedef/route.ts:14` | ✓ | ✓ | — | `getAdmin` |
| 145 | `GET` | `src/app/api/bsy-param-img/route.ts:16` | ✓ | ✓ | — | `getSupabase` |
| 146 | `GET` | `src/app/api/bsy-parametreler/route.ts:12` | ✓ | ✓ | — | `getAdmin` |
| 147 | `GET` | `src/app/api/bsy-rapor/route.ts:44` | ✓ | ✓ | — | `getExcelBuffer` |
| 148 | `GET` | `src/app/api/check-hierarchy-users/route.ts:27` | ✓ | ✓ | — | `fetchPhpHtml`, `getExcelBuffer`, `parseHtmlTableByHeader` |
| 149 | `GET` | `src/app/api/check-hierarchy/route.ts:4` | ✓ | ✓ | — | `fetchPhpHtml`, `parseHtmlTableByHeader` |
| 150 | `GET` | `src/app/api/dashboard-sales-detail/route.ts:4` | ✓ | ✓ | — | — |
| 151 | `GET` | `src/app/api/dashboard-sales/route.ts:101` | ✓ | ✓ | — | `calculateBsySiralama`, `calculateCariTop10`, `getExcelBuffer`, `toNum` |
| 152 | `GET` | `src/app/api/dashboard-sellout/route.ts:236` | ✓ | ✓ | — | `addAylikAdet`, `calculateTop10`, `fetchPhpSellout` |
| 153 | `GET` | `src/app/api/dashboard-tahsilat/route.ts:65` | ✓ | ✓ | — | `getExcelBuffer`, `normalizeText`, `toNum` |
| 154 | `GET` | `src/app/api/dashboard/route.ts:70` | ✓ | ✓ | — | `buildRows`, `getExcelBuffer` |
| 155 | `GET` | `src/app/api/destek-hakedis/route.ts:12` | ✓ | ✓ | — | `getAdmin` |
| 156 | `GET` | `src/app/api/destek-personel-prim/route.ts:33` | ✓ | ✓ | — | `fetchPhpHtml`, `getAdmin`, `normalize`, `parseHtmlTableByHeader`, `phpEntry`, `shortCari` |
| 157 | `GET` | `src/app/api/destek-personel/route.ts:13` | ✓ | ✓ | — | `getAdmin` |
| 158 | `GET` | `src/app/api/diger-prim/route.ts:32` | ✓ | ✓ | — | `fetchPhpHtml`, `getSupabase`, `normalizeName`, `num`, `parseHtmlTableByHeader`, `requireRole` |
| 159 | `GET` | `src/app/api/kpi-adet-eslesme/route.ts:41` | ✓ | ✓ | — | `getExcelBuffer` |
| 160 | `GET` | `src/app/api/kpi-adet/route.ts:48` | ✓ | ✓ | — | `getExcelBuffer` |
| 161 | `GET` | `src/app/api/merch-destek-flag/route.ts:12` | ✓ | ✓ | — | `getAdmin` |
| 162 | `GET` | `src/app/api/merch-detay/route.ts:21` | ✓ | ✓ | — | `fetchPhpHtml`, `parseHtmlTableByHeader` |
| 163 | `GET` | `src/app/api/merch-hesaplari/route.ts:34` | ✓ | ✓ | — | `merchHesapPlani`, `requireAdmin` |
| 164 | `GET` | `src/app/api/merch-options/route.ts:6` | ✓ | ✓ | — | `fetchPhpHtml`, `parseHtmlTableByHeader` |
| 165 | `GET` | `src/app/api/merch-satis-pivot/route.ts:27` | ✓ | ✓ | — | `fetchPhpHtml`, `num`, `parseHtmlTableByHeader` |
| 166 | `GET` | `src/app/api/nihai-prim-bsy/route.ts:54` | ✓ | ✓ | — | `calcTieredPrimBsy`, `ckey`, `getExcelBuffer`, `getKisi`, `getSupabase`, `isExcluded`, `lc`, `normHeader`, `tahsilatOran`, `toNum` |
| 167 | `GET` | `src/app/api/nihai-prim-ek/route.ts:27` | ✓ | ✓ | — | `getSupabase` |
| 168 | `GET` | `src/app/api/nihai-prim-odeme/route.ts:27` | ✓ | ✓ | — | `getSupabase` |
| 169 | `GET` | `src/app/api/personelli-nokta-analiz/route.ts:62` | ✓ | ✓ | — | `fetchPhpHtml`, `getExcelBuffer`, `norm`, `parseHtmlTableByHeader`, `prefixKey` |
| 170 | `GET` | `src/app/api/prim-analiz/route.ts:22` | ✓ | ✓ | — | `buildOzelCarpan`, `fetchPhpHtml`, `findOzelRule`, `loadBayiMerchRateMap`, `num`, `parseHtmlTableByHeader`, `tarihToIso` |
| 171 | `GET` | `src/app/api/prim-ozel/route.ts:14` | ✓ | ✓ | — | `sb` |
| 172 | `GET` | `src/app/api/sellin-sellout/route.ts:49` | ✓ | ✓ | — | `getExcelBuffer` |
| 173 | `GET` | `src/app/api/sellout-aciklama/route.ts:19` | ✓ | ✓ | — | `getSupabase` |
| 174 | `GET` | `src/app/api/sellout-targets/route.ts:25` | ✓ | ✓ | — | `authed`, `yetkisiz` |
| 175 | `GET` | `src/app/api/sellout/route.ts:99` | ✓ | ✓ | — | `buildJrResolver`, `fetchPhpHtml`, `parseHtmlTable` |
| 176 | `GET` | `src/app/api/tahsilat-gerceklesen/route.ts:62` | ✓ | ✓ | — | `getExcelBuffer`, `normTr`, `paymentBucket`, `toNum` |
| 177 | `GET` | `src/app/api/tahsilat-planim/route.ts:66` | ✓ | ✓ | — | `getExcelBuffer`, `toNum` |
| 178 | `GET` | `src/app/api/tahsilat/route.ts:64` | ✓ | ✓ | — | `getExcelBuffer`, `toNum` |
| 179 | `GET` | `src/app/api/test-adet-prim/route.ts:5` | ✓ | ✓ | — | — |
| 180 | `getAdmin` | `src/app/api/bsy-hedef/route.ts:6` |  |  | `GET`, `POST` | — |
| 181 | `getAdmin` | `src/app/api/bsy-kisi-hedef/route.ts:6` |  |  | `GET`, `POST` | — |
| 182 | `getAdmin` | `src/app/api/bsy-parametreler/route.ts:5` |  |  | `GET`, `POST` | — |
| 183 | `getAdmin` | `src/app/api/destek-hakedis/route.ts:5` |  |  | `GET`, `POST` | — |
| 184 | `getAdmin` | `src/app/api/destek-personel-prim/route.ts:5` |  |  | `GET` | — |
| 185 | `getAdmin` | `src/app/api/destek-personel/bulk-import/route.ts:5` |  |  | `POST` | — |
| 186 | `getAdmin` | `src/app/api/destek-personel/route.ts:5` |  |  | `DELETE`, `GET`, `POST` | — |
| 187 | `getAdmin` | `src/app/api/merch-destek-flag/route.ts:5` |  |  | `GET`, `POST` | — |
| 188 | `getAdminClient` | `src/app/api/merch-hesaplari/route.ts:14` |  |  | `requireAdmin` | — |
| 189 | `getButce` | `src/components/PersonelliNoktaAnalizView.tsx:215` |  |  | `PersonelliNoktaAnalizView` | `effectivePSayisi` |
| 190 | `getEffectiveBayiMerch` | `src/components/SelloutView.tsx:835` |  |  | `SelloutView`, `exportSatislarExcel` | `findOzel` |
| 191 | `getEffectiveKosulluDestek` | `src/components/SelloutView.tsx:845` |  |  | `SelloutView`, `exportSatislarExcel` | `findOzel` |
| 192 | `getExcelBuffer` | `src/app/api/bsy-ciro/route.ts:29` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 193 | `getExcelBuffer` | `src/app/api/bsy-rapor/route.ts:21` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 194 | `getExcelBuffer` | `src/app/api/check-hierarchy-users/route.ts:10` |  | ✓ | `GET` | `downloadBsyExcel` |
| 195 | `getExcelBuffer` | `src/app/api/dashboard-sales/route.ts:13` |  | ✓ | `GET` | `downloadBsyExcel` |
| 196 | `getExcelBuffer` | `src/app/api/dashboard-tahsilat/route.ts:13` |  | ✓ | `GET` | `downloadBsyExcel` |
| 197 | `getExcelBuffer` | `src/app/api/dashboard/route.ts:21` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 198 | `getExcelBuffer` | `src/app/api/kpi-adet-eslesme/route.ts:20` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 199 | `getExcelBuffer` | `src/app/api/kpi-adet/route.ts:20` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 200 | `getExcelBuffer` | `src/app/api/nihai-prim-bsy/route.ts:31` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 201 | `getExcelBuffer` | `src/app/api/personelli-nokta-analiz/route.ts:21` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 202 | `getExcelBuffer` | `src/app/api/sellin-sellout/route.ts:20` |  | ✓ | `GET` | `downloadBsyExcel`, `getSupabase` |
| 203 | `getExcelBuffer` | `src/app/api/tahsilat-gerceklesen/route.ts:14` |  | ✓ | `GET` | `downloadBsyExcel` |
| 204 | `getExcelBuffer` | `src/app/api/tahsilat-planim/route.ts:20` |  | ✓ | `GET` | `downloadBsyExcel` |
| 205 | `getExcelBuffer` | `src/app/api/tahsilat/route.ts:22` |  | ✓ | `GET` | `downloadBsyExcel` |
| 206 | `getGerc` | `src/lib/nihaiPrim.ts:69` |  |  | `computeSelloutPrimForMonth` | `normalizeName` |
| 207 | `getHaftaSecenekleri` | `src/components/TahsilatPlanimView.tsx:58` |  |  | `TahsilatPlanimView` | — |
| 208 | `getHaftaSecenekleri` | `src/components/TahsilatTakvimiView.tsx:15` |  |  | `TahsilatTakvimiView` | — |
| 209 | `getKisi` | `src/app/api/nihai-prim-bsy/route.ts:183` |  |  | `GET` | `lc` |
| 210 | `getKisiExtra` | `src/hooks/useBsyKisiHedef.ts:44` |  |  | — | — |
| 211 | `getKisiHedef` | `src/hooks/useBsyKisiHedef.ts:33` |  |  | — | — |
| 212 | `getMerchHedef` | `src/hooks/useSelloutTargets.ts:53` |  |  | `SelloutView` | — |
| 213 | `getMerchHedef` | `src/lib/nihaiPrim.ts:64` |  |  | `computeSelloutPrimForMonth` | — |
| 214 | `getOzelGruplar` | `src/lib/ozelUygulama.ts:27` | ✓ |  | `SelloutView`, `buildOzelCarpan`, `ozelSubeAdetleri` | — |
| 215 | `getPersonelAy` | `src/components/PersonelliNoktaAnalizView.tsx:220` |  |  | `PersonelliNoktaAnalizView` | `effectivePSayisi` |
| 216 | `getPrims` | `src/components/BsyTakipView.tsx:596` |  |  | `BsyKisiTable` | `calcTieredPrim`, `getTahsilatOran`, `isExcluded` |
| 217 | `getPrims` | `src/components/BsyView.tsx:539` |  |  | `BsyKisiTable` | `calcTieredPrimBsy`, `getTahsilatOran`, `isExcluded` |
| 218 | `getProfileHedef` | `src/hooks/useSelloutTargets.ts:47` |  |  | `SelloutView` | — |
| 219 | `getProfileHedef` | `src/lib/nihaiPrim.ts:62` |  |  | `computeSelloutPrimForMonth` | — |
| 220 | `getSupabase` | `src/app/api/adet-prim/route.ts:7` |  |  | `GET`, `PUT` | — |
| 221 | `getSupabase` | `src/app/api/bsy-ciro/route.ts:22` |  |  | `getExcelBuffer` | — |
| 222 | `getSupabase` | `src/app/api/bsy-param-img/route.ts:8` |  |  | `GET`, `POST` | — |
| 223 | `getSupabase` | `src/app/api/bsy-rapor/route.ts:14` |  |  | `getExcelBuffer` | — |
| 224 | `getSupabase` | `src/app/api/dashboard/route.ts:14` |  |  | `getExcelBuffer` | — |
| 225 | `getSupabase` | `src/app/api/diger-prim/route.ts:21` |  |  | `DELETE`, `GET`, `POST` | — |
| 226 | `getSupabase` | `src/app/api/kpi-adet-eslesme/route.ts:13` |  |  | `getExcelBuffer` | — |
| 227 | `getSupabase` | `src/app/api/kpi-adet/route.ts:13` |  |  | `getExcelBuffer` | — |
| 228 | `getSupabase` | `src/app/api/nihai-prim-bsy/route.ts:24` |  |  | `GET`, `getExcelBuffer` | — |
| 229 | `getSupabase` | `src/app/api/nihai-prim-ek/route.ts:11` |  |  | `GET`, `POST` | — |
| 230 | `getSupabase` | `src/app/api/nihai-prim-odeme/route.ts:11` |  |  | `GET`, `POST` | — |
| 231 | `getSupabase` | `src/app/api/personelli-nokta-analiz/route.ts:14` |  |  | `getExcelBuffer` | — |
| 232 | `getSupabase` | `src/app/api/sellin-sellout/route.ts:13` |  |  | `getExcelBuffer` | — |
| 233 | `getSupabase` | `src/app/api/sellout-aciklama/route.ts:12` |  |  | `GET`, `POST` | — |
| 234 | `getSupabase` | `src/lib/supabase.ts:5` | ✓ |  | `supabase` | — |
| 235 | `getTahsilatOran` | `src/components/BsyTakipView.tsx:590` |  |  | `BsyKisiTable`, `getPrims` | — |
| 236 | `getTahsilatOran` | `src/components/BsyView.tsx:535` |  |  | `BsyKisiTable`, `getPrims` | — |
| 237 | `grupBadge` | `src/components/KullanicilarView.tsx:66` |  |  | `KullanicilarView` | — |
| 238 | `h` | `src/components/AdetPrimView.tsx:39` |  |  | — | — |
| 239 | `handle` | `src/components/PersonelliNoktaAnalizView.tsx:35` |  |  | — | — |
| 240 | `handleAcikHesapClick` | `src/components/AdminDashboardView.tsx:94` |  |  | — | — |
| 241 | `handleAdd` | `src/components/NoktalarimizView.tsx:206` |  | ✓ | `SubeDetail` | `authFetch` |
| 242 | `handleAddNote` | `src/app/app/page.tsx:285` |  | ✓ | `TaskSheet` | `addNote` |
| 243 | `handleAddTask` | `src/app/app/page.tsx:2178` |  |  | — | — |
| 244 | `handleAylikCiroClick` | `src/components/AdminDashboardView.tsx:76` |  |  | — | — |
| 245 | `handleBsyChange` | `src/components/NoktalarimizView.tsx:524` |  |  | — | — |
| 246 | `handleBulkImport` | `src/components/NoktalarimizView.tsx:481` |  | ✓ | — | `authFetch`, `handleRefresh` |
| 247 | `handleChange` | `src/components/BsyTakipView.tsx:414` |  |  | `KisiHedefModal` | — |
| 248 | `handleChange` | `src/components/BsyView.tsx:398` |  |  | `KisiHedefModal` | — |
| 249 | `handleCheckIn` | `src/app/app/page.tsx:270` |  | ✓ | — | — |
| 250 | `handleCheckIn` | `src/app/app/page.tsx:2194` |  | ✓ | — | `checkIn` |
| 251 | `handleClick` | `src/components/SellinSelloutView.tsx:44` |  |  | — | — |
| 252 | `handleDayClick` | `src/app/app/page.tsx:2169` |  |  | — | — |
| 253 | `handleDelete` | `src/app/app/page.tsx:262` |  | ✓ | — | — |
| 254 | `handleDelete` | `src/components/NoktalarimizView.tsx:242` |  | ✓ | `SubeDetail` | `authFetch` |
| 255 | `handleDeleteTask` | `src/app/app/page.tsx:2190` |  | ✓ | — | `deleteTask` |
| 256 | `handleExcelUpload` | `src/components/BsyTakipView.tsx:902` |  | ✓ | — | `authFetch` |
| 257 | `handleExcelUpload` | `src/components/BsyView.tsx:793` |  | ✓ | — | `authFetch`, `loadTahsilat` |
| 258 | `handleGerceklesenClick` | `src/components/AdminDashboardView.tsx:121` |  |  | — | — |
| 259 | `handleHakedisChange` | `src/components/DestekPersonelHakedisView.tsx:190` |  |  | `DestekPersonelHakedisView` | `rowKey`, `saveRow` |
| 260 | `handleImgUpload` | `src/components/BsyTakipView.tsx:146` |  |  | — | — |
| 261 | `handleImgUpload` | `src/components/BsyView.tsx:192` |  | ✓ | — | `authFetch` |
| 262 | `handleLogin` | `src/app/login/page.tsx:23` |  | ✓ | — | `signIn` |
| 263 | `handlePdf` | `src/app/app/page.tsx:1624` |  |  | — | `generateVisitReport` |
| 264 | `handleRefresh` | `src/components/NoktalarimizView.tsx:475` |  |  | `handleBulkImport` | `reload` |
| 265 | `handleReset` | `src/app/login/page.tsx:36` |  | ✓ | — | `resetPassword` |
| 266 | `handleSave` | `src/app/app/page.tsx:242` |  | ✓ | — | — |
| 267 | `handleSave` | `src/components/BsyTakipView.tsx:338` |  | ✓ | — | `parseCur` |
| 268 | `handleSave` | `src/components/BsyTakipView.tsx:438` |  | ✓ | — | `toNum` |
| 269 | `handleSave` | `src/components/BsyView.tsx:291` |  | ✓ | — | `parseCur` |
| 270 | `handleSave` | `src/components/BsyView.tsx:413` |  | ✓ | — | `toNum` |
| 271 | `handleSave` | `src/components/SelloutView.tsx:210` |  | ✓ | — | — |
| 272 | `handleSave` | `src/components/SelloutView.tsx:1207` |  | ✓ | — | `upsertMerchTargets`, `upsertProfileTargets` |
| 273 | `handleSaveTask` | `src/app/app/page.tsx:2182` |  | ✓ | — | `addTask` |
| 274 | `handleSubmit` | `src/app/auth/reset-password/page.tsx:19` |  | ✓ | — | — |
| 275 | `handleSync` | `src/components/KullanicilarView.tsx:284` |  | ✓ | — | `load` |
| 276 | `handleTahsilatHedefClick` | `src/components/AdminDashboardView.tsx:104` |  |  | — | — |
| 277 | `handleTahsilatTurleriClick` | `src/components/AdminDashboardView.tsx:131` |  |  | — | — |
| 278 | `handleTaskClick` | `src/app/app/page.tsx:2174` |  |  | — | — |
| 279 | `handleUpdateTask` | `src/app/app/page.tsx:2186` |  | ✓ | — | `updateTask` |
| 280 | `handleYillikCiroClick` | `src/components/AdminDashboardView.tsx:85` |  |  | — | — |
| 281 | `hasNote` | `src/app/app/page.tsx:942` |  |  | — | — |
| 282 | `HedefModal` | `src/components/BsyTakipView.tsx:326` |  |  | `BsyTakipView` | `set` |
| 283 | `HedefModal` | `src/components/BsyView.tsx:277` |  |  | `BsyView` | `set` |
| 284 | `hesapla` | `src/components/KpiView.tsx:119` |  |  | `load` | — |
| 285 | `hesaplaOdenecek` | `src/components/AdetPrimView.tsx:849` |  |  | `PrimOdemeListesi`, `exportExcel` | `normOdeme` |
| 286 | `hexToRgb` | `src/lib/pdf.ts:7` |  |  | — | — |
| 287 | `hexWithAlpha` | `src/app/app/page.tsx:42` |  |  | `DayView`, `MonthView`, `WeekView` | — |
| 288 | `init` | `src/hooks/useAuth.ts:90` |  | ✓ | `useAuth` | `dropCache`, `fetchProfile`, `readCache`, `withTimeout` |
| 289 | `initMap` | `src/app/app/page.tsx:1242` |  | ✓ | `VisitsMap` | `ensureLeaflet`, `escapeHtml` |
| 290 | `isExcluded` | `src/app/api/nihai-prim-bsy/route.ts:194` |  |  | `GET` | `PRIM_EXCLUDED_BSYS`, `lc` |
| 291 | `isExcluded` | `src/components/BsyTakipView.tsx:586` |  |  | `BsyKisiTable`, `getPrims` | `PRIM_EXCLUDED_BSYS` |
| 292 | `isExcluded` | `src/components/BsyView.tsx:532` |  |  | `BsyKisiTable`, `getPrims` | `PRIM_EXCLUDED_BSYS` |
| 293 | `isExcluded` | `src/lib/bsy.ts:150` |  |  | — | — |
| 294 | `isNetworkError` | `src/hooks/useAuth.ts:65` |  |  | `signIn` | — |
| 295 | `isVisible` | `src/app/app/page.tsx:172` |  |  | `fetchCustomers` | `namesMatch` |
| 296 | `jrsOf` | `src/components/SelloutView.tsx:515` |  |  | `SelloutView` | — |
| 297 | `jrsOfSupName` | `src/components/SelloutView.tsx:521` |  |  | `SelloutView` | `normalizeName` |
| 298 | `KampanyaBlok` | `src/components/KpiView.tsx:140` |  |  | `KpiView` | — |
| 299 | `kaydet` | `src/components/SelloutAciklama.tsx:33` |  | ✓ | — | `authFetch` |
| 300 | `kisaCariAdi` | `src/app/app/page.tsx:2028` |  |  | `fetchCustomers` | — |
| 301 | `kisaltCariIsim` | `src/components/TahsilatPlanimView.tsx:19` |  |  | `TahsilatPlanimView` | — |
| 302 | `KisiHedefModal` | `src/components/BsyTakipView.tsx:387` |  |  | `BsyTakipView` | `display`, `handleChange`, `oran`, `toNum` |
| 303 | `KisiHedefModal` | `src/components/BsyView.tsx:373` |  |  | `BsyView` | `display`, `handleChange`, `pct`, `toNum` |
| 304 | `kolon` | `src/components/SelloutView.tsx:909` |  |  | `exportSatislarExcel` | — |
| 305 | `KpiView` | `src/components/KpiView.tsx:346` | ✓ |  | `AppPage` | `KampanyaBlok`, `load` |
| 306 | `KullanicilarView` | `src/components/KullanicilarView.tsx:72` | ✓ |  | `AppPage` | `FilterSelect`, `grupBadge`, `load`, `normalizeName` |
| 307 | `lc` | `src/app/api/nihai-prim-bsy/route.ts:47` |  |  | `GET`, `getKisi`, `isExcluded`, `tahsilatOran` | — |
| 308 | `load` | `src/components/AdetPrimView.tsx:186` |  | ✓ | `OzelPrimler` | `authFetch` |
| 309 | `load` | `src/components/AdetPrimView.tsx:466` |  | ✓ | `AdetPrimTablosu`, `saveEdit` | `authFetch` |
| 310 | `load` | `src/components/AdetPrimView.tsx:922` |  | ✓ | `PrimOdemeListesi` | `GET /api/bayi-merch-prim`, `GET /api/merch-detay`, `authFetch`, `cozMerch`, `normOdeme`, `resolveSupName` |
| 311 | `load` | `src/components/AdetPrimView.tsx:1380` |  | ✓ | `BayiMerchHakdis` | `GET /api/bayi-merch-prim` |
| 312 | `load` | `src/components/AdetPrimView.tsx:1573` |  | ✓ | `PrimAnalizView` | `GET /api/prim-analiz` |
| 313 | `load` | `src/components/BsyTakipView.tsx:98` |  | ✓ | `useBsyParametreler` | `authFetch` |
| 314 | `load` | `src/components/BsyView.tsx:30` |  | ✓ | `useBsyParametreler` | `authFetch` |
| 315 | `load` | `src/components/DigerPrimView.tsx:84` |  | ✓ | `DigerPrimView` | `authFetch` |
| 316 | `load` | `src/components/KpiView.tsx:359` |  | ✓ | `KpiView` | `apiUrl`, `hesapla` |
| 317 | `load` | `src/components/KullanicilarView.tsx:131` |  | ✓ | `KullanicilarView`, `handleSync` | `GET /api/merch-detay` |
| 318 | `load` | `src/components/NihaiPrimListesi.tsx:80` |  | ✓ | `NihaiPrimListesi` | `GET /api/merch-detay`, `GET /api/nihai-prim-bsy`, `authFetch`, `mm`, `okey` |
| 319 | `load` | `src/components/PersonelliNoktaAnalizView.tsx:142` |  | ✓ | `PersonelliNoktaAnalizView` | `GET /api/merch-satis-pivot`, `GET /api/personelli-nokta-analiz` |
| 320 | `load` | `src/hooks/useBsyCiro.ts:23` |  | ✓ | `useBsyCiro` | `GET /api/bsy-ciro` |
| 321 | `load` | `src/hooks/useBsyHedef.ts:13` |  | ✓ | `save`, `useBsyHedef` | `authFetch` |
| 322 | `load` | `src/hooks/useBsyKisiHedef.ts:14` |  | ✓ | `save`, `useBsyKisiHedef` | `authFetch` |
| 323 | `load` | `src/hooks/useSellout.ts:38` |  | ✓ | `useSellout` | `GET /api/sellout` |
| 324 | `load` | `src/hooks/useSelloutTargets.ts:31` |  | ✓ | `upsertMerchTargets`, `upsertProfileTargets`, `useSelloutTargets` | `authFetch` |
| 325 | `load` | `src/hooks/useTasks.ts:17` |  | ✓ | `addTask`, `deleteTask`, `updateTask`, `useTasks` | `supabase` |
| 326 | `load` | `src/hooks/useTasks.ts:153` |  | ✓ | `addNote`, `useNotes` | `supabase` |
| 327 | `load` | `src/hooks/useTeam.ts:11` |  | ✓ | `updateBsyLink`, `upsertProfile`, `useTeam` | `supabase` |
| 328 | `loadAdetPrimRates` | `src/lib/adetPrimRates.ts:79` | ✓ | ✓ | `GET`, `loadBayiMerchRateMap` | `loadBaseRates` |
| 329 | `loadBaseRates` | `src/lib/adetPrimRates.ts:15` |  | ✓ | `loadAdetPrimRates` | `downloadBsyExcel`, `fallback` |
| 330 | `loadBayiMerchRateMap` | `src/lib/adetPrimRates.ts:120` | ✓ | ✓ | `GET` | `loadAdetPrimRates` |
| 331 | `loadData` | `src/components/AdminDashboardView.tsx:37` |  | ✓ | `AdminDashboardView` | `GET /api/dashboard`, `GET /api/dashboard-sales`, `GET /api/dashboard-sellout`, `GET /api/dashboard-tahsilat` |
| 332 | `loadData` | `src/components/DestekPersonelHakedisView.tsx:45` |  | ✓ | `DestekPersonelHakedisView` | `GET /api/destek-personel-prim`, `GET /api/sellout`, `authFetch`, `nk` |
| 333 | `loadData` | `src/components/DestekPersoneliPrimView.tsx:39` |  | ✓ | `DestekPersoneliPrimView` | `GET /api/destek-personel-prim`, `GET /api/sellout`, `authFetch` |
| 334 | `loadData` | `src/components/TahsilatPlanimView.tsx:122` |  | ✓ | `TahsilatPlanimView` | `authFetch` |
| 335 | `loadData` | `src/components/TahsilatTakvimiView.tsx:89` |  | ✓ | `TahsilatTakvimiView` | `authFetch` |
| 336 | `loadDestek` | `src/components/NoktalarimizView.tsx:465` |  |  | `NoktalarimizView` | `supabase` |
| 337 | `loadProfile` | `src/hooks/useAuth.ts:50` |  | ✓ | `fetchProfile`, `signIn` | `sleep`, `supabase`, `withTimeout` |
| 338 | `loadSellin` | `src/components/AnalizView.tsx:128` |  | ✓ | `AnalizView`, `onVisible` | `GET /api/sellin-sellout` |
| 339 | `loadSellin` | `src/components/SellinSelloutView.tsx:156` |  | ✓ | `SellinSelloutView` | `GET /api/sellin-sellout` |
| 340 | `loadTahsilat` | `src/components/BsyView.tsx:779` |  |  | `BsyView`, `handleExcelUpload` | `GET /api/tahsilat` |
| 341 | `LoginPage` | `src/app/login/page.tsx:11` | ✓ |  | `/login` | `useAuth` |
| 342 | `looksValid` | `src/lib/merchSatis.ts:97` |  |  | `fetchPhpHtml`, `scheduleRefresh` | — |
| 343 | `marka` | `src/components/AnalizView.tsx:112` |  |  | `AnalizView` | — |
| 344 | `matchesAny` | `src/components/NihaiPrimListesi.tsx:169` |  |  | `NihaiPrimListesi` | `namesMatch` |
| 345 | `merchHesaplari` | `src/components/KullanicilarView.tsx:90` |  | ✓ | — | `GET /api/merch-hesaplari`, `POST /api/merch-hesaplari` |
| 346 | `merchHesaplariOlustur` | `src/lib/merchHesap.ts:80` | ✓ | ✓ | `POST` | `merchHesapPlani`, `newPassword` |
| 347 | `merchHesapPlani` | `src/lib/merchHesap.ts:38` | ✓ | ✓ | `GET`, `merchHesaplariOlustur` | `ascii`, `emailOf`, `fetchPhpHtml`, `parseHtmlTableByHeader` |
| 348 | `MerchSatisPivotTable` | `src/components/MerchSatisPivotTable.tsx:19` | ✓ |  | `PersonelliNoktaAnalizView` | `fmt`, `toggleCari`, `toggleSube` |
| 349 | `merchsOfJr` | `src/components/SelloutView.tsx:604` |  |  | `SelloutView` | `normalizeName` |
| 350 | `merchsOfSup` | `src/components/SelloutView.tsx:553` |  |  | `SelloutView` | `normalizeName` |
| 351 | `mm` | `src/components/NihaiPrimListesi.tsx:20` |  |  | `NihaiPrimListesi`, `load` | — |
| 352 | `MonthView` | `src/app/app/page.tsx:917` |  |  | `AppPage` | `DAYS_SHORT`, `dayTasks`, `hexWithAlpha` |
| 353 | `MultiSelect` | `src/components/SellinSelloutView.tsx:32` |  |  | `SellinSelloutView` | `toggle` |
| 354 | `MultiSelectBox` | `src/components/AdetPrimView.tsx:22` |  |  | `OzelPrimler` | `toggle` |
| 355 | `MultiSelectDropdown` | `src/components/PersonelliNoktaAnalizView.tsx:29` |  |  | `PersonelliNoktaAnalizView` | `toggle` |
| 356 | `namesMatch` | `src/lib/sellout.ts:103` | ✓ |  | `BayiMerchHakdis`, `NihaiPrimListesi`, `SelloutView`, `donemdeAktif`, `isVisible`, `matchesAny`, `supOf` | `normalizeName` |
| 357 | `newPassword` | `src/lib/merchHesap.ts:26` |  |  | `merchHesaplariOlustur` | — |
| 358 | `nextMonth` | `src/app/app/page.tsx:2123` |  |  | — | — |
| 359 | `NihaiPrimListesi` | `src/components/NihaiPrimListesi.tsx:35` | ✓ |  | `AppPage` | `NP_MONTHS_TR`, `computeSelloutPrimForMonth`, `ekOf`, `fmtCur`, `load`, `matchesAny`, `mm`, `namesMatch`, `okey`, `openCell`, `pKey`, `rowKey`, `setAllBulk`, `totalOf`, `useSellout`, `yilTotal` |
| 360 | `nk` | `src/components/DestekPersonelHakedisView.tsx:123` |  |  | `loadData` | — |
| 361 | `NoktalarimizView` | `src/components/NoktalarimizView.tsx:424` | ✓ |  | `AppPage` | `FilterSelect`, `SubeDetail`, `buildSubeListFromDetay`, `loadDestek`, `reload` |
| 362 | `norm` | `src/app/api/personelli-nokta-analiz/route.ts:32` |  |  | `GET` | — |
| 363 | `norm` | `src/components/AdetPrimView.tsx:1589` |  |  | `PrimAnalizView` | — |
| 364 | `normalize` | `src/app/api/destek-personel-prim/route.ts:26` |  |  | `GET`, `shortCari` | — |
| 365 | `normalizeName` | `src/lib/sellout.ts:92` | ✓ |  | `AppPage`, `CariSubeModal`, `DigerPrimView`, `GET`, `KullanicilarView`, `SelloutView`, `buildJrResolver`, `buildSubeListFromDetay`, `findProfile`, `getGerc`, `jrsOfSupName`, `merchsOfJr`, `merchsOfSup`, `namesMatch`, `onKullanici`, `ozelSubeKey`, `subeKey`, `subesOfJr`, `subesOfSup` | — |
| 366 | `normalizeText` | `src/app/api/dashboard-tahsilat/route.ts:43` |  |  | `GET` | — |
| 367 | `normHeader` | `src/app/api/nihai-prim-bsy/route.ts:108` |  |  | `GET` | — |
| 368 | `normKisi` | `src/lib/merchSatis.ts:216` |  |  | `applySupervisorOverride` | — |
| 369 | `normOdeme` | `src/components/AdetPrimView.tsx:801` |  |  | `PrimOdemeListesi`, `cozMerch`, `dupKey`, `duzeltIsim`, `hesaplaOdenecek`, `load` | — |
| 370 | `normStok` | `src/components/AnalizView.tsx:40` |  |  | `AnalizView` | — |
| 371 | `normStr` | `src/app/api/bayi-merch-prim/route.ts:65` |  |  | `findOzelRule` | — |
| 372 | `normStr` | `src/app/api/prim-analiz/route.ts:59` |  |  | `findOzelRule` | — |
| 373 | `normStr` | `src/components/SelloutView.tsx:800` |  |  | `findOzel` | — |
| 374 | `normSupName` | `src/components/AdetPrimView.tsx:796` |  |  | `PrimOdemeListesi`, `resolveSupName` | — |
| 375 | `normTr` | `src/app/api/tahsilat-gerceklesen/route.ts:34` |  |  | `GET`, `paymentBucket` | — |
| 376 | `num` | `src/lib/merchSatis.ts:325` | ✓ |  | `GET`, `fetchPhpSellout`, `parseHtmlTable` | — |
| 377 | `numVal` | `src/components/AdetPrimView.tsx:228` |  |  | `OzelPrimler` | — |
| 378 | `okey` | `src/components/NihaiPrimListesi.tsx:74` |  |  | `NihaiPrimListesi`, `ekOf`, `load`, `openCell`, `saveBulk`, `saveOdeme` | — |
| 379 | `onKey` | `src/components/DigerPrimView.tsx:371` |  |  | — | `onClose` |
| 380 | `onKullanici` | `src/components/DigerPrimView.tsx:116` |  |  | `DigerPrimView` | `edit`, `normalizeName`, `subeKey` |
| 381 | `onVisible` | `src/components/AnalizView.tsx:149` |  |  | — | `loadSellin` |
| 382 | `openCell` | `src/components/NihaiPrimListesi.tsx:238` |  |  | `NihaiPrimListesi` | `ekOf`, `okey` |
| 383 | `openDropdown` | `src/components/AdetPrimView.tsx:48` |  |  | — | — |
| 384 | `oran` | `src/components/BsyTakipView.tsx:433` |  |  | `KisiHedefModal` | — |
| 385 | `OranBadge` | `src/components/AnalizView.tsx:89` |  |  | `AnalizView` | `pctStr` |
| 386 | `OranCell` | `src/components/BsyTakipView.tsx:627` |  |  | `BsyKisiTable` | `fmtPct` |
| 387 | `OranCell` | `src/components/BsyView.tsx:592` |  |  | `BsyKisiTable` | `fmtPct` |
| 388 | `OzelPrimler` | `src/components/AdetPrimView.tsx:169` |  |  | `AdetPrimTablosu` | `ADET_PRIM_DEFAULTS`, `ArrayBadge`, `EMPTY_OZEL`, `GET /api/merch-options`, `MultiSelectBox`, `deleteRow`, `eVal`, `load`, `numVal`, `parseNum`, `saveEdit`, `stokOptionsFor` |
| 389 | `ozelSubeAdetleri` | `src/lib/ozelUygulama.ts:41` | ✓ |  | `SelloutView`, `buildOzelCarpan` | `getOzelGruplar`, `ozelSubeKey` |
| 390 | `ozelSubeKey` | `src/lib/ozelUygulama.ts:34` | ✓ |  | `buildOzelCarpan`, `ozelSubeAdetleri` | `normalizeName` |
| 391 | `ParametreGirModal` | `src/components/BsyTakipView.tsx:196` |  |  | `BsyTakipView` | `TierTable`, `set` |
| 392 | `ParametreGirModal` | `src/components/BsyView.tsx:55` |  |  | `BsyView` | `TierTable`, `set` |
| 393 | `ParametrelerModal` | `src/components/BsyTakipView.tsx:137` |  |  | `BsyTakipView` | — |
| 394 | `ParametrelerModal` | `src/components/BsyView.tsx:167` |  |  | `BsyView` | `authFetch` |
| 395 | `parseCur` | `src/components/BsyTakipView.tsx:132` |  |  | `handleSave` | — |
| 396 | `parseCur` | `src/components/BsyView.tsx:161` |  |  | `handleSave` | — |
| 397 | `parseHtmlTable` | `src/app/api/sellout/route.ts:73` |  |  | `GET` | `num`, `parseHtmlTableByHeader` |
| 398 | `parseHtmlTableByHeader` | `src/lib/merchSatis.ts:284` | ✓ |  | `GET`, `buildJrResolver`, `fetchPhpSellout`, `merchHesapPlani`, `parseHtmlTable` | `applyBsyOverride`, `applySupervisorOverride`, `decodeHtml` |
| 399 | `parseNum` | `src/components/AdetPrimView.tsx:229` |  |  | `OzelPrimler` | — |
| 400 | `patch` | `src/components/DigerPrimView.tsx:107` |  |  | `edit`, `saveRow` | — |
| 401 | `paymentBucket` | `src/app/api/tahsilat-gerceklesen/route.ts:48` |  |  | `GET` | `normTr` |
| 402 | `pct` | `src/components/BsyView.tsx:409` |  |  | `KisiHedefModal` | — |
| 403 | `pct` | `src/components/SelloutView.tsx:137` |  |  | `SelloutView` | — |
| 404 | `PctBadge` | `src/components/SelloutView.tsx:141` |  |  | `SelloutTable` | — |
| 405 | `pctStr` | `src/components/AnalizView.tsx:49` |  |  | `AnalizView`, `OranBadge`, `RiskBadge` | — |
| 406 | `PersonelliNoktaAnalizView` | `src/components/PersonelliNoktaAnalizView.tsx:107` | ✓ |  | `AppPage` | `MerchSatisPivotTable`, `MultiSelectDropdown`, `applyButce`, `effectivePSayisi`, `fmt`, `fmtPct`, `getButce`, `getPersonelAy`, `load` |
| 407 | `PersonSheet` | `src/app/app/page.tsx:789` |  |  | `AppPage` | `Avatar`, `renderRow` |
| 408 | `phpEntry` | `src/app/api/destek-personel-prim/route.ts:100` |  |  | `GET` | `shortCari` |
| 409 | `pKey` | `src/components/NihaiPrimListesi.tsx:311` |  |  | `NihaiPrimListesi`, `saveBulk`, `setAllBulk` | — |
| 410 | `POST` | `src/app/api/bsy-excel-presign/route.ts:8` | ✓ | ✓ | — | `requireRole` |
| 411 | `POST` | `src/app/api/bsy-excel-upload/route.ts:11` | ✓ | ✓ | — | `requireRole` |
| 412 | `POST` | `src/app/api/bsy-hedef/route.ts:48` | ✓ | ✓ | — | `BRAND_KEYS`, `getAdmin`, `requireRole` |
| 413 | `POST` | `src/app/api/bsy-kisi-hedef/route.ts:53` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 414 | `POST` | `src/app/api/bsy-param-img/route.ts:35` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 415 | `POST` | `src/app/api/bsy-parametreler/route.ts:19` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 416 | `POST` | `src/app/api/destek-hakedis/route.ts:42` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 417 | `POST` | `src/app/api/destek-personel/bulk-import/route.ts:108` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 418 | `POST` | `src/app/api/destek-personel/route.ts:39` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 419 | `POST` | `src/app/api/diger-prim/route.ts:58` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 420 | `POST` | `src/app/api/merch-destek-flag/route.ts:33` | ✓ | ✓ | — | `getAdmin`, `requireRole` |
| 421 | `POST` | `src/app/api/merch-hesaplari/route.ts:44` | ✓ | ✓ | — | `merchHesaplariOlustur`, `requireAdmin` |
| 422 | `POST` | `src/app/api/nihai-prim-ek/route.ts:37` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 423 | `POST` | `src/app/api/nihai-prim-odeme/route.ts:43` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 424 | `POST` | `src/app/api/personnel-excel-sync/route.ts:24` | ✓ | ✓ | — | `requireRole`, `sb` |
| 425 | `POST` | `src/app/api/prim-ozel/route.ts:29` | ✓ | ✓ | — | `requireRole`, `sb` |
| 426 | `POST` | `src/app/api/sellout-aciklama/route.ts:36` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 427 | `POST` | `src/app/api/sellout-targets/route.ts:42` | ✓ | ✓ | — | `authed`, `yetkisiz` |
| 428 | `POST` | `src/app/api/tahsilat-planim/bulk-import/route.ts:6` | ✓ | ✓ | — | `requireRole` |
| 429 | `POST` | `src/app/api/tahsilat-planim/route.ts:232` | ✓ | ✓ | — | `requireRole` |
| 430 | `prefixKey` | `src/app/api/personelli-nokta-analiz/route.ts:43` |  |  | `GET` | — |
| 431 | `prevMonth` | `src/app/app/page.tsx:2119` |  |  | — | — |
| 432 | `PrimAnalizView` | `src/components/AdetPrimView.tsx:1559` | ✓ |  | `AppPage` | `fmtTL`, `load`, `norm` |
| 433 | `PrimOdemeListesi` | `src/components/AdetPrimView.tsx:869` | ✓ |  | `AppPage` | `dupKey`, `formatIban`, `hesaplaOdenecek`, `load`, `normOdeme`, `normSupName`, `supabase` |
| 434 | `profileById` | `src/hooks/useTeam.ts:57` |  |  | `AppPage` | — |
| 435 | `proxy` | `src/proxy.ts:18` | ✓ | ✓ | — | — |
| 436 | `PUT` | `src/app/api/adet-prim/route.ts:83` | ✓ | ✓ | — | `getSupabase`, `requireRole` |
| 437 | `PUT` | `src/app/api/prim-ozel/route.ts:59` | ✓ | ✓ | — | `requireRole`, `sb` |
| 438 | `r2` | `src/components/SelloutView.tsx:935` |  |  | `exportSatislarExcel` | — |
| 439 | `readCache` | `src/hooks/useAuth.ts:19` |  |  | `init` | — |
| 440 | `reload` | `src/components/NoktalarimizView.tsx:440` |  | ✓ | `NoktalarimizView`, `handleRefresh` | `GET /api/merch-detay` |
| 441 | `removeNewRow` | `src/components/AdetPrimView.tsx:500` |  |  | `AdetPrimTablosu` | — |
| 442 | `renderRow` | `src/app/app/page.tsx:633` |  |  | `Sidebar` | `Avatar` |
| 443 | `renderRow` | `src/app/app/page.tsx:802` |  |  | `PersonSheet` | `Avatar` |
| 444 | `ReportView` | `src/app/app/page.tsx:1600` |  |  | `AppPage` | `VISIT_TYPES` |
| 445 | `requireAdmin` | `src/app/api/merch-hesaplari/route.ts:22` |  | ✓ | `GET`, `POST` | `getAdminClient` |
| 446 | `requireRole` | `src/lib/apiAuth.ts:28` | ✓ | ✓ | `DELETE`, `GET`, `POST`, `PUT` | `anonClient` |
| 447 | `resetPassword` | `src/hooks/useAuth.ts:193` |  | ✓ | `handleReset` | `withTimeout` |
| 448 | `ResetPasswordPage` | `src/app/auth/reset-password/page.tsx:11` | ✓ |  | `/auth/reset-password` | — |
| 449 | `resolveSupName` | `src/components/AdetPrimView.tsx:915` |  |  | `load` | `normSupName` |
| 450 | `RiskBadge` | `src/components/AnalizView.tsx:97` |  |  | `AnalizView` | `pctStr` |
| 451 | `RootLayout` | `src/app/layout.tsx:27` | ✓ |  | — | `ApiAuthFetch` |
| 452 | `RootPage` | `src/app/page.tsx:9` | ✓ |  | `/` | — |
| 453 | `rowKey` | `src/components/DestekPersonelHakedisView.tsx:42` |  |  | `DestekPersonelHakedisView`, `handleHakedisChange` | — |
| 454 | `rowKey` | `src/components/NihaiPrimListesi.tsx:121` |  |  | `NihaiPrimListesi` | — |
| 455 | `runAfter` | `src/lib/merchSatis.ts:115` |  |  | `fetchPhpHtml`, `scheduleRefresh` | — |
| 456 | `save` | `src/components/BsyTakipView.tsx:110` |  | ✓ | — | `authFetch` |
| 457 | `save` | `src/components/BsyView.tsx:40` |  | ✓ | — | `authFetch` |
| 458 | `save` | `src/hooks/useBsyHedef.ts:37` |  | ✓ | — | `authFetch`, `load` |
| 459 | `save` | `src/hooks/useBsyKisiHedef.ts:52` |  | ✓ | — | `authFetch`, `load` |
| 460 | `saveBulk` | `src/components/NihaiPrimListesi.tsx:340` |  | ✓ | — | `authFetch`, `okey`, `pKey` |
| 461 | `saveEdit` | `src/components/AdetPrimView.tsx:252` |  | ✓ | `OzelPrimler` | `authFetch` |
| 462 | `saveEdit` | `src/components/AdetPrimView.tsx:510` |  | ✓ | — | `authFetch`, `load` |
| 463 | `saveOdeme` | `src/components/NihaiPrimListesi.tsx:251` |  | ✓ | — | `authFetch`, `okey` |
| 464 | `saveRow` | `src/components/DestekPersonelHakedisView.tsx:206` |  | ✓ | `handleHakedisChange` | `authFetch` |
| 465 | `saveRow` | `src/components/DigerPrimView.tsx:135` |  | ✓ | `DigerPrimView` | `adetOf`, `authFetch`, `patch`, `toNum` |
| 466 | `saveSecim` | `src/components/TahsilatPlanimView.tsx:195` |  | ✓ | `TahsilatPlanimView` | `authFetch` |
| 467 | `SayfaParametreleri` | `src/components/SayfaParametreleri.tsx:21` | ✓ |  | `DestekPersonelHakedisView`, `SelloutView` | — |
| 468 | `sb` | `src/app/api/personnel-excel-sync/route.ts:5` |  |  | `POST` | — |
| 469 | `sb` | `src/app/api/prim-ozel/route.ts:5` |  |  | `DELETE`, `GET`, `POST`, `PUT` | — |
| 470 | `scheduleRefresh` | `src/lib/merchSatis.ts:119` |  |  | `fetchPhpHtml` | `fetchFromPhp`, `looksValid`, `runAfter`, `storeTryLock`, `storeWrite` |
| 471 | `Section` | `src/components/AnalizView.tsx:57` |  |  | `AnalizView` | — |
| 472 | `SellinSelloutView` | `src/components/SellinSelloutView.tsx:146` | ✓ |  | `AppPage` | `MultiSelect`, `SingleSelect`, `fmtNum`, `fmtPct`, `loadSellin`, `useSellout` |
| 473 | `SelloutAciklama` | `src/components/SelloutAciklama.tsx:9` | ✓ |  | `SelloutView` | `authFetch` |
| 474 | `SelloutTable` | `src/components/SelloutView.tsx:2144` |  |  | `SelloutView` | `PctBadge`, `SELLOUT_GROUPS`, `fmtCur` |
| 475 | `SelloutView` | `src/components/SelloutView.tsx:360` | ✓ |  | `AppPage` | `GET /api/merch-detay`, `SELLOUT_GROUPS`, `SayfaParametreleri`, `SelloutAciklama`, `SelloutTable`, `TargetEntryModal`, `Top20Table`, `authFetch`, `buildOzelCarpan`, `calcPrim`, `calcTop20`, `donemLabel`, `donemOptions`, `donemdeAktif`, `fmt2`, `getEffectiveBayiMerch`, `getEffectiveKosulluDestek`, `getMerchHedef`, `getOzelGruplar`, `getProfileHedef`, `jrsOf`, `jrsOfSupName`, `merchsOfJr`, `merchsOfSup`, `namesMatch`, `normalizeName`, `ozelSubeAdetleri`, `pct`, `strip`, `subesOfJr`, `subesOfSup`, `supOf`, `useSellout`, `useSelloutTargets` |
| 476 | `set` | `src/components/BsyTakipView.tsx:205` |  |  | `ParametreGirModal`, `TierTable` | — |
| 477 | `set` | `src/components/BsyTakipView.tsx:335` |  |  | `HedefModal` | — |
| 478 | `set` | `src/components/BsyView.tsx:63` |  |  | `ParametreGirModal`, `TierTable` | — |
| 479 | `set` | `src/components/BsyView.tsx:287` |  |  | `HedefModal` | — |
| 480 | `set` | `src/components/SelloutView.tsx:201` |  |  | `TargetEntryModal` | — |
| 481 | `setAllBulk` | `src/components/NihaiPrimListesi.tsx:335` |  |  | `NihaiPrimListesi` | `pKey` |
| 482 | `setDestek` | `src/components/SelloutView.tsx:204` |  |  | `TargetEntryModal` | — |
| 483 | `setGizle` | `src/components/SelloutView.tsx:207` |  |  | `TargetEntryModal` | — |
| 484 | `shortCari` | `src/app/api/destek-personel-prim/route.ts:58` |  |  | `GET`, `phpEntry` | `normalize` |
| 485 | `shortenCari` | `src/app/api/dashboard-sellout/route.ts:143` |  |  | `calculateTop10` | — |
| 486 | `Sidebar` | `src/app/app/page.tsx:617` |  |  | `AppPage` | `Avatar`, `renderRow` |
| 487 | `signIn` | `src/hooks/useAuth.ts:152` |  | ✓ | `handleLogin` | `isNetworkError`, `loadProfile`, `withTimeout`, `writeCache` |
| 488 | `signOut` | `src/hooks/useAuth.ts:185` |  | ✓ | `AppPage` | `dropCache`, `withTimeout` |
| 489 | `SingleSelect` | `src/components/SellinSelloutView.tsx:109` |  |  | `SellinSelloutView` | — |
| 490 | `sleep` | `src/hooks/useAuth.ts:47` |  |  | `loadProfile` | — |
| 491 | `startEdit` | `src/components/AdetPrimView.tsx:480` |  |  | — | — |
| 492 | `StatsSheet` | `src/app/app/page.tsx:1767` |  |  | `AppPage` | `Avatar`, `MONTHS_TR`, `TASK_TYPES`, `useTasks` |
| 493 | `StatusBadge` | `src/components/AnalizView.tsx:104` |  |  | `AnalizView` | — |
| 494 | `stokOptionsFor` | `src/components/AdetPrimView.tsx:219` |  |  | `OzelPrimler` | — |
| 495 | `storeClient` | `src/lib/merchSatis.ts:36` |  |  | `storeRead`, `storeTryLock`, `storeWrite` | — |
| 496 | `storePath` | `src/lib/merchSatis.ts:44` |  |  | `storeRead`, `storeTryLock`, `storeWrite` | — |
| 497 | `storeRead` | `src/lib/merchSatis.ts:48` |  | ✓ | `fetchPhpHtml` | `storeClient`, `storePath` |
| 498 | `storeTryLock` | `src/lib/merchSatis.ts:79` |  | ✓ | `scheduleRefresh` | `storeClient`, `storePath` |
| 499 | `storeWrite` | `src/lib/merchSatis.ts:64` |  | ✓ | `fetchPhpHtml`, `scheduleRefresh` | `storeClient`, `storePath` |
| 500 | `strip` | `src/components/SelloutView.tsx:688` |  |  | `SelloutView` | — |
| 501 | `SubeDetail` | `src/components/NoktalarimizView.tsx:184` |  |  | `NoktalarimizView` | `Avatar`, `authFetch`, `handleAdd`, `handleDelete` |
| 502 | `subeKey` | `src/components/DigerPrimView.tsx:41` |  |  | `adetOf`, `onKullanici` | `normalizeName` |
| 503 | `subesOfJr` | `src/components/SelloutView.tsx:587` |  |  | `SelloutView` | `normalizeName` |
| 504 | `subesOfSup` | `src/components/SelloutView.tsx:536` |  |  | `SelloutView` | `normalizeName` |
| 505 | `SummaryRow` | `src/components/BsyTakipView.tsx:861` |  |  | `BsyTakipView` | — |
| 506 | `SummaryRow` | `src/components/BsyView.tsx:1406` |  |  | — | — |
| 507 | `supOf` | `src/components/SelloutView.tsx:1122` |  |  | `SelloutView` | `namesMatch` |
| 508 | `TahsilatDetayTablosu` | `src/components/BsyView.tsx:1234` |  |  | `BsyView` | `fmtCur` |
| 509 | `tahsilatOran` | `src/app/api/nihai-prim-bsy/route.ts:169` |  |  | `GET` | `lc` |
| 510 | `TahsilatPlanimView` | `src/components/TahsilatPlanimView.tsx:100` | ✓ |  | `AppPage` | `getHaftaSecenekleri`, `kisaltCariIsim`, `loadData`, `saveSecim` |
| 511 | `TahsilatTablosu` | `src/components/BsyTakipView.tsx:780` |  |  | `BsyTakipView` | `fmtCur`, `fmtPct` |
| 512 | `TahsilatTablosu` | `src/components/BsyView.tsx:1119` |  |  | `BsyView` | `fmtCur`, `fmtPct` |
| 513 | `TahsilatTakvimiView` | `src/components/TahsilatTakvimiView.tsx:81` | ✓ |  | `AppPage` | `fmtCur`, `getHaftaSecenekleri`, `loadData` |
| 514 | `TargetEntryModal` | `src/components/SelloutView.tsx:162` |  |  | `SelloutView` | `donemLabel`, `set`, `setDestek`, `setGizle` |
| 515 | `tarihToIso` | `src/components/SelloutView.tsx:29` |  |  | `findOzel` | — |
| 516 | `tarihToIso` | `src/lib/merchSatis.ts:178` | ✓ |  | `GET` | — |
| 517 | `tasksForDay` | `src/hooks/useTasks.ts:47` |  |  | — | — |
| 518 | `tasksForDayHour` | `src/app/app/page.tsx:1047` |  |  | `WeekView` | — |
| 519 | `tasksForHour` | `src/app/app/page.tsx:1144` |  |  | `DayView` | — |
| 520 | `TaskSheet` | `src/app/app/page.tsx:80` |  |  | `AppPage` | `TASK_TYPES`, `fetchCustomers`, `handleAddNote`, `useNotes` |
| 521 | `tierRate` | `src/components/BsyTakipView.tsx:50` |  |  | `calcTieredPrim` | — |
| 522 | `tierRate` | `src/lib/bsy.ts:236` |  |  | `calcTieredPrimBsy` | — |
| 523 | `TierTable` | `src/components/BsyTakipView.tsx:212` |  |  | `ParametreGirModal` | `set` |
| 524 | `TierTable` | `src/components/BsyView.tsx:66` |  |  | `ParametreGirModal` | `set` |
| 525 | `toggle` | `src/components/AdetPrimView.tsx:60` |  |  | `MultiSelectBox` | — |
| 526 | `toggle` | `src/components/PersonelliNoktaAnalizView.tsx:42` |  |  | `MultiSelectDropdown` | — |
| 527 | `toggle` | `src/components/SellinSelloutView.tsx:51` |  |  | `MultiSelect` | — |
| 528 | `toggleCari` | `src/components/MerchSatisPivotTable.tsx:27` |  |  | `MerchSatisPivotTable` | — |
| 529 | `toggleSlot` | `src/components/PersonelliNoktaAnalizView.tsx:173` |  |  | — | — |
| 530 | `toggleSube` | `src/components/MerchSatisPivotTable.tsx:30` |  |  | `MerchSatisPivotTable` | — |
| 531 | `toNum` | `src/app/api/dashboard-sales/route.ts:31` |  |  | `GET` | — |
| 532 | `toNum` | `src/app/api/dashboard-tahsilat/route.ts:37` |  |  | `GET` | — |
| 533 | `toNum` | `src/app/api/nihai-prim-bsy/route.ts:41` |  |  | `GET` | — |
| 534 | `toNum` | `src/app/api/tahsilat-gerceklesen/route.ts:27` |  |  | `GET` | — |
| 535 | `toNum` | `src/app/api/tahsilat-planim/route.ts:33` |  |  | `GET` | — |
| 536 | `toNum` | `src/app/api/tahsilat/route.ts:35` |  |  | `GET` | — |
| 537 | `toNum` | `src/components/BsyTakipView.tsx:425` |  |  | `KisiHedefModal`, `handleSave` | — |
| 538 | `toNum` | `src/components/BsyView.tsx:403` |  |  | `KisiHedefModal`, `handleSave` | — |
| 539 | `toNum` | `src/components/DigerPrimView.tsx:43` |  |  | `DigerPrimView`, `saveRow` | — |
| 540 | `toOpt` | `src/app/app/page.tsx:152` |  |  | `fetchCustomers` | — |
| 541 | `Top20Table` | `src/components/SelloutView.tsx:54` |  |  | `SelloutView` | — |
| 542 | `TopCard` | `src/components/AdminDashboardView.tsx:577` |  |  | `AdminDashboardView` | `fmtN` |
| 543 | `totalOf` | `src/components/NihaiPrimListesi.tsx:202` |  |  | `NihaiPrimListesi`, `exportExcel`, `yilTotal` | `ekOf` |
| 544 | `updateBsyLink` | `src/hooks/useTeam.ts:61` |  | ✓ | — | `load`, `supabase` |
| 545 | `updateDraft` | `src/components/AdetPrimView.tsx:504` |  |  | `AdetPrimTablosu` | — |
| 546 | `updateNewRow` | `src/components/AdetPrimView.tsx:496` |  |  | `AdetPrimTablosu` | — |
| 547 | `updateTask` | `src/hooks/useTasks.ts:83` |  | ✓ | `checkIn`, `handleUpdateTask` | `load`, `supabase` |
| 548 | `upsertMerchTargets` | `src/hooks/useSelloutTargets.ts:71` |  | ✓ | `handleSave` | `authFetch`, `load` |
| 549 | `upsertProfile` | `src/hooks/useTeam.ts:71` |  | ✓ | — | `load`, `supabase` |
| 550 | `upsertProfileTargets` | `src/hooks/useSelloutTargets.ts:58` |  | ✓ | `handleSave` | `authFetch`, `load` |
| 551 | `useAuth` | `src/hooks/useAuth.ts:70` | ✓ |  | `AppPage`, `LoginPage` | `dropCache`, `fetchProfile`, `init` |
| 552 | `useBsyCiro` | `src/hooks/useBsyCiro.ts:16` | ✓ |  | `BsyTakipView`, `BsyView` | `BRAND_KEYS`, `load` |
| 553 | `useBsyHedef` | `src/hooks/useBsyHedef.ts:7` | ✓ |  | `BsyTakipView`, `BsyView` | `BRAND_KEYS`, `load` |
| 554 | `useBsyKisiHedef` | `src/hooks/useBsyKisiHedef.ts:7` | ✓ |  | `BsyTakipView`, `BsyView` | `load` |
| 555 | `useBsyParametreler` | `src/components/BsyTakipView.tsx:94` |  |  | `BsyTakipView` | `load` |
| 556 | `useBsyParametreler` | `src/components/BsyView.tsx:27` |  |  | `BsyView` | `load` |
| 557 | `useNotes` | `src/hooks/useTasks.ts:149` | ✓ |  | `TaskSheet` | `load` |
| 558 | `useSellout` | `src/hooks/useSellout.ts:32` | ✓ |  | `AnalizView`, `NihaiPrimListesi`, `SellinSelloutView`, `SelloutView` | `load` |
| 559 | `useSelloutTargets` | `src/hooks/useSelloutTargets.ts:25` | ✓ |  | `SelloutView` | `load` |
| 560 | `useTasks` | `src/hooks/useTasks.ts:6` | ✓ |  | `AppPage`, `StatsSheet` | `load` |
| 561 | `useTeam` | `src/hooks/useTeam.ts:6` | ✓ |  | `AppPage` | `load` |
| 562 | `visibleIds` | `src/hooks/useTeam.ts:34` |  |  | `AppPage` | — |
| 563 | `VisitsMap` | `src/app/app/page.tsx:1206` |  |  | `CompletedVisitsView` | `initMap` |
| 564 | `WeekView` | `src/app/app/page.tsx:1025` |  |  | `AppPage` | `hexWithAlpha`, `tasksForDayHour` |
| 565 | `withTimeout` | `src/hooks/useAuth.ts:40` |  |  | `init`, `loadProfile`, `resetPassword`, `signIn`, `signOut` | — |
| 566 | `writeCache` | `src/hooks/useAuth.ts:31` |  |  | `fetchProfile`, `signIn` | — |
| 567 | `yetkisiz` | `src/app/api/sellout-targets/route.ts:23` |  |  | `GET`, `POST` | — |
| 568 | `yilTotal` | `src/components/NihaiPrimListesi.tsx:204` |  |  | `NihaiPrimListesi`, `exportExcel` | `totalOf` |

## Ek: CodeGraph'ın fonksiyon olarak saymadığı useCallback'ler (1)

Bunlar kaynak koddan tarandı; CodeGraph'ta fonksiyon düğümü olarak yer almıyor.

| # | Fonksiyon | Konum |
|---|---|---|
| 1 | `getGerc` | `src/components/SelloutView.tsx:734` |
