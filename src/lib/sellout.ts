// ─── Grup ismi normalizasyonu: API değeri → ekranda gösterilen isim ───
export const GRUP_NORMALIZE: Record<string, string> = {
  'IPL Grubu':               'IPL Grubu',
  'Üflemeli Grubu':          'Üflemeli Grubu',
  'Düzlestirici-Masa Grubu': 'Düzleştirici&Maşa Grubu',
  'Epilatör-Baskül-Mutfak':  'Epilatör&Baskül&Mutfak',
  'Erkek Bakim Grubu':       'Erkek Bakım Grubu',
  'Süpürge Grubu':           'Süpürge Grubu',
  'Mutfak ve Diger Gruplar': 'Mutfak ve Diğer Gruplar',
}

export const SELLOUT_GROUPS = [
  'IPL Grubu',
  'Üflemeli Grubu',
  'Düzleştirici&Maşa Grubu',
  'Epilatör&Baskül&Mutfak',
  'Erkek Bakım Grubu',
  'Süpürge Grubu',
  'Mutfak ve Diğer Gruplar',
] as const

export type SelloutGroup = (typeof SELLOUT_GROUPS)[number]

// Süpervizör seviyesi Kategori Primi (₺)
export const PRIM_SUP: Record<SelloutGroup, number> = {
  'IPL Grubu':               7500,
  'Üflemeli Grubu':          6500,
  'Düzleştirici&Maşa Grubu': 4000,
  'Epilatör&Baskül&Mutfak':  2500,
  'Erkek Bakım Grubu':       1500,
  'Süpürge Grubu':           7000,
  'Mutfak ve Diğer Gruplar': 3000,
}

// Jr. Süpervizör seviyesi Kategori Primi (₺)
export const PRIM_JR: Record<SelloutGroup, number> = {
  'IPL Grubu':               6500,
  'Üflemeli Grubu':          4500,
  'Düzleştirici&Maşa Grubu': 3000,
  'Epilatör&Baskül&Mutfak':  1750,
  'Erkek Bakım Grubu':       1250,
  'Süpürge Grubu':           5500,
  'Mutfak ve Diğer Gruplar': 2000,
}

// Çetinler Merch seviyesi Kategori Primi (₺)
// Not: Gerçek değerleri öğrenince güncelleyin
export const PRIM_MERCH: Record<SelloutGroup, number> = {
  'IPL Grubu':               3750,
  'Üflemeli Grubu':          3250,
  'Düzleştirici&Maşa Grubu': 2000,
  'Epilatör&Baskül&Mutfak':  1250,
  'Erkek Bakım Grubu':       1250,
  'Süpürge Grubu':           3750,
  'Mutfak ve Diğer Gruplar': 1250,
}

export const PRIM_ESIGI = 0.80 // %80 eşik

// Çetinler Merch whitelist (Grubu = "Çetinler Merch" olanlar)
export const CETINLER_MERCH = new Set([
  // Songül Durukan → Tuğba Ayata
  'Ecem Buse Toprak', 'Azize Çizmeci', 'Sonay Polat', 'Gonca Kaya',
  'Sema Karadeniz', 'Cahide Salman', 'Cansu Akkaya', 'Serpil Aydın', 'Nurcan Çeliksu',
  // Songül Durukan → Tuğba Ayata (Pursaklar)
  'Burcu Evren',
  // Songül Durukan → direkt
  'Abide Küççük', 'Damla Doğan', 'Esra Gül', 'Nursena Öğücü', 'Irmak Morboncuk',
  'Gizem Kazak', 'Gül Dilara Gündüz', 'Semanur ateşoğlu', 'Fadime Baran',
  // Atilla Yılmaz
  'Aleyna Bartan', 'Aslı Gökmen', 'Betül Keser', 'Beyhan Bülbül Özlü', 'Dilan Yıkılmaz',
  'Emine Sen', 'Hafize Gökçe', 'Hanife Yüksel', 'Neslihan Bulut', 'Özen Özdil',
  'Şerife Karaahmetoğlu',
  // Burak Alagöz
  'Çiler Dikmenoğulları', 'Duygu Özen', 'Hülya Dönmez', 'Hatice Avcı',
  'Kiraz Mernekli', 'Yasemin Bozalan', 'Damla Pehlivan',
  // Sinem Bektaş → Merve İnci
  'Elmas Susuz', 'Tuba Çap', 'Fahriye Öz',
  // Sinem Bektaş → direkt
  'Gözde Nur Kuşoğlu', 'Mehtap Sönmez', 'Betül Yüce',
  // Pınar Güler
  'Nihal Aydın',
  // Sinem Bektaş → HEDEFİM AVM GÖLCÜK
  'Merve Çetin',
  // Sinem Bektaş → YÖN - Kadriye Erman
  'Kadriye Erman',
])

/** İsim normalizasyonu: küçük harf, "SV" kaldır, Türkçe → Latin */
export function normalizeName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\bsv\b/gi, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's')
    .replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/\s+/g, ' ')
    .trim()
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b)
}

/**
 * Prim = Kategori_Primi × min(Gerç/Hedef, 1.0)  — sadece Gerç/Hedef ≥ %80 ise
 */
export function calcPrim(hedef: number, gerc: number, kategoriPrimi: number): number {
  if (hedef === 0) return 0
  const ratio = gerc / hedef
  if (ratio < PRIM_ESIGI) return 0
  return Math.round(kategoriPrimi * Math.min(ratio, 1.0) * 100) / 100
}

export function fmtCur(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** YYYY-MM formatında mevcut dönem */
export function currentDonem(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Son 6 ay + bu ay */
export function donemOptions(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

const MONTHS_SHORT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
export function donemLabel(donem: string): string {
  const [y, m] = donem.split('-')
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`
}
