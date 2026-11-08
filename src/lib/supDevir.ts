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
