'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { GRUP_NORMALIZE } from '@/lib/sellout'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface HakedisRow {
  cari_adi:               string
  sube_adi:               string
  sup_adi:                string
  parent_sup_adi:         string   // Jr. Sup'ın üstündeki Sup adı (yoksa '')
  cetinler_merch:         string
  cetinler_merch_hakedis: number
  merch_adi:              string   // Destek Personeli
  hakedis:                number   // F kolonu
  dirty:                  boolean
  saving:                 boolean
}

interface Props {
  currentUserName: string
  currentUserRole: string
}

export function DestekPersonelHakedisView({ currentUserName, currentUserRole }: Props) {
  const now = new Date()
  const [yil, setYil]           = useState(now.getFullYear())
  const [ay, setAy]             = useState(Math.max(now.getMonth() + 1, 6))
  const [loading, setLoading]   = useState(true)
  const [rows, setRows]         = useState<HakedisRow[]>([])
  const [cariFilter, setCariFilter] = useState('')
  const [saveError, setSaveError]   = useState<string | null>(null)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const rowKey = (r: HakedisRow) =>
    `${r.cari_adi}||${r.sube_adi}||${r.cetinler_merch}||${r.merch_adi}`

  const loadData = useCallback(async () => {
    setLoading(true)
    setSaveError(null)
    try {
      const donem  = `${yil}-${String(ay).padStart(2, '0')}`
      const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
      // Admin: filtre yok (tüm şubeler), Sup: kendi şubeleri
      if (currentUserRole === 'sup') params.append('supAdi', currentUserName)

      const [destekRes, selloutRes, primRes, targetsRes, hakedisRes, flagRes] = await Promise.all([
        fetch(`/api/destek-personel-prim?${params}`),
        fetch('/api/sellout'),
        fetch(`/api/adet-prim?yil=${yil}&ay=${ay}`),
        fetch(`/api/sellout-targets?donem=${donem}`),
        fetch(`/api/destek-hakedis?yil=${yil}&ay=${ay}${currentUserRole === 'sup' ? `&supAdi=${encodeURIComponent(currentUserName)}` : ''}`),
        fetch(`/api/merch-destek-flag?donem=${donem}`),
      ])

      const [destekData, selloutData, primData, targetsData, hakedisData, flagData] = await Promise.all([
        destekRes.json(), selloutRes.json(), primRes.json(), targetsRes.json(), hakedisRes.json(), flagRes.json(),
      ])

      // destekFlagMap: merch_name.lower → destek_var (true/false)
      const destekFlagMap = new Map<string, boolean>()
      for (const f of (flagData.flags ?? [])) {
        destekFlagMap.set((f.merch_name as string).toLowerCase(), !!(f.destek_var))
      }

      // stokPrimMap: stokKodu → kosullu destek prim (₺/adet)
      const stokPrimMap = new Map<string, number>()
      for (const p of (primData.rows ?? [])) {
        if (p.stokKodu && p.kosulluDestek != null)
          stokPrimMap.set(p.stokKodu as string, p.kosulluDestek as number)
      }

      // katMap: cetinler_merch.lower → kategori → { satis_adedi, kosullu_prim_toplam }
      const katMap = new Map<string, Map<string, { satis_adedi: number; kosullu_prim_toplam: number }>>()
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
        e.satis_adedi         += adet
        e.kosullu_prim_toplam += adet * prim
      }

      // hedefMap: merch_name.lower → grup → hedef_adet
      const hedefMap = new Map<string, Map<string, number>>()
      for (const t of (targetsData.merch_targets ?? [])) {
        const k = (t.merch_name as string).toLowerCase()
        if (!hedefMap.has(k)) hedefMap.set(k, new Map())
        hedefMap.get(k)!.set(t.grup as string, (t.hedef as number) ?? 0)
      }

      // satisMap: cetinler_merch.lower → toplam_hak_edis
      // Bu view destek personeli şubelerine göre filtrelendiğinden flag kontrolü yapılmıyor.
      // >=100% → tam prim, <100% → oranlı prim, hedef=0 → tam prim (hedefsiz ay)
      const satisMap = new Map<string, number>()
      for (const [mk, km] of katMap) {
        let toplam = 0
        for (const [kat, { satis_adedi, kosullu_prim_toplam }] of km) {
          const hedef = hedefMap.get(mk)?.get(kat) ?? 0
          // Sellout view ile aynı mantık: hedef=0 ise gerceklesme=0 (Sellout: data.hedef>0 ? ... : 0)
          const gerceklesme = hedef > 0 ? (satis_adedi / hedef) * 100 : 0
          toplam += gerceklesme >= 100 ? kosullu_prim_toplam : (gerceklesme / 100) * kosullu_prim_toplam
        }
        satisMap.set(mk, toplam)
      }

      // Kaydedilen hakedis değerleri — 2 harita:
      // 1. fullMap: tam key (cari||sube||cetinler||merch) — lowercase eşleşme
      // 2. merchMap: sadece merch_adi — fallback (cari/sube adı değişmişse yedek)
      const nk = (s: string) => (s || '').trim().toLowerCase()
      const fullMap  = new Map<string, number>()
      const merchMap = new Map<string, number>()
      for (const h of (hakedisData.rows ?? [])) {
        const fk = `${nk(h.cari_adi)}||${nk(h.sube_adi)}||${nk(h.cetinler_merch)}||${nk(h.merch_adi)}`
        fullMap.set(fk, h.hakedis ?? 0)
        const mk2 = nk(h.merch_adi)
        if (!merchMap.has(mk2)) merchMap.set(mk2, h.hakedis ?? 0)
      }

      // Satırları oluştur
      // Dedup key: cari_adi + sube_adi + cetinler_merch + merch_adi (kullanıcı isteği)
      const seen = new Set<string>()
      const built: HakedisRow[] = []
      const destekRows: Array<{ merch_adi: string; sube_adi: string; cari_adi: string; cetinler_merch: string; sup_adi: string; parent_sup_adi: string }> =
        destekData.rows ?? []

      for (const dp of destekRows) {
        const mk = (dp.cetinler_merch || '').toLowerCase()

        // Merch Hedefleri'nde "Destek Personeli var mı?" = true olmayanları filtrele
        if (destekFlagMap.size > 0 && !destekFlagMap.get(mk)) continue

        // Cari + Şube + Çetinler Merch + Destek Personeli aynıysa tek satır
        const dedup = `${nk(dp.cari_adi)}||${nk(dp.sube_adi)}||${mk}||${nk(dp.merch_adi)}`
        if (seen.has(dedup)) continue
        seen.add(dedup)

        const fk  = dedup
        // Önce tam eşleşme, yoksa sadece merch_adi ile fallback
        const savedHakedis = fullMap.get(fk) ?? merchMap.get(nk(dp.merch_adi)) ?? 0
        built.push({
          cari_adi:               dp.cari_adi,
          sube_adi:               dp.sube_adi,
          sup_adi:                dp.sup_adi || (currentUserRole === 'sup' ? currentUserName : ''),
          parent_sup_adi:         dp.parent_sup_adi || '',
          cetinler_merch:         dp.cetinler_merch,
          cetinler_merch_hakedis: satisMap.get(mk) ?? 0,
          merch_adi:              dp.merch_adi,
          hakedis:                savedHakedis,
          dirty:                  false,
          saving:                 false,
        })
      }

      built.sort((a, b) =>
        a.cari_adi.localeCompare(b.cari_adi, 'tr') ||
        a.sube_adi.localeCompare(b.sube_adi, 'tr') ||
        a.cetinler_merch.localeCompare(b.cetinler_merch, 'tr') ||
        a.merch_adi.localeCompare(b.merch_adi, 'tr')
      )

      setRows(built)
    } catch (e) {
      console.error('Destek hakediş yükleme hatası:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [yil, ay, currentUserName, currentUserRole])

  useEffect(() => { loadData() }, [loadData])

  const handleHakedisChange = (idx: number, val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], hakedis: num, dirty: true }
      return next
    })
    const r   = rows[idx]
    const key = rowKey(r)
    const existing = saveTimers.current.get(key)
    if (existing) clearTimeout(existing)
    const idxSnap = idx
    const timer = setTimeout(() => saveRow(idxSnap, num), 1200)
    saveTimers.current.set(key, timer)
  }

  const saveRow = async (idx: number, hakedis: number) => {
    setRows(prev => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx], saving: true }
      return next
    })
    const r = rows[idx]
    if (!r) return
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
          sup_adi:        r.sup_adi || currentUserName,
        }),
      })
      if (!res.ok) setSaveError('Kayıt hatası oluştu')
      else {
        setRows(prev => {
          const next = [...prev]
          if (next[idx]) next[idx] = { ...next[idx], dirty: false, saving: false, hakedis }
          return next
        })
      }
    } catch {
      setSaveError('Kayıt hatası oluştu')
    } finally {
      setRows(prev => {
        const next = [...prev]
        if (next[idx]) next[idx] = { ...next[idx], saving: false }
        return next
      })
    }
  }

  // Cari/Şube filtresi seçenekleri
  const cariOptions = [...new Set(
    rows.map(r => r.sube_adi ? `${r.cari_adi} - ${r.sube_adi}` : r.cari_adi)
  )].sort((a, b) => a.localeCompare(b, 'tr'))

  const visibleRows = cariFilter
    ? rows.filter(r => {
        const label = r.sube_adi ? `${r.cari_adi} - ${r.sube_adi}` : r.cari_adi
        return label === cariFilter
      })
    : rows

  const toplamHakedis = visibleRows.reduce((s, r) => s + (r.hakedis || 0), 0)

  // Her Çetinler Merch adı yalnızca 1 kez toplanır (aynı kişi birden fazla şubede olsa bile)
  const toplamCetinlerMerchPrim = (() => {
    const seen = new Set<string>()
    let sum = 0
    for (const r of visibleRows) {
      const key = r.cetinler_merch.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      sum += r.cetinler_merch_hakedis || 0
    }
    return sum
  })()
  const fmt = (n: number) =>
    n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Ay >= 6 kısıtı
  if (ay < 6) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Bu tablo Haziran (6. ay) ve sonrasında kullanılabilir.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-700">Destek Personelleri Hakediş</span>

        {/* Yıl */}
        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay — yalnızca 6-12 */}
        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {MONTHS_TR.slice(5).map((m, i) => (
              <option key={i + 6} value={i + 6}>{m}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Cari / Şube filtresi */}
        {!loading && cariOptions.length > 0 && (
          <div className="relative">
            <select value={cariFilter} onChange={e => setCariFilter(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none max-w-[220px]">
              <option value="">Tüm Cariler</option>
              {cariOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        <button onClick={loadData}
          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>

        {saveError && (
          <span className="text-xs text-red-500">{saveError}</span>
        )}
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            Bu dönem için destek personeli verisi bulunamadı.
          </div>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Cari ve Şube</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Süpervizör</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Çetinler Merch</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Destek Personeli için Oluşan Prim</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Destek Personeli</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Destek Personeli Hakedişi</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => (
                <tr key={idx} className={clsx(
                  'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  row.dirty ? 'bg-yellow-50' : ''
                )}>
                  <td className="px-3 py-1.5 text-gray-700 font-medium whitespace-nowrap">
                    {row.cari_adi}
                    {row.sube_adi && row.sube_adi !== row.cari_adi && (
                      <span className="text-gray-400 ml-1">/ {row.sube_adi}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {row.sup_adi ? (
                      <div>
                        <span className="text-gray-700">{row.sup_adi}</span>
                        {row.parent_sup_adi && (
                          <div className="text-[10px] text-brand-500 font-medium">{row.parent_sup_adi}</div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{row.cetinler_merch}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-700 whitespace-nowrap">
                    {row.cetinler_merch_hakedis > 0 ? `${fmt(row.cetinler_merch_hakedis)} ₺` : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{row.merch_adi}</td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.hakedis || ''}
                        placeholder="0.00"
                        onChange={e => handleHakedisChange(
                          rows.indexOf(visibleRows[idx]),
                          e.target.value
                        )}
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
                <td colSpan={3} className="px-3 py-2 text-right text-gray-600 text-xs">Toplam</td>
                <td className="px-3 py-2 text-right font-mono text-gray-800 whitespace-nowrap">
                  {toplamCetinlerMerchPrim > 0 ? `${fmt(toplamCetinlerMerchPrim)} ₺` : '-'}
                </td>
                <td className="px-3 py-2" />
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
