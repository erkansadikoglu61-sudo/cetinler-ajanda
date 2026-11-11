// ── Süpervizör devri (istemci + sunucu ortak, bağımlılıksız) ─────────
// Atilla Yılmaz'ın ekibi: aşağıdaki personelin 2026-01..2026-09 arası TÜM
// satışları (merch tipi ne olursa olsun) Atilla Yılmaz'a yazılır; satış diğer
// süpervizörden düşer (her satış tek kez sayılır). 2026-10 ve sonrası satış
// verisindeki yetkilendirme (SUPERVISOR_ADI) aynen kullanılır.
// Satış ataması lib/merchSatis (parseHtmlTableByHeader) içinde uygulanır.
import { normalizeName } from './sellout'

export const ATILLA_SUP = 'Atilla Yılmaz SV'

export const SUP_OVERRIDES: { sup: string; from: string; to: string; merchler: string[] }[] = [
  {
    sup: ATILLA_SUP, from: '2026-01', to: '2026-09',
    merchler: [
      'Dilan Yıkılmaz', 'Betül Keser', 'Aslı Gökmen', 'Hafize Gökçe', 'Hanife Yüksel',
      'Şerife Karaahmetoğlu', 'Beyhan Bülbül Özlü', 'Neslihan Bulut', 'Ceren Ela Koçbay',
      'Emine Şen', 'Özen Özdil', 'Güldem Tunçöz', 'Pınar Avcı',
    ],
  },
]

// ── Devir dönemi (Eylül 2026) ────────────────────────────────────────
// Atilla Yılmaz'ın son ayı. Bu ayın satışları Atilla'da KALIR (hedef,
// gerçekleşme, prim hesapları değişmez). Ancak Eylül destek personeli
// hakedişlerini şubelerin GÜNCEL (Ekim ve sonrası) süpervizörleri dağıtır:
//   • Destek Personeli sayfası: bu ekipteki Çetinler Merch'lerin satırları,
//     "Destek Personeli var mı?" bayrağı Eylül'de işaretlenmemiş olsa da
//     güncel süpervizöre/Jr'a gösterilir (bayrağı Atilla girecekti).
//   • Sellout ▸ Satışlar: şubesi artık kendisine ait olan Atilla satırları
//     güncel süpervizöre BİLGİ AMAÇLI gösterilir; toplamlara katılmaz.
export const DEVIR_DONEMI = '2026-09'

const devirMerchSet = new Set(
  SUP_OVERRIDES.filter(o => DEVIR_DONEMI >= o.from && DEVIR_DONEMI <= o.to)
    .flatMap(o => o.merchler.map(normalizeName)),
)
const devirSupSet = new Set(
  SUP_OVERRIDES.filter(o => DEVIR_DONEMI >= o.from && DEVIR_DONEMI <= o.to)
    .map(o => normalizeName(o.sup)),
)

/** Devir döneminde satışı devredilen süpervizöre yazılan Çetinler Merch mi? */
export function isDevirMerch(merch: string): boolean {
  return devirMerchSet.has(normalizeName(merch))
}

/** Satış satırının süpervizörü devir döneminde ayrılan süpervizör mü? */
export function isDevirSup(supApiName: string): boolean {
  return devirSupSet.has(normalizeName(supApiName))
}

// ── Jr. Süpervizör devirleri ─────────────────────────────────────────
// Satışın Jr'ı 2026-09'dan beri B2B'nin GÜNCEL atamasından okunuyor
// (api/sellout). B2B'de şubeler yeni Jr'a geçince eski Jr'ın geçmiş ay
// satışları da yeni Jr'a kayıyordu → yeni Jr'ın hedef/primi bozuluyor, eski
// Jr'ın geçmişi boşalıyordu. ilkDonem'den ÖNCEKİ dönemlerde satış eski Jr'da
// kalır. Yeni Jr eski Jr'ın geçmiş verilerini (Takvim, Sellout) GÖRÜR ama
// bunlar kendi hedef/primine katılmaz (ayrı satırda, eski Jr adına).
export const JR_DEVIRLERI: { eski: string; yeni: string; ilkDonem: string }[] = [
  { eski: 'Merve İnci', yeni: 'Burçin Acar', ilkDonem: '2026-11' },  // Merve son ay: Ekim 2026
]

/** Satış dönemine göre Jr adı: yeni Jr'ın başlangıcından önceki dönemde eski Jr. */
export function donemJrAdi(jr: string, donem: string): string {
  const d = JR_DEVIRLERI.find(x => normalizeName(x.yeni) === normalizeName(jr) && donem < x.ilkDonem)
  return d ? d.eski : jr
}

/** Kişinin devraldığı (öncülü olan) Jr adları — geçmiş verilerini görebilsin diye. */
export function devraldiklari(ad: string): string[] {
  return JR_DEVIRLERI.filter(x => normalizeName(x.yeni) === normalizeName(ad)).map(x => x.eski)
}
