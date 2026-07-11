'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
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

export function PersonelliNoktaAnalizView() {
  const now = new Date()
  const [yil, setYil]   = useState(now.getFullYear())
  const [ay,  setAy]    = useState(now.getMonth() + 1)

  // Filtreler
  const [cariFilter, setCariFilter]   = useState('')
  const [grupFilter, setGrupFilter]   = useState('')
  const [bsyFilter,  setBsyFilter]    = useState('')

  // Manuel bütçe (kişi başı TL)
  const [birimButce, setBirimButce]   = useState('')

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
      const params = new URLSearchParams({
        yil:  String(yil),
        ay:   String(ay),
        grup: grupFilter,
        bsy:  bsyFilter,
      })
      const res  = await fetch(`/api/personelli-nokta-analiz?${params}`)
      const data: PersonelliNoktaResponse = await res.json()
      setAllRows(data.rows   ?? [])
      setGruplar(data.gruplar ?? [])
      setBsyler(data.bsyler   ?? [])
      setCarilar(data.carilar  ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [yil, ay, grupFilter, bsyFilter])

  useEffect(() => { load() }, [load])

  // Cari filtresi sadece ön yüzde uygulanıyor
  const rows = cariFilter
    ? allRows.filter(r => r.cariAdi === cariFilter)
    : allRows

  const birimSayi = parseFloat(birimButce.replace(/\./g,'').replace(',','.')) || 0

  // Toplam satırı
  const toplamPersonel = rows.reduce((s, r) => s + r.personelSayisi, 0)
  const toplamButce    = rows.reduce((s, r) => s + birimSayi * r.personelSayisi, 0)
  const toplamCiro     = rows.reduce((s, r) => s + r.gercCiro, 0)
  const toplamOran     = toplamCiro > 0 ? (toplamButce / toplamCiro) * 100 : 0

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Filtre çubuğu ───────────────────────────────────────────── */}
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

        {/* Filtre-2: Ay */}
        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400">
            {MONTHS_TR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Filtre-3: Grup/Marka */}
        <div className="relative">
          <select value={grupFilter} onChange={e => setGrupFilter(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400">
            <option value="">Tüm Markalar</option>
            {gruplar.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Filtre-4: BSY */}
        <div className="relative">
          <select value={bsyFilter} onChange={e => setBsyFilter(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400">
            <option value="">Tüm BSY</option>
            {bsyler.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Filtre-1: Cari İsim */}
        <div className="relative">
          <select value={cariFilter} onChange={e => setCariFilter(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none focus:border-brand-400">
            <option value="">Tüm Cariler</option>
            {carilar.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Personel Bütçesi manuel giriş (kişi başı TL) */}
        <div className="flex items-center gap-1.5 border border-amber-300 bg-amber-50 rounded-lg px-2 py-1">
          <span className="text-[10px] text-amber-700 font-medium whitespace-nowrap">Kişi Başı Bütçe (₺):</span>
          <input
            type="text"
            inputMode="numeric"
            value={birimButce}
            onChange={e => setBirimButce(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            className="w-24 text-xs font-semibold text-right bg-transparent border-none outline-none text-amber-900 placeholder-amber-300"
          />
        </div>

        {/* Yenile */}
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin text-brand-500' : 'text-gray-500'} />
        </button>

        {!loading && (
          <span className="text-[10px] text-gray-400">{rows.length} cari</span>
        )}
      </div>

      {/* ── İçerik ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-xs text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          {MONTHS_TR[ay-1]} {yil} döneminde Çetinler Merch verisi bulunamadı.
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
                const personelButce = birimSayi * row.personelSayisi
                const oran = row.gercCiro > 0 ? (personelButce / row.gercCiro) * 100 : null
                const oranYuksek = oran != null && oran > 9.99
                return (
                  <tr key={row.cariAdi}
                    className={clsx(
                      'border-b border-gray-100 hover:bg-brand-50/40 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                    )}>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-[10px]">{idx+1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{row.cariAdi}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                      {row.personelSayisi}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {birimSayi > 0 ? fmt(personelButce) + ' ₺' : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-800 font-semibold">
                      {row.gercCiro !== 0 ? fmt(row.gercCiro) + ' ₺' : <span className="text-gray-300">0 ₺</span>}
                    </td>
                    <td className={clsx(
                      'px-3 py-2.5 text-right font-bold',
                      oran == null   ? 'text-gray-300'
                      : oranYuksek   ? 'text-red-600'
                                     : 'text-green-700'
                    )}>
                      {oran == null || birimSayi === 0
                        ? '—'
                        : fmtPct(oran)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 text-white text-[11px] font-semibold">
                <td className="px-3 py-2.5" colSpan={2}>Toplam</td>
                <td className="px-3 py-2.5 text-right">{toplamPersonel}</td>
                <td className="px-3 py-2.5 text-right">
                  {birimSayi > 0 ? fmt(toplamButce) + ' ₺' : '—'}
                </td>
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
