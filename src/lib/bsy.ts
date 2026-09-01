// BSY Hedef Takip — paylaşılan tipler, sabitler ve prim motoru

/** Sellout verisi içindeki BSY kodu → profil tam adı
 *  Değerler Supabase profiles.full_name ile AYNI olmalı */
export const BSY_KOD_TO_NAME: Record<string, string> = {
  KB1:  'Erdem BOZYEL',
  IB1:  'Burak KILIÇ',
  IB2:  'Okan OĞUZ',
  MB5:  'Kemal TUNALI',
  EB1:  'Orçun SOYUBİTMEZ',
  MB1:  'Mehmet KATIRCI',
  MB2:  'Mustafa CETİNKAYA',
  MB4:  'Mutlu TOPAY',
  MB9:  'Atilla YILMAZ',
  MB10: 'Erkan SADIKOĞLU',
}

/** Profil tam adı (küçük harf, Türkçe) → BSY kodu */
export const BSY_NAME_TO_KOD: Record<string, string> = Object.fromEntries(
  Object.entries(BSY_KOD_TO_NAME).map(([k, v]) => [v.toLocaleLowerCase('tr'), k])
)

export const BRAND_KEYS = ['ELECTROLUX', 'RELUX', 'ELECTROLUX BEYAZ EŞYA'] as const
export type BrandKey = (typeof BRAND_KEYS)[number]

export const BRAND_LABEL: Record<BrandKey, string> = {
  'ELECTROLUX':             'Electrolux',
  'RELUX':                  'Relux',
  'ELECTROLUX BEYAZ EŞYA':  'Electrolux Beyaz Eşya',
}

export const GRUP_TO_BRAND: Record<string, BrandKey> = {
  EKEA:  'ELECTROLUX',
  RELUX: 'RELUX',
  EBE:   'ELECTROLUX BEYAZ EŞYA',
}

// ─── API tipleri ───────────────────────────────────────────────
export interface BsyCiroRow {
  bsyAdi:   string
  brand:    BrandKey
  yil:      number
  ay:       number
  gercCiro: number
}

export interface BsyCiroResponse {
  rows:       BsyCiroRow[]
  yillar:     number[]
  fetched_at: string
  source:     'excel' | 'empty'
}

export interface BsyHedefRecord {
  id?:        string
  yil:        number
  ay:         number
  brand:      BrandKey
  hedefCiro:  number
  toplamPrim: number
  enteredBy?: string
}

// ─── Pivot satır (hook'dan gelir) ─────────────────────────────
export interface BsyBrandRow {
  bsyAdi:         string
  brands:         Record<BrandKey, { gercCiro: number }>
  toplamGercCiro: number
}

// ─── Yeni layout (ay ≥ 5) per-BSY per-brand tipleri ──────────
// Sadece Electrolux ve Relux ayrı kolon olarak gösterilir
export const NEW_LAYOUT_BRANDS = ['ELECTROLUX', 'RELUX'] as const satisfies readonly BrandKey[]
export type NewLayoutBrand = (typeof NEW_LAYOUT_BRANDS)[number]

export interface BsyKisiHedefRecord {
  yil:           number
  ay:            number
  bsyAdi:        string
  brand:         BrandKey
  hedefCiro:     number
  hakedilenPrim: number | null
}

export interface BsyKisiExtraRecord {
  yil:         number
  ay:          number
  bsyAdi:      string
  markaCarp:   number | null
  tahsiatCarp: number | null
}

// ─── Prim sonuç tipleri ────────────────────────────────────────
export interface BsyPrimResult {
  brands:       Record<BrandKey, number>  // marka bazlı hakedilen
  specialPrim:  number                    // özel durum primi
  toplam:       number
}

// ─── Sabitler ──────────────────────────────────────────────────
const ACHIEVEMENT_THRESHOLD = 0.80       // %80 baraj
const BSY_MIN_SHARE         = 0.07       // Şirket cirosu %7 barajı
const SPECIAL_CIRO_MIN      = 35_000_000 // Özel durum: 35M TL alt sınır

