// Çetinler Ajanda v2 — BSY adet primi (kategori bazlı).
//
// Kurallar (docs/notlar/kullanici-yapisi-ve-bsy-adet-primi.md §4):
//  - Kasım–Aralık 2026: ciro primi aynen devam eder; adet primi yalnızca SİMÜLE
//    edilir (ödemeye yansımaz). 2027 Ocak'tan itibaren canlı; ciro primi kalkar.
//  - Hedef kategori bazlı; gerçekleşme = BSY'nin carilerine bağlı tüm şubelerin
//    satış adedi (satır, oluştuğu andaki BSY'de kalır).
//  - Barem (tüm kategorilerde aynı, eşikler parametrik):
//      oran <  %50        → 0
//      %50 ≤ oran < %80   → (ana prim / 2) × oran
//      oran ≥ %80         → ana prim (üst sınır; %100 üstü de ana prim)
//  - Süpürge ve Mutfak & Diğer 2027'de yok → BSY yapısında yer almaz.

export interface BsyAdetKategori {
  grup: string      // lib/sellout GRUP_NORMALIZE çıktısıyla aynı ad
  etiket: string
  anaPrim: number
}

export const BSY_ADET_KATEGORILER: BsyAdetKategori[] = [
  { grup: 'IPL Grubu',               etiket: 'IPL',                  anaPrim: 28000 },
  { grup: 'Üflemeli Grubu',          etiket: 'Üflemeli',             anaPrim: 20000 },
  { grup: 'Düzleştirici&Maşa Grubu', etiket: 'Düzleştirici & Maşa',  anaPrim: 15000 },
  { grup: 'Erkek Bakım Grubu',       etiket: 'Erkek Bakım',          anaPrim: 10000 },
  { grup: 'Epilatör&Baskül&Mutfak',  etiket: 'Epilatör & Baskül',    anaPrim: 8500 },
]

export interface BsyAdetParams {
  altEsik: number   // bu oranın altı → 0
  tamEsik: number   // bu oran ve üstü → ana prim
}

export const BSY_ADET_PARAMS: BsyAdetParams = { altEsik: 0.5, tamEsik: 0.8 }

export const BSY_ADET_SIMULASYON_BASLANGIC = '2026-11'
export const BSY_ADET_CANLI_BASLANGIC = '2027-01'

export type BsyAdetDurum = 'yok' | 'simulasyon' | 'canli'

export function bsyAdetDurum(donem: string): BsyAdetDurum {
  if (donem >= BSY_ADET_CANLI_BASLANGIC) return 'canli'
  if (donem >= BSY_ADET_SIMULASYON_BASLANGIC) return 'simulasyon'
  return 'yok'
}

export function bsyKategoriPrim(hedef: number, gerc: number, anaPrim: number, p: BsyAdetParams = BSY_ADET_PARAMS): number {
  if (!(hedef > 0)) return 0
  const oran = gerc / hedef
  if (oran < p.altEsik) return 0
  if (oran < p.tamEsik) return Math.round((anaPrim / 2) * oran * 100) / 100
  return anaPrim
}

export interface BsyAdetSatir {
  grup: string
  etiket: string
  anaPrim: number
  hedef: number
  gerc: number
  oran: number | null
  prim: number
}

export function bsyAdetHesapla(
  hedefler: Record<string, number>,
  gercler: Record<string, number>,
  p: BsyAdetParams = BSY_ADET_PARAMS,
): { satirlar: BsyAdetSatir[]; toplamPrim: number; toplamAnaPrim: number } {
  const satirlar = BSY_ADET_KATEGORILER.map(k => {
    const hedef = hedefler[k.grup] ?? 0
    const gerc = gercler[k.grup] ?? 0
    return {
      grup: k.grup, etiket: k.etiket, anaPrim: k.anaPrim, hedef, gerc,
      oran: hedef > 0 ? gerc / hedef : null,
      prim: bsyKategoriPrim(hedef, gerc, k.anaPrim, p),
    }
  })
  return {
    satirlar,
    toplamPrim: satirlar.reduce((t, s) => t + s.prim, 0),
    toplamAnaPrim: BSY_ADET_KATEGORILER.reduce((t, k) => t + k.anaPrim, 0),
  }
}
