'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, ChevronDown, Save } from 'lucide-react'
import clsx from 'clsx'
import { GRUP_NORMALIZE } from '@/lib/sellout'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface HakedisRow {
  cari_adi: string
  sube_adi: string
  sup_adi: string
  cetinler_merch: string
  cetinler_merch_hakedis: number
  merch_adi: string          // Destek Personeli
  hakedis: number            // F kolonu — supervisor girer
  dirty: boolean
  saving: boolean
}

interface Props {
  currentUserName: string
}

export function DestekPersonelHakedisView({ currentUserName }: Props) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay, setAy]   = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows]       = useState<HakedisRow[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const rowKey = (r: HakedisRow) =>
    `${r.cari_adi}||${r.sube_adi}||${r.cetinler_merch}||${r.merch_adi}`

  const loadData = useCallback(async () => {
    setLoading(true)
    setSaveError(null)
    try {
      const donem  = `${yil}-${String(ay).padStart(2, '0')}`
      const params = new URLSearchParams({ yil: String(yil), ay: String(ay), supAdi: currentUserName })

      const [destekRes, selloutRes, primRes, targetsRes, hakedisRes] = await Promise.all([
        fetch(`/api/destek-personel-prim?${params}`),
        fetch('/api/sellout'),
        fetch(`/api/adet-prim?yil=${yil}&ay=${ay}`),
        fetch(`/api/sellout-targets?donem=${donem}`),
        fetch(`/api/destek-hakedis?yil=${yil}&ay=${ay}&supAdi=${encodeURIComponent(currentUserName)}`),
      ])

      const [destekData, selloutData, primData, targetsData, hakedisData] = await Promise.all([
        destekRes.json(), selloutRes.json(), primRes.json(), targetsRes.json(), hakedisRes.json(),
      ])

      // 1. stokPrimMap: stokKodu → koşullu destek prim (₺/adet)
      const stokPrimMap = new Map<string, number>()
      for (const p of (primData.rows ?? [])) {
        if (p.stokKodu && p.kosulluDestek != null) {
          stokPrimMap.set(p.stokKodu as string, p.kosulluDestek as number)
        }
      }

      // 2. satisMap: cetinler_merch.lower → { toplam_hak_edis }
      const satisMap = new Map<string, { hak_edis: number }>()
      const katMap   = new Map<string, Map<string, { satis_adedi: number; kosullu_prim_toplam: number }>>()

      for (const r of (selloutData.rows ?? [])) {
        if ((r.donem as string) !== donem) continue
        if ((r.merch_tipi as string) !== 'Çetinler Merch') continue
        const mk   = (r.merch_personel as string).toLowerCase()
        const kat  = GRUP_NORMALIZE[r.grup_aciklama as string] ?? (r.grup_aciklama as string)
        const adet = (r.satilan_adet as number) || 0
        const prim = stokPrimMap.get(r.stok_kodu as string) ?? 0
        if (!katMap.has(mk)) katMap.set(mk, new Map())
        const km = katMap.get(mk)!
        if (!km.has(kat)) km.set(kat, { satis_adedi: 0, kosullu_prim_toplam: 0 })
        const e = km.get(kat)!
        e.satis_adedi          += adet
        e.kosullu_prim_toplam  += adet * prim
      }

      // 3. hedefMap: merch_name.lower → grup → hedef_adet
      const hedefMap = new Map<string, Map<string, number>>()
      for (const t of (targetsData.merch_targets ?? [])) {
        const k = (t.merch_name as string).toLowerCase()
        if (!hedefMap.has(k)) hedefMap.set(k, new Map())
        hedefMap.get(k)!.set(t.grup as string, (t.hedef as number) ?? 0)
      }

      // 4. Her cetinler_merch için toplam hak_edis hesapla
      for (const [mk, km] of katMap) {
        let toplam = 0
        for (const [kat, { satis_adedi, kosullu_prim_toplam }] of km) {
          const hedef = hedefMap.get(mk)?.get(kat) ?? 0
          const gerceklesme = hedef > 0 ? (satis_adedi / hedef) * 100 : 0
          toplam += kosullu_prim_toplam * (gerceklesme / 100)
        }
        satisMap.set(mk, { hak_edis: toplam })
      }

      // 5. Kaydedilen hakedis değerlerini map'e al
      const savedMap = new Map<string, number>()
      for (const h of (hakedisData.rows ?? [])) {
        const k = `${h.cari_adi}||${h.sube_adi}||${h.cetinler_merch}||${h.merch_adi}`
        savedMap.set(k, h.hakedis ?? 0)
      }

      // 6. Satır oluştur
      const destekRows: Array<{
        merch_adi: string; sube_adi: string; cari_adi: string; cetinler_merch: string
      }> = destekData.rows ?? []

      // sup_adi bilgisi için destek-personel-prim endpoint'i sup_adi dönmez,
      // bu nedenle currentUserName'i kullanıyoruz (süpervizör kendi görünümünü açıyor)
      const built: HakedisRow[] = destekRows.map(dp => {
        const mk  = dp.cetinler_merch.toLowerCase()
        const key = `${dp.cari_adi}||${dp.sube_adi}||${dp.cetinler_merch}||${dp.merch_adi}`
        return {
          cari_adi:               dp.cari_adi,
          sube_adi:               dp.sube_adi,
          sup_adi:                currentUserName,
          cetinler_merch:         dp.cetinler_merch,
          cetinler_merch_hakedis: satisMap.get(mk)?.hak_edis ?? 0,
          merch_adi:              dp.merch_adi,
          hakedis:                savedMap.get(key) ?? 0,
          dirty:                  false,
          saving:                 false,
        }
      })

      // cari_adi → cetinler_merch → merch_adi sıralaması
      built.sort((a, b) =>
        a.cari_adi.localeCompare(b.cari_adi, 'tr') ||
        a.cetinler_merch.localeCompare(b.cetinler_merch, 'tr') ||
        a.merch_adi.localeCompare(b.merch_adi, 'tr')
      )

      setRows(built)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [yil, ay, currentUserName])

  useEffect(() => { loadData() }, [loadData])

  const handleHakedisChange = (idx: number, val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], hakedis: num, dirty: true }
      return next
    })

    // Debounce kayıt
    const r   = rows[idx]
    const key = rowKey(r)
    const existing = saveTimers.current.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => saveRow(idx, num), 1200)
    saveTimers.current.set(key, timer)
  }

  const saveRow = async (idx: number, hakedis: number) => {
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], saving: true }
      return next
    })
    const r = rows[idx]
    try {
      const res = await fetch('/api/destek-hakedis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yil,
          ay,
          cari_adi:       r.cari_adi,
          sube_adi:       r.sube_adi,
          cetinler_merch: r.cetinler_merch,
          merch_adi:      r.merch_adi,
          hakedis,
          sup_adi:        currentUserName,
        }),
      })
      if (!res.ok) setSaveError('Kayıt hatası')
      else {
        setRows(prev => {
          const next = [...prev]
          next[idx] = { ...next[idx], dirty: false, saving: false, hakedis }
          return next
        })
      }
    } catch {
      setSaveError('Kayıt hatası')
    } finally {
      setRows(prev => {
        const next = [...prev]
        if (next[idx]) next[idx] = { ...next[idx], saving: false }
        return next
      })
    }
  }

  const toplamHakedis = rows.reduce((s, r) => s + (r.hakedis || 0), 0)
  const fmt = (n: number) =>
    n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-700">Destek Personelleri Hakediş</span>

        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {MONTHS_TR.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={loadData}
          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>

        {saveError && (
          <span className="text-xs text-red-500 ml-2">{saveError}</span>
        )}

        <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          <Save size={11} /> F kolonu otomatik kaydedilir
        </span>
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            Bu dönem için destek personeli verisi bulunamadı.
          </div>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b border-gray-200">
                {['Cari', 'Süpervizör', 'Çetinler Merch', 'Çetinler Merch Prim Hakedişi', 'Destek Personeli', 'Destek Personeli Hakedişi'].map((h, i) => (
                  <th key={i} className={clsx(
                    'px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap',
                    i === 3 || i === 5 ? 'text-right' : ''
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={clsx(
                  'border-b border-gray-100 hover:bg-gray-50',
                  row.dirty ? 'bg-yellow-50' : ''
                )}>
                  <td className="px-3 py-1.5 text-gray-700 font-medium whitespace-nowrap">
                    {row.cari_adi}
                    {row.sube_adi && row.sube_adi !== row.cari_adi && (
                      <span className="text-gray-400 ml-1">/ {row.sube_adi}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{row.sup_adi}</td>
                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{row.cetinler_merch}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-700 whitespace-nowrap">
                    {fmt(row.cetinler_merch_hakedis)} ₺
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{row.merch_adi}</td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={row.hakedis || ''}
                        placeholder="0.00"
                        onChange={e => handleHakedisChange(idx, e.target.value)}
                        className={clsx(
                          'w-28 text-right px-2 py-0.5 rounded border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400',
                          row.dirty ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'
                        )}
                      />
                      {row.saving && (
                        <div className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                      {!row.dirty && !row.saving && row.hakedis > 0 && (
                        <span className="text-green-500 text-[10px]">✓</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <td colSpan={5} className="px-3 py-2 text-right text-gray-600 text-xs">Toplam</td>
                <td className="px-3 py-2 text-right font-mono text-gray-800 whitespace-nowrap">
                  {fmt(toplamHakedis)} ₺
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
