'use client'

import { useState, useEffect, useCallback } from 'react'
import { BrandKey, BRAND_KEYS, BsyHedefRecord } from '@/lib/bsy'

export function useBsyHedef(yil: number, ay: number) {
  const [hedefler, setHedefler] = useState<BsyHedefRecord[]>([])
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/bsy-hedef?yil=${yil}&ay=${ay}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'API hatası')
      setHedefler(json.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => { load() }, [load])

  // Eksik markaları sıfırla → her zaman 3 kayıt döner
  const hedefMap = BRAND_KEYS.reduce((acc, brand) => {
    const found = hedefler.find(h => h.brand === brand)
    acc[brand] = found ?? { yil, ay, brand, hedefCiro: 0, toplamPrim: 0 }
    return acc
  }, {} as Record<BrandKey, BsyHedefRecord>)

  const save = useCallback(async (
    records: { brand: BrandKey; hedefCiro: number; toplamPrim: number }[],
  ) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/bsy-hedef', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ yil, ay, records }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Kaydetme hatası')
      await load()   // yenile
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      throw e
    } finally {
      setSaving(false)
    }
  }, [yil, ay, load])

  return { hedefler, hedefMap, loading, saving, error, reload: load, save }
}
