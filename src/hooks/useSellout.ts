'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SelloutRow {
  merch_personel: string
  cari_isim:      string
  sube_adi:       string
  stok_adi:       string
  stok_kodu:      string
  grup_aciklama:  string
  satilan_adet:   number
  grup_kodu:      string
  beklened_ciro:  number
  supervisor_adi: string
  cari_kod:       string
  sube_kod:       string
  donem:          string
  tarih:          string
  merch_tipi:     string   // 'Çetinler Merch' | diğer
}

const REFRESH_MS = 30 * 60 * 1000 // 30 dakika

/**
 * Sellout verisini çeker ve 30 dakikada bir otomatik yeniler.
 * @param enabled  Sadece ilgili sekme açıkken true yapın.
 */
export function useSellout(enabled = false) {
  const [rows, setRows]           = useState<SelloutRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/sellout')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'API hatası')
      setRows(json.rows ?? [])
      setFetchedAt(new Date(json.fetched_at ?? Date.now()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [enabled, load])

  return { rows, loading, error, fetchedAt, reload: load }
}
