'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { BRAND_KEYS, BrandKey, BsyCiroRow } from '@/lib/bsy'

export { BRAND_KEYS }
export type { BrandKey }

// BSY bazında marka kırılımlı aggregated satır
export interface BsyBrandRow {
  bsyAdi: string
  brands: Record<BrandKey, { gercCiro: number }>
  toplamGercCiro: number
}

export function useBsyCiro(yil: number, ay: number) {
  const [rows, setRows]       = useState<BsyCiroRow[]>([])
  const [yillar, setYillar]   = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [source, setSource]   = useState<'excel' | 'empty' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/bsy-ciro?yil=${yil}&ay=${ay}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'API hatası')
      setRows(json.rows ?? [])
      setYillar(json.yillar ?? [])
      setSource(json.source)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => { load() }, [load])

  // BSY × marka aggregation
  const bsyRows = useMemo<BsyBrandRow[]>(() => {
    const map = new Map<string, BsyBrandRow>()
    rows.forEach(r => {
      if (!map.has(r.bsyAdi)) {
        map.set(r.bsyAdi, {
          bsyAdi: r.bsyAdi,
          brands: Object.fromEntries(
            BRAND_KEYS.map(b => [b, { gercCiro: 0 }])
          ) as Record<BrandKey, { gercCiro: number }>,
          toplamGercCiro: 0,
        })
      }
      const entry = map.get(r.bsyAdi)!
      entry.brands[r.brand].gercCiro += r.gercCiro
      entry.toplamGercCiro           += r.gercCiro
    })
    return [...map.values()].sort((a, b) => a.bsyAdi.localeCompare(b.bsyAdi, 'tr'))
  }, [rows])

  // Marka bazı toplamlar
  const brandTotals = useMemo<Record<BrandKey, number>>(() => {
    const totals = Object.fromEntries(BRAND_KEYS.map(b => [b, 0])) as Record<BrandKey, number>
    bsyRows.forEach(r => BRAND_KEYS.forEach(b => { totals[b] += r.brands[b].gercCiro }))
    return totals
  }, [bsyRows])

  const genelToplamGercCiro = useMemo(
    () => bsyRows.reduce((s, r) => s + r.toplamGercCiro, 0),
    [bsyRows]
  )

  return { rows, bsyRows, brandTotals, genelToplamGercCiro, yillar, loading, error, source, reload: load }
}
