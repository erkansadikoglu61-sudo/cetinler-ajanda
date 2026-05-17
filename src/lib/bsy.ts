// BSY Hedef Takip — paylaşılan tipler, sabitler ve prim motoru

/** Sellout verisi (ve field_personnel) içindeki BSY kodu → profil tam adı */
export const BSY_KOD_TO_NAME: Record<string, string> = {
  KB1: 'Erdem Bozyel',
  IB1: 'Burak Kılıç',
  IB2: 'Okan Oğuz',
  MB5: 'Kemal Tunalı',
  EB1: 'Orçun Soyubitmez',
  MB1: 'Mehmet Katırcı',
  MB2: 'Mustafa Çetinkaya',
  MB4: 'Mutlu Topay',
  MB9: 'Atilla Yılmaz',
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
export const PRIM_EXCLUDED_BSYS = ['Atilla Yılmaz', 'Erkan Sadıkoğlu']

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
