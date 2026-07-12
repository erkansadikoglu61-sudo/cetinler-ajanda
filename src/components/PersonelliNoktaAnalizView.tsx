'use client'

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react'
import { RefreshCw, ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'
import type { PersonelliNoktaRow, PersonelliNoktaResponse } from '@/app/api/personelli-nokta-analiz/route'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtPct(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

// ─── Çoklu Seçim Dropdown ────────────────────────────────────────────────────
interface MultiSelectProps {
  options:   { value: string; label: string }[]
  selected:  string[]
  onChange:  (vals: string[]) => void
  placeholder: string
  maxWidth?: string
}

function MultiSelectDropdown({ options, selected, onChange, placeholder, maxWidth = '160px' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const toggle = (val: string) => {
    onChange(selected.includes(val)
      ? selected.filter(s => s !== val)
      : [...selected, val]
    )
  }

  const label = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? 'Tümü'
      : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} seçili`

  return (
    <div ref={ref} className="relative" style={{ maxWidth }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-xs border rounded-lg bg-white font-medium transition-colors',
          open ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
        )}
        style={{ minWidth: '100px' }}
      >
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown size={11} className={clsx('flex-shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
          {/* Tümü / Temizle */}
          <div className="flex gap-1 px-2 pb-1 border-b border-gray-100 mb-1">
            <button onClick={() => onChange(options.map(o => o.value))}
              className="text-[10px] text-brand-600 hover:underline">Tümü</button>
            <span className="text-gray-300">·</span>
            <button onClick={() => onChange([])}
              className="text-[10px] text-gray-400 hover:underline">Temizle</button>
          </div>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 transition-colors"
            >
              <span className={clsx(
                'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                selected.includes(opt.value)
                  ? 'bg-brand-500 border-brand-500'
                  : 'border-gray-300'
              )}>
                {selected.includes(opt.value) && <Check size={9} className="text-white" />}
              </span>
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
export function PersonelliNoktaAnalizView() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())

  // Çoklu ay seçimi — varsayılan: mevcut ay
  const [aylar, setAylar] = useState<string[]>([String(now.getMonth() + 1)])

  // Çoklu grup/marka seçimi — varsayılan: tümü (boş = filtre yok)
  const [grupFilters, setGrupFilters] = useState<string[]>([])

  // Tekli filtreler
  const [cariFilter, setCariFilter] = useState('')
  const [bsyFilter,  setBsyFilter]  = useState('')

  // Bütçe: input (yazılan) ve applied (tabloda kullanılan) ayrı
  const DEFAULT_BUTCE = 80000
  const [birimButceInput,   setBirimButceInput]   = useState('80.000')
  const [birimSayiApplied,  setBirimSayiApplied]  = useState(DEFAULT_BUTCE)

  const applyButce = useCallback(() => {
    const parsed = parseFloat(birimButceInput.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0) setBirimSayiApplied(parsed)
  }, [birimButceInput])

  // Veri
  const [allRows,  setAllRows]  = useState<PersonelliNoktaRow[]>([])
  const [gruplar,  setGruplar]  = useState<string[]>([])
  const [bsyler,   setBsyler]   = useState<string[]>([])
  const [carilar,  setCarilar]  = useState<string[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ yil: String(yil), bsy: bsyFilter })
      if (aylar.length > 0)       params.set('aylar',  aylar.join(','))
      if (grupFilters.length > 0) params.set('gruplar', grupFilters.join(','))

      const res  = await fetch(`/api/personelli-nokta-analiz?${params}`)
      const data: PersonelliNoktaResponse = await res.json()
      setAllRows(data.rows    ?? [])
      setGruplar(data.gruplar ?? [])
      setBsyler(data.bsyler   ?? [])
      setCarilar(data.carilar  ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [yil, aylar, grupFilters, bsyFilter])

  useEffect(() => { load() }, [load])

  // Cari filtresi frontend'de
  const rows = cariFilter ? allRows.filter(r => r.cariAdi === cariFilter) : allRows

  const birimSayi   = birimSayiApplied
  const aySayisi    = aylar.length || 1
  const toplamPersonel = rows.reduce((s, r) => s + r.personelSayisi, 0)
  const toplamButce    = rows.reduce((s, r) => s + birimSayi * r.personelSayisi * aySayisi, 0)
  const toplamCiro     = rows.reduce((s, r) => s + r.gercCiro, 0)
  const toplamOran     = toplamCiro > 0 ? (toplamButce / toplamCiro) * 100 : 0

  // Seçili ay etiketi (başlık için)
  const ayEtiketi = aylar.length === 0      ? 'Tüm Aylar'
    : aylar.length === 12 ? `${yil} Tümü`
    : aylar.length === 1  ? `${MONTHS_TR[parseInt(aylar[0]) - 1]} ${yil}`
    : `${aylar.length} ay · ${yil}`

  const ayOptions  = MONTHS_TR.map((m, i) => ({ value: String(i + 1), label: m }))
  const grupOptions = gruplar.map(g => ({ value: g, label: g }))

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Filtre çubuğu ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-600 mr-1">Personelli Nokta Analiz</span>

        {/* Yıl */}
        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay — çoklu seçim */}
        <MultiSelectDropdown
          options={ayOptions}
          selected={aylar}
          onChange={setAylar}
          placeholder="Ay seçin"
          maxWidth="140px"
        />

        {/* Grup/Marka — çoklu seçim */}
        <MultiSelectDropdown
          options={grupOptions}
          selected={grupFilters}
          onChange={vals => {
            // Tümü seçiliyse filtre yok (boş array)
            setGrupFilters(vals.length === grupOptions.length ? [] : vals)
          }}
          placeholder="Tüm Markalar"
          maxWidth="160px"
        />

        {/* BSY — tekli */}
        <div className="relative">
          <select value={bsyFilter} onChange={e => setBsyFilter(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400">
            <option value="">Tüm BSY</option>
            {bsyler.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Cari — tekli */}
        <div className="relative">
          <select value={cariFilter} onChange={e => setCariFilter(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400 max-w-[220px]">
            <option value="">Tüm Cariler</option>
            {carilar.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Kişi başı bütçe + güncelle butonu */}
        <div className="flex items-center border border-amber-300 bg-amber-50 rounded-lg overflow-hidden">
          <span className="text-[10px] text-amber-700 font-medium whitespace-nowrap pl-2 pr-1">Kişi Başı Bütçe (₺):</span>
          <input
            type="text"
            inputMode="numeric"
            value={birimButceInput}
            onChange={e => setBirimButceInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') applyButce() }}
            className="w-24 text-xs font-semibold text-right bg-transparent border-none outline-none text-amber-900 py-1 pr-1"
          />
          <button
            onClick={applyButce}
            title="Güncelle"
            className="flex items-center justify-center px-2 py-1 bg-amber-400 hover:bg-amber-500 transition-colors text-white"
          >
            <Check size={12} strokeWidth={3} />
          </button>
        </div>

        {/* Veri yenile */}
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin text-brand-500' : 'text-gray-500'} />
        </button>

        {!loading && (
          <span className="text-[10px] text-gray-400">{rows.length} cari</span>
        )}
      </div>

      {/* ── İçerik ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-xs text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          {ayEtiketi} döneminde Çetinler Merch verisi bulunamadı.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white text-[11px]">
                <th className="text-left px-3 py-2.5 font-semibold w-6">#</th>
                <th className="text-left px-3 py-2.5 font-semibold">Cari İsim</th>
                <th className="text-right px-3 py-2.5 font-semibold">Personel Sayısı</th>
                <th className="text-right px-3 py-2.5 font-semibold">Personel Bütçesi</th>
                <th className="text-right px-3 py-2.5 font-semibold">Gerçekleşen Ciro</th>
                <th className="text-right px-3 py-2.5 font-semibold">Bütçe/Ciro Oranı</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const personelButce = birimSayi * row.personelSayisi * aySayisi
                const oran = row.gercCiro > 0 ? (personelButce / row.gercCiro) * 100 : null
                const oranYuksek = oran != null && oran > 9.99
                return (
                  <tr key={row.cariAdi}
                    className={clsx(
                      'border-b border-gray-100 hover:bg-brand-50/40 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                    )}>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{row.cariAdi}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{row.personelSayisi}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {birimSayi > 0 ? fmt(personelButce) + ' ₺' : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-800 font-semibold">
                      {row.gercCiro !== 0 ? fmt(row.gercCiro) + ' ₺' : <span className="text-gray-300">0 ₺</span>}
                    </td>
                    <td className={clsx(
                      'px-3 py-2.5 text-right font-bold',
                      oran == null  ? 'text-gray-300'
                      : oranYuksek  ? 'text-red-600'
                                    : 'text-green-700'
                    )}>
                      {oran == null || birimSayi === 0 ? '—' : fmtPct(oran)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 text-white text-[11px] font-semibold">
                <td className="px-3 py-2.5" colSpan={2}>Toplam · {ayEtiketi}</td>
                <td className="px-3 py-2.5 text-right">{toplamPersonel}</td>
                <td className="px-3 py-2.5 text-right">{birimSayi > 0 ? fmt(toplamButce) + ' ₺' : '—'}</td>
                <td className="px-3 py-2.5 text-right">{fmt(toplamCiro)} ₺</td>
                <td className={clsx(
                  'px-3 py-2.5 text-right',
                  toplamOran > 9.99 ? 'text-red-300' : 'text-green-300'
                )}>
                  {birimSayi > 0 && toplamCiro > 0 ? fmtPct(toplamOran) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