// Ciroları tabloya yansır ama prim hesabına dahil edilmez
export const PRIM_EXCLUDED_BSYS = ['Atilla YILMAZ', 'Erkan SADIKOĞLU']

// Özel durum basamakları: [minShare, primAmount]
const SPECIAL_TIERS: [number, number][] = [
  [0.40, 50_000],
  [0.30, 30_000],
]

// ─── Prim Hesaplama Motoru ─────────────────────────────────────
/**
 * Her BSY için hakedilen prim hesaplar.
 *
 * Normal durum (brand achievement ≥ %80):
 *   - O markaya ait Toplam Prim havuza düşer.
 *   - Havuz, şirket genel cirosunun ≥ %7'sini yapan BSY'lere
 *     kendi marka oranlarına göre dağıtılır.
 *
 * Özel durum (genel achievement < %80 ama toplam ciro > 35M TL):
 *   - BSY'nin genel cirodaki payına göre sabit prim:
 *       ≥ %40 → 50.000 TL
 *       ≥ %30 → 30.000 TL
 *       ≥ %20 → 20.000 TL
 */
export function calcBsyPrims(
  bsyRows:              BsyBrandRow[],
  brandTotals:          Record<BrandKey, number>,
  hedefler:             BsyHedefRecord[],
  genelToplamGercCiro:  number,
): Record<string, BsyPrimResult> {
  // Sonuç objesini sıfırla
  const result: Record<string, BsyPrimResult> = {}
  bsyRows.forEach(r => {
    result[r.bsyAdi] = {
      brands:      Object.fromEntries(BRAND_KEYS.map(b => [b, 0])) as Record<BrandKey, number>,
      specialPrim: 0,
      toplam:      0,
    }
  })

  // Toplam hedef ve genel gerçekleşme oranı
  const totalHedef = hedefler.reduce((s, h) => s + h.hedefCiro, 0)
  const genelRate  = totalHedef > 0 ? genelToplamGercCiro / totalHedef : 0

  // Prim hesabından hariç tutulan BSY'ler (ciro tabloda görünür, prim alamaz)
  const isExcluded = (bsyAdi: string) =>
    PRIM_EXCLUDED_BSYS.some(name =>
      bsyAdi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')
    )

  // ── Normal dağıtım: marka bazlı ─────────────────────────────
  BRAND_KEYS.forEach(brand => {
    const hedef = hedefler.find(h => h.brand === brand)
    if (!hedef || hedef.hedefCiro === 0) return

    const gercTotal  = brandTotals[brand]
    const brandRate  = gercTotal / hedef.hedefCiro
    if (brandRate < ACHIEVEMENT_THRESHOLD) return          // %80 barajı aşılmadı

    // Havuzdaki prim = gerçOranı × toplamPrim (%100'de sınırlanır)
    const pool = Math.min(brandRate, 1.0) * hedef.toplamPrim

    // Şirket cirosu %7 barajını aşan BSY'leri filtrele (hariç tutulanlar da hesaba katılır)
    const qualifiedBsys = bsyRows.filter(r =>
      genelToplamGercCiro > 0 &&
      r.toplamGercCiro / genelToplamGercCiro >= BSY_MIN_SHARE
    )

    // Dağıtımın tabanı: şirketin toplam marka cirosu (brandTotals)
    // Her BSY'nin payı = (kendi marka cirosu / şirket marka toplamı) × havuz
    const totalBrandCiro = brandTotals[brand]
    if (totalBrandCiro <= 0) return

    qualifiedBsys.forEach(r => {
      const share = r.brands[brand].gercCiro / totalBrandCiro
      result[r.bsyAdi].brands[brand] = Math.round(pool * share * 100) / 100
    })
  })

  // ── Özel durum ───────────────────────────────────────────────
  if (genelRate < ACHIEVEMENT_THRESHOLD && genelToplamGercCiro > SPECIAL_CIRO_MIN) {
    bsyRows.forEach(r => {
      const bsyShare = genelToplamGercCiro > 0
        ? r.toplamGercCiro / genelToplamGercCiro
        : 0
      const tier = SPECIAL_TIERS.find(([minShare]) => bsyShare >= minShare)
      result[r.bsyAdi].specialPrim = tier ? tier[1] : 0
    })
  }

  // Toplam
  bsyRows.forEach(r => {
    const entry = result[r.bsyAdi]
    entry.toplam =
      BRAND_KEYS.reduce((s, b) => s + entry.brands[b], 0) +
      entry.specialPrim
  })

  return result
}

