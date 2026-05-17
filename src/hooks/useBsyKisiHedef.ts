'use client'

import { useState, useEffect, useCallback } from 'react'
import { BrandKey, BsyKisiHedefRecord, BsyKisiExtraRecord } from '@/lib/bsy'

export function useBsyKisiHedef(yil: number, ay: number) {
  const [hedefRows, setHedefRows] = useState<BsyKisiHedefRecord[]>([])
  const [extraRows, setExtraRows] = useState<BsyKisiExtraRecord[]>([])
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/bsy-kisi-hedef?yil=${yil}&ay=${ay}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'API hatası')
      setHedefRows(json.hedefRows ?? [])
      setExtraRows(json.extraRows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => { load() }, [load])

  const getKisiHedef = useCallback(
    (bsyAdi: string, brand: BrandKey): { hedefCiro: number; hakedilenPrim: number | null } => {
      const key = bsyAdi.toLocaleLowerCase('tr')
      const found = hedefRows.find(r =>
        r.bsyAdi.toLocaleLowerCase('tr') === key && r.brand === brand
      )
      return found ?? { hedefCiro: 0, hakedilenPrim: null }
    },
    [hedefRows]
  )

  const getKisiExtra = useCallback(
    (bsyAdi: string): { markaCarp: number | null; tahsiatCarp: number | null } => {
      const key = bsyAdi.toLocaleLowerCase('tr')
      const found = extraRows.find(r => r.bsyAdi.toLocaleLowerCase('tr') === key)
      return found ?? { markaCarp: null, tahsiatCarp: null }
    },
    [extraRows]
  )

  const save = useCallback(async (
    newHedefRows: { bsyAdi: string; brand: BrandKey; hedefCiro: number; hakedilenPrim?: number | null }[],
    newExtraRows: { bsyAdi: string; markaCarp?: number | null; tahsiatCarp?: number | null }[],
  ) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/bsy-kisi-hedef', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ yil, ay, hedefRows: newHedefRows, extraRows: newExtraRows }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Kaydetme hatası')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      throw e
    } finally {
      setSaving(false)
    }
  }, [yil, ay, load])

  return { hedefRows, extraRows, loading, saving, error, reload: load, getKisiHedef, getKisiExtra, save }
}
