'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { RefreshCw, ChevronDown, X, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { useSellout } from '@/hooks/useSellout'
import { BSY_NAME_TO_KOD, BSY_KOD_TO_NAME } from '@/lib/bsy'
import { Profile } from '@/lib/supabase'

// ─── Tipler ─────────────────────────────────────────────────────
interface SellinRow {
  bsyKod: string; bsyAdi: string; cariKod: string; cariIsim: string
  stokKodu: string; stokAdi: string; kategori: string
  ay: number; yil: number; adet: number
}

interface TableRow {
  stokKodu: string
  sellin:   number
  sellout:  number
  oran:     number | null
}

interface Props {
  currentProfile: Profile
  active: boolean
}

// ─── Çok seçimli Dropdown ────────────────────────────────────────
function MultiSelect({
  label, options, selected, onChange,
}: {
  label:    string
  options:  string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 text-xs rounded-xl border font-medium transition-colors whitespace-nowrap',
          selected.length
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
        )}
      >
        {selected.length ? `${label} (${selected.length})` : label}
        <ChevronDown size={11} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[180px] max-h-64 overflow-y-auto">
          <div className="p-1">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors',
                  selected.includes(opt)
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <div className={clsx(
                  'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center',
                  selected.includes(opt)
                    ? 'bg-brand-500 border-brand-500'
                    : 'border-gray-300'
                )}>
                  {selected.includes(opt) && (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="currentColor">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                {opt}
              </button>
            ))}
            {options.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2">Seçenek yok</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tek seçimli Dropdown ────────────────────────────────────────
function SingleSelect({
  label, options, value, onChange,
}: {
  label:    string
  options:  { value: string; label: string }[]
  value:    string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          'appearance-none pl-2.5 pr-6 py-1.5 text-xs rounded-xl border font-medium focus:outline-none transition-colors',
          value
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'border-gray-200 bg-white text-gray-500'
        )}
      >
        <option value="">{label}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Format yardımcıları ─────────────────────────────────────────
const fmtNum = (n: number) =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
const fmtPct = (n: number) =>
  isFinite(n) ? `%${n.toFixed(1)}` : '—'

// ─── Ana Bileşen ─────────────────────────────────────────────────
export function SellinSelloutView({ currentProfile, active }: Props) {
  const isAdmin = currentProfile.role === 'admin'
  const isBsy   = currentProfile.role === 'bsy'

  // Sellin verileri (SAHA.xlsx)
  const [sellinRows,   setSellinRows]   = useState<SellinRow[]>([])
  const [yillar,       setYillar]       = useState<number[]>([])
  const [merchxKodlar, setMerchxKodlar] = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(false)

  const loadSellin = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/sellin-sellout')
      const json = await res.json()
      setSellinRows(json.rows         ?? [])
      setYillar(json.yillar           ?? [])
      setMerchxKodlar(new Set<string>((json.merchxKodlar ?? []) as string[]))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (active) loadSellin() }, [active, loadSellin])

  // Sellout verileri (dış URL)
  const { rows: selloutRows, loading: soLoading, reload: reloadSellout } = useSellout(active)

  // ── Filtre state'leri ────────────────────────────────────────
  const [filterBsy,      setFilterBsy]      = useState('')
  const [filterCari,     setFilterCari]     = useState('')
  const [filterMarka,    setFilterMarka]    = useState<string[]>([])   // ELECTROLUX / RELUX
  const [filterKategori, setFilterKategori] = useState<string[]>([])   // sellout grup_aciklama
  const [filterStok,     setFilterStok]     = useState<string[]>([])
  const [filterAy,       setFilterAy]       = useState<string[]>([])
  const [filterYil,      setFilterYil]      = useState<string>('')

  // BSY kısıtı: BSY kullanıcısı sadece kendi verisini görür
  const bsyKod = isBsy
    ? (BSY_NAME_TO_KOD[currentProfile.full_name.toLocaleLowerCase('tr')] ?? '')
    : ''

  // Sellin grup_kodu → görüntülenen marka adı
  // EKEA → ELECTROLUX, RELUX → RELUX, diğerleri → atla
  const MARKA_MAP: Record<string, string> = {
    EKEA: 'ELECTROLUX', RELUX: 'RELUX',
  }
  const MARKA_OPTIONS = ['ELECTROLUX', 'RELUX']

  // ── BSY için base-filtrelenmiş kaynak (filtre seçenekleri buradan üretilir) ──
  // Sellin ve Sellout: BSY kodu üzerinden eşleştir (isim yazım farklarından bağımsız)
  const baseSellin = useMemo(() => {
    if (!isBsy || !bsyKod) return sellinRows
    return sellinRows.filter(r => r.bsyKod === bsyKod)
  }, [sellinRows, isBsy, bsyKod])

  const baseSellout = useMemo(() => {
    if (!isBsy || !bsyKod) return selloutRows
    return selloutRows.filter(r => r.bsy === bsyKod)
  }, [selloutRows, isBsy, bsyKod])

  // ── Filtre seçenekleri ───────────────────────────────────────

  // BSY seçenekleri — sadece admin; kod + ad çifti
  const bsyOptions = useMemo(() => {
    const map = new Map<string, string>()
    sellinRows.forEach(r => { if (r.bsyKod) map.set(r.bsyKod, r.bsyAdi) })
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'tr'))
      .map(([kod, adi]) => ({ value: kod, label: adi }))
  }, [sellinRows])

  // Cari seçenekleri — BSY ise sadece kendi carileri
  const cariOptions = useMemo(() => {
    const names = new Set<string>()
    baseSellin.forEach(r => names.add(r.cariIsim))
    return [...names].sort((a, b) => a.localeCompare(b, 'tr'))
      .map(n => ({ value: n, label: n }))
  }, [baseSellin])

  // Kategori seçenekleri — BSY ise sadece kendi sellout'undan
  const kategoriOptions = useMemo(() => {
    const s = new Set<string>()
    baseSellout.forEach(r => { if (r.grup_aciklama) s.add(r.grup_aciklama) })
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [baseSellout])

  // Stok seçenekleri — BSY ise sadece kendi stokları; MERCHX API'de filtrelenmiş
  const stokOptions = useMemo(() => {
    const set = new Set<string>()
    baseSellin.forEach(r => {
      const marka = MARKA_MAP[r.kategori]
      if (filterMarka.length && (!marka || !filterMarka.includes(marka))) return
      set.add(r.stokKodu.toUpperCase())
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSellin, filterMarka])

  // Ay seçenekleri — BSY ise sadece kendi ayları
  const ayOptions = useMemo(() => {
    const s = new Set<string>()
    baseSellin.forEach(r => s.add(String(r.ay)))
    return [...s].sort((a, b) => parseInt(a) - parseInt(b))
  }, [baseSellin])

  // Yıl seçenekleri
  const yilOptions = useMemo(
    () => yillar.map(y => ({ value: String(y), label: String(y) })),
    [yillar]
  )

  // ── Filtrelenmiş Sellout ─────────────────────────────────────
  const filteredSellout = useMemo(() => {
    return selloutRows.filter(r => {
      if (merchxKodlar.has(r.stok_kodu.toUpperCase())) return false   // MERCHX stokları dışla
      if (isBsy && bsyKod && r.bsy !== bsyKod) return false
      if (filterBsy && r.bsy !== filterBsy) return false   // filterBsy artık doğrudan BSY kodu
      if (filterCari && r.cari_isim !== filterCari) return false
      // Marka: sellout grup_kodu ile eşleştir
      const soMarka = MARKA_MAP[r.grup_kodu.toUpperCase()]
      if (!soMarka) return false   // EBE gibi markaları dışla
      if (filterMarka.length && !filterMarka.includes(soMarka)) return false
      // Kategori: sellout grup_aciklama
      if (filterKategori.length && !filterKategori.includes(r.grup_aciklama)) return false
      if (filterStok.length && !filterStok.includes(r.stok_kodu.toUpperCase())) return false
      if (filterAy.length) {
        const soAy = String(parseInt(r.donem.split('-')[1] ?? '0'))
        if (!filterAy.includes(soAy)) return false
      }
      if (filterYil) {
        if (r.donem.split('-')[0] !== filterYil) return false
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selloutRows, merchxKodlar, isBsy, bsyKod, filterBsy, filterCari, filterMarka, filterKategori, filterStok, filterAy, filterYil])

  // ── Filtrelenmiş Sellin ──────────────────────────────────────
  const filteredSellin = useMemo(() => {
    // Kategori filtresi aktifse, sell-out'ta bulunan stok_kodu'larını al
    // Böylece her iki taraf aynı ürün kapsamında karşılaştırılır
    // Normalize: büyük harfe çevir
    const allowedStokKodu: Set<string> | null = filterKategori.length > 0
      ? new Set(filteredSellout.map(r => r.stok_kodu.toUpperCase()))
      : null

    return sellinRows.filter(r => {
      if (isBsy && bsyKod && r.bsyKod !== bsyKod) return false   // BSY kodu üzerinden eşleştir
      if (filterBsy && r.bsyKod !== filterBsy) return false        // filterBsy = BSY kodu
      if (filterCari && r.cariIsim !== filterCari) return false
      // Marka: EKEA→ELECTROLUX, RELUX→RELUX; diğer markaları dışla
      const marka = MARKA_MAP[r.kategori]
      if (!marka) return false   // EBE gibi diğer markalar gösterilmez
      if (filterMarka.length && !filterMarka.includes(marka)) return false
      // Kategori filtresi aktifse, yalnızca sell-out'ta eşleşen stok kodları
      const stokUp = r.stokKodu.toUpperCase()
      if (allowedStokKodu && !allowedStokKodu.has(stokUp)) return false
      if (filterStok.length && !filterStok.includes(stokUp)) return false
      if (filterAy.length && !filterAy.includes(String(r.ay))) return false
      if (filterYil && r.yil !== parseInt(filterYil)) return false
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellinRows, filteredSellout, isBsy, bsyKod, filterBsy, filterCari, filterMarka, filterKategori, filterStok, filterAy, filterYil])

  // ── Tablo: Stok Kodu bazlı topla ─────────────────────────────
  const tableRows = useMemo<TableRow[]>(() => {
    const map = new Map<string, { sellin: number; sellout: number }>()

    // Stok kodlarını büyük harfe normalize et — kaynak farklılıklarından bağımsız
    filteredSellin.forEach(r => {
      const key = r.stokKodu.toUpperCase()
      const cur = map.get(key) ?? { sellin: 0, sellout: 0 }
      cur.sellin += r.adet
      map.set(key, cur)
    })

    filteredSellout.forEach(r => {
      const key = r.stok_kodu.toUpperCase()
      if (merchxKodlar.has(key)) return
      const cur = map.get(key) ?? { sellin: 0, sellout: 0 }
      cur.sellout += r.satilan_adet
      map.set(key, cur)
    })

    return [...map.entries()]
      .map(([stokKodu, v]) => ({
        stokKodu,
        sellin:  v.sellin,
        sellout: v.sellout,
        oran:    v.sellin > 0 ? (v.sellout / v.sellin) * 100 : null,
      }))
      // Büyükten küçüğe oran sıralaması; oran=null en sona
      .sort((a, b) => {
        if (a.oran === null && b.oran === null) return 0
        if (a.oran === null) return 1
        if (b.oran === null) return -1
        return b.oran - a.oran
      })
  }, [filteredSellin, filteredSellout])

  // Toplam satırı
  const totals = useMemo(() => ({
    sellin:  tableRows.reduce((s, r) => s + r.sellin, 0),
    sellout: tableRows.reduce((s, r) => s + r.sellout, 0),
  }), [tableRows])

  // Aktif filtre sayısı
  const activeFilterCount = [
    filterBsy, filterCari,
    ...filterMarka, ...filterKategori, ...filterStok, ...filterAy, filterYil,
  ].filter(Boolean).length

  const clearAll = () => {
    setFilterBsy(''); setFilterCari('')
    setFilterMarka([]); setFilterKategori([]); setFilterStok([]); setFilterAy([]); setFilterYil('')
  }

  const isLoadingAny = loading || soLoading

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Üst Bar ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <TrendingUp size={14} className="text-brand-600" />
        <span className="text-xs text-gray-700 font-semibold">Sellin / Sellout</span>
        <button
          onClick={() => { loadSellin(); reloadSellout() }}
          disabled={isLoadingAny}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoadingAny ? 'animate-spin' : ''} />
        </button>
        <div className="flex-1" />
        {!isLoadingAny && (
          <span className="text-[10px] text-gray-400">{tableRows.length} stok</span>
        )}
      </div>

      {/* ── Filtreler ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2">
        <div className="flex flex-wrap gap-1.5 items-center">

          {/* Yıl */}
          <SingleSelect
            label="Yıl"
            options={yilOptions}
            value={filterYil}
            onChange={setFilterYil}
          />

          {/* BSY — sadece admin */}
          {isAdmin && (
            <SingleSelect
              label="BSY"
              options={bsyOptions}
              value={filterBsy}
              onChange={setFilterBsy}
            />
          )}

          {/* Cari */}
          <SingleSelect
            label="Cari"
            options={cariOptions}
            value={filterCari}
            onChange={setFilterCari}
          />

          {/* Marka — multi (ELECTROLUX / RELUX) */}
          <MultiSelect
            label="Marka"
            options={MARKA_OPTIONS}
            selected={filterMarka}
            onChange={setFilterMarka}
          />

          {/* Kategori — multi (sellout grup_aciklama) */}
          <MultiSelect
            label="Kategori"
            options={kategoriOptions}
            selected={filterKategori}
            onChange={setFilterKategori}
          />

          {/* Stok — multi */}
          <MultiSelect
            label="Stok"
            options={stokOptions}
            selected={filterStok}
            onChange={setFilterStok}
          />

          {/* Ay — multi */}
          <MultiSelect
            label="Ay"
            options={ayOptions}
            selected={filterAy}
            onChange={setFilterAy}
          />

          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
            >
              <X size={11} />
              Temizle ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Tablo ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoadingAny ? (
          <div className="flex items-center justify-center h-full gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-4 py-2.5 font-semibold">Stok Kodu</th>
                <th className="text-right px-4 py-2.5 font-semibold min-w-[90px]">Sell In</th>
                <th className="text-right px-4 py-2.5 font-semibold min-w-[90px]">Sell Out</th>
                <th className="text-right px-4 py-2.5 font-semibold min-w-[80px]">Oran</th>
              </tr>
            </thead>

            <tbody>
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-400">
                    {activeFilterCount ? 'Eşleşen kayıt yok' : 'Veri yükleniyor veya seçim yapın'}
                  </td>
                </tr>
              )}
              {tableRows.map((row, idx) => {
                const oranColor =
                  row.oran === null ? 'text-gray-400'
                  : row.oran >= 80  ? 'text-green-600 font-semibold'
                  : row.oran >= 50  ? 'text-amber-600'
                  : 'text-red-500'
                return (
                  <tr
                    key={row.stokKodu}
                    className={clsx(
                      'border-b border-gray-100',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    )}
                  >
                    <td className="px-4 py-2 text-gray-700 font-mono text-[11px]">{row.stokKodu}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmtNum(row.sellin)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmtNum(row.sellout)}</td>
                    <td className={clsx('px-4 py-2 text-right', oranColor)}>
                      {row.oran !== null ? fmtPct(row.oran) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-800 text-white font-semibold text-[11px]">
                  <td className="px-4 py-2">Genel Toplam</td>
                  <td className="px-4 py-2 text-right">{fmtNum(totals.sellin)}</td>
                  <td className="px-4 py-2 text-right">{fmtNum(totals.sellout)}</td>
                  <td className="px-4 py-2 text-right">
                    {totals.sellin > 0 ? fmtPct((totals.sellout / totals.sellin) * 100) : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
