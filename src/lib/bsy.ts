// BSY Hedef Takip — paylaşılan tipler ve sabitler

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