// ─── Kademeli (tier) BSY prim hesabı — ay ≥ 5 parametrik motor ─────
// Not: BsyView içindeki hesapla birebir aynıdır; nihai prim tablosunda
// da kullanılabilmesi için buraya taşındı. Değiştirirken iki yer de
// aynı sonucu vermeli (tek kaynak).
export type BsyParams = Record<string, number>

export const DEFAULT_BSY_PARAMS: BsyParams = {
  elx_t1_thr: 80,  elx_t1_rate: 0.40,
  elx_t2_thr: 100, elx_t2_rate: 0.70,
  elx_t3_thr: 130, elx_t3_rate: 1.00,
  elx_t4_thr: 150, elx_t4_rate: 1.20,
  relux_t1_thr: 80,  relux_t1_rate: 0.60,
  relux_t2_thr: 100, relux_t2_rate: 0.85,
  relux_t3_thr: 130, relux_t3_rate: 1.15,
  relux_t4_thr: 150, relux_t4_rate: 1.40,
  carp1_thr: 50, carp1_val: 0.70,
  carp2_thr: 80, carp2_val: 0.50,
  carp3_thr: 100, carp3_val: 1.50,
}

export function calcTieredPrimBsy(
  gercElx: number, hedefElx: number,
  gercRelux: number, hedefRelux: number,
  compGerc: number, compHedef: number,
  tahsilatOran: number, params: BsyParams, excluded: boolean,
): { elxPrim: number; reluxPrim: number; topPrim: number } {
  if (excluded) return { elxPrim: 0, reluxPrim: 0, topPrim: 0 }
  const achElx   = hedefElx   > 0 ? (gercElx   / hedefElx)   * 100 : 0
  const achRelux = hedefRelux > 0 ? (gercRelux / hedefRelux) * 100 : 0

  function tierRate(achPct: number, prefix: string): number {
    const tiers: [number, number][] = [4,3,2,1].map(i => [
      params[`${prefix}_t${i}_thr`] ?? 0, params[`${prefix}_t${i}_rate`] ?? 0,
    ] as [number, number]).sort((a,b) => b[0]-a[0])
    for (const [thr, rate] of tiers) { if (thr>0 && achPct>=thr) return rate }
    return 0
  }
  const elxPrimBase   = gercElx   * tierRate(achElx,   'elx')   / 100
  const reluxPrimBase = gercRelux * tierRate(achRelux, 'relux') / 100

  let toplam = elxPrimBase + reluxPrimBase

  const c1thr = params['carp1_thr'] ?? 50
  const c1val = params['carp1_val'] ?? 0.70
  if ((hedefElx>0 && achElx<c1thr) || (hedefRelux>0 && achRelux<c1thr)) {
    toplam *= c1val
  }

  const compAch = compHedef>0 ? (compGerc/compHedef)*100 : 0
  const c2thr = params['carp2_thr'] ?? 80
  const c2val = params['carp2_val'] ?? 0.50
  if (compAch < c2thr) {
    toplam *= c2val
  }

  const c3thr = params['carp3_thr'] ?? 100
  const c3val = params['carp3_val'] ?? 1.50
  if (tahsilatOran >= c3thr) {
    toplam *= c3val
  }

  const topBase = elxPrimBase + reluxPrimBase
  const elxPrim   = topBase > 0 ? Math.round(toplam * elxPrimBase   / topBase) : 0
  const reluxPrim = topBase > 0 ? Math.round(toplam * reluxPrimBase / topBase) : 0
  const topPrim   = Math.round(toplam)

  return { elxPrim, reluxPrim, topPrim }
}
