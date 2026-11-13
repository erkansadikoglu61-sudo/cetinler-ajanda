import type { V2GorunurNokta } from '@/lib/v2/nokta'

export interface V2Veri {
  kullanici: {
    id: string
    ad: string
    rol: string
    ust: string | null
    altlar: { id: string; ad: string; rol: string }[]
    iban: string
    merchId: string
  }
  noktalar: V2GorunurNokta[]
  ozet: { nokta: number; cari: number; kendi: number; ekip: number }
  kontrol?: {
    toplamNokta: number
    bsySiz: number
    supSiz: number
    subeKodsuz: number
    eslesmeyenDestek: { ad: string; cariAdi: string; subeAdi: string }[]
  }
  guncelleme: string
}

export const V2_ROL_ADI: Record<string, string> = {
  admin:   'Yönetici',
  bsy:     'Bölge Satış Yöneticisi',
  sup:     'Süpervizör',
  jr:      'Jr. Süpervizör',
  merch:   'Çetinler Merch',
  manager: 'Yönetim',
  ik:      'İnsan Kaynakları',
}

export function ibanBicimle(iban: string): string {
  const s = iban.replace(/\s/g, '').toUpperCase()
  return s.replace(/(.{4})/g, '$1 ').trim()
}

export interface V2HesabimAy {
  donem: string
  yil: number
  ay: number
  prim: number
  ekPrim: number
  toplam: number
  durum: 'devam' | 'odendi' | 'bekliyor'
  odemeTarihi: string | null
  adetSimulasyon: number | null
}

export interface V2Hesabim {
  tip: string | null
  aylar: V2HesabimAy[]
}

export function tl(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
}
