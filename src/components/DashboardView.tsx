'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, Wallet, Award } from 'lucide-react'
import type { DashboardResponse, DashboardCiroRow, DashboardTahsilat, DashboardCariRow } from '@/app/api/dashboard/route'
import type { SelloutRow } from '@/app/api/sellout/route'
import type { DashboardSelloutMetrics } from '@/app/api/dashboard-sellout/route'
import { GRUP_NORMALIZE, SELLOUT_GROUPS } from '@/lib/sellout'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtTL = (n: number): string => {
  const sign = n < 0 ? '-' : ''
  return sign + '₺' + Math.abs(Math.round(n)).toLocaleString('tr-TR')
}
const fmtN   = (n: number): string => n.toLocaleString('tr-TR')
const fmtPct = (n: number): string => (n * 100).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// ── Ciro Table ────────────────────────────────────────────────────────────────
interface CiroTableProps {
  title: string
  rows: DashboardCiroRow[]
  headerColor: string
  loading: boolean
}

function CiroTable({ title, rows, headerColor, loading }: CiroTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className={`px-3 py-2 ${headerColor}`}>
        <p className="text-xs font-semibold text-white">{title}</p>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">BSY</th>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Electrolux</th>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Relux</th>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isTotal = row.bsyAdi === 'TOPLAM'
                return (
                  <tr
                    key={row.bsyAdi}
                    className={
                      isTotal
                        ? 'bg-gray-800 border-t-2 border-gray-400'
                        : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }
                  >
                    <td className={`px-2 py-1 truncate max-w-[90px] ${isTotal ? 'text-white font-bold' : 'text-gray-700'}`}>
                      {row.bsyAdi}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums ${isTotal ? 'text-white font-bold' : 'text-gray-600'}`}>
                      {row.elux !== 0 ? fmtTL(row.elux) : '—'}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums ${isTotal ? 'text-white font-bold' : 'text-gray-600'}`}>
                      {row.relux !== 0 ? fmtTL(row.relux) : '—'}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums font-semibold ${isTotal ? 'text-white' : 'text-gray-800'}`}>
                      {row.toplam !== 0 ? fmtTL(row.toplam) : '—'}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-400 py-4 text-xs">Veri yok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DashboardView() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [data, setData]         = useState<DashboardResponse | null>(null)
  const [selloutRows, setSelloutRows] = useState<SelloutRow[]>([])
  const [selloutMetrics, setSelloutMetrics] = useState<DashboardSelloutMetrics | null>(null)
  const [loading, setLoading]   = useState(false)

  const donem = `${yil}-${String(ay).padStart(2, '0')}`

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, soRes, metricsRes] = await Promise.all([
        fetch(`/api/dashboard?yil=${yil}&ay=${ay}`),
        fetch('/api/sellout'),
        fetch(`/api/dashboard-sellout?yil=${yil}&ay=${ay}`),
      ])
      const dashJson = await dashRes.json() as DashboardResponse
      const soJson   = await soRes.json() as { rows: SelloutRow[] }
      const metricsJson = await metricsRes.json() as DashboardSelloutMetrics
      setData(dashJson)
      setSelloutRows(soJson.rows ?? [])
      setSelloutMetrics(metricsJson)
    } catch (err) {
      console.error('[DashboardView] fetch hatası:', err)
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => {
    void fetchAll()
    const id = setInterval(fetchAll, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchAll])

  // ── Sellout computed ─────────────────────────────────────────────
  const filteredSellout = useMemo(
    () => selloutRows.filter(r => r.donem === donem),
    [selloutRows, donem]
  )

  const selloutByBrand = useMemo(() => {
    let elux = 0; let relux = 0
    filteredSellout.forEach(r => {
      const gk = (r.grup_kodu ?? '').toUpperCase().trim()
      if (gk === 'EKEA')  elux  += r.satilan_adet
      if (gk === 'RELUX') relux += r.satilan_adet
    })
    return { elux, relux }
  }, [filteredSellout])

  const adetByGrup = useMemo(() => {
    const totals: Record<string, number> = {}
    SELLOUT_GROUPS.forEach(g => { totals[g] = 0 })
    filteredSellout.forEach(r => {
      const normalized = GRUP_NORMALIZE[r.grup_aciklama] ?? r.grup_aciklama
      if (!SELLOUT_GROUPS.includes(normalized as typeof SELLOUT_GROUPS[number])) return
      totals[normalized as typeof SELLOUT_GROUPS[number]] += r.satilan_adet
    })
    return totals
  }, [filteredSellout])

  const totalAdet = useMemo(
    () => Object.values(adetByGrup).reduce((s, v) => s + v, 0),
    [adetByGrup]
  )

  const years = [2025, 2026]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-[#1a8a8a] to-[#1aacac] text-white shadow-md">
        <span className="font-bold text-base tracking-tight">Dashboard</span>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={ay}
            onChange={e => setAy(parseInt(e.target.value))}
            className="text-xs bg-white/20 text-white border border-white/30 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-white/60"
          >
            {MONTHS_TR.map((m, i) => (
              <option key={i + 1} value={i + 1} className="text-gray-800">{m}</option>
            ))}
          </select>
          <select
            value={yil}
            onChange={e => setYil(parseInt(e.target.value))}
            className="text-xs bg-white/20 text-white border border-white/30 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-white/60"
          >
            {years.map(y => (
              <option key={y} value={y} className="text-gray-800">{y}</option>
            ))}
          </select>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
            title="Yenile"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Body: 4 kolon grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 p-3 overflow-y-auto min-h-0 items-start">

        {/* KOL 1: Gerçekleşen Ciro */}
        <div className="flex flex-col gap-3">
          <CiroTable
            title="Gerçekleşen Ciro"
            rows={data?.gercCiro ?? []}
            headerColor="bg-[#1a8a8a]"
            loading={loading}
          />
        </div>

        {/* KOL 2: Müşteri Bazında Cirolar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-teal-700 flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Müşteri Bazında Cirolar</p>
            {!loading && (
              <span className="text-[10px] bg-white/20 text-white rounded-full px-2 py-0.5">
                {fmtN(data?.fatKesilenSayi ?? 0)} faturalı müşteri
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-center px-2 py-1.5 text-gray-400 font-medium w-6">#</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Müşteri</th>
                    <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Ciro</th>
                    <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.allCari ?? []).map((row: DashboardCariRow, i: number) => (
                    <tr key={row.cariIsim} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1 text-center text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-2 py-1 truncate max-w-[110px] text-gray-700">{row.cariIsim}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-gray-700 font-medium">{fmtTL(row.ciro)}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-gray-600">{fmtPct(row.pay)}</td>
                    </tr>
                  ))}
                  {(data?.allCari ?? []).length === 0 && (
                    <tr><td colSpan={4} className="text-center text-gray-400 py-4">Veri yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* KOL 3: Tahsilat */}
        {(() => {
          const t: DashboardTahsilat = data?.tahsilat ?? { hedef: 0, byTur: [], toplam: 0 }
          const pct = t.hedef > 0 ? Math.min((t.toplam / t.hedef) * 100, 100) : 0
          const TUR_LABEL: Record<string, string> = {
            'Banka-KK': 'Kredi Kartı',
            'Çek-Senet': 'Çek / Senet',
            'Nakit': 'Nakit',
            'EFT/Havale': 'EFT / Havale',
          }
          return (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col shadow-sm">
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#0f766e,#0d9488)' }}>
                <Wallet size={13} className="text-white/80" />
                <p className="text-xs font-semibold text-white">Tahsilat</p>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="px-3 py-2.5 flex flex-col gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Açık Hesap Hedefi</span>
                      <span className="text-[10px] font-semibold text-gray-500">{fmtTL(t.hedef)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#0d9488' }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-gray-400">Gerçekleşen</span>
                      <span className="text-[10px] font-bold text-gray-700">{pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%</span>
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {t.byTur.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="text-center py-3 text-gray-300 text-[10px]">Bu dönemde tahsilat verisi yok</td>
                          </tr>
                        ) : (
                          t.byTur.map(({ tur, tutar }) => (
                            <tr key={tur} className="border-b border-gray-50 last:border-0">
                              <td className="px-2.5 py-1.5 text-gray-600">{TUR_LABEL[tur] ?? tur}</td>
                              <td className="px-2.5 py-1.5 text-right font-semibold text-gray-800 tabular-nums">{fmtTL(tutar)}</td>
                            </tr>
                          ))
                        )}
                        {t.byTur.length > 0 && (
                          <tr className="bg-teal-50">
                            <td className="px-2.5 py-1.5 font-semibold text-teal-800">Toplam Tahsilat</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-teal-700 tabular-nums">{fmtTL(t.toplam)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* KOL 4: Sell-In/Sell-Out + Kategori Bazında Adetler */}
        <div className="flex flex-col gap-3">

          {/* Sell-In / Sell-Out */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-indigo-600">
              <p className="text-xs font-semibold text-white">Sell-In / Sell-Out</p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Marka</th>
                      <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Sell-In</th>
                      <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Sell-Out</th>
                      <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Oran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const brandRows = [
                        { label: 'Electrolux', si: data?.sellinByBrand.elux ?? 0,  so: selloutByBrand.elux  },
                        { label: 'Relux',      si: data?.sellinByBrand.relux ?? 0, so: selloutByBrand.relux },
                      ]
                      const totSi = brandRows.reduce((s, r) => s + r.si, 0)
                      const totSo = brandRows.reduce((s, r) => s + r.so, 0)
                      const totOran = totSi > 0 ? totSo / totSi : null
                      return (
                        <>
                          {brandRows.map(({ label, si, so }) => {
                            const oran = si > 0 ? so / si : null
                            const oranColor = oran === null ? 'text-gray-400' : oran >= 0.7 ? 'text-green-600' : oran >= 0.4 ? 'text-amber-600' : 'text-red-600'
                            return (
                              <tr key={label} className="border-b border-gray-50">
                                <td className="px-3 py-1.5 font-medium text-gray-700">{label}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{fmtN(si)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{fmtN(so)}</td>
                                <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${oranColor}`}>
                                  {oran === null ? '—' : fmtPct(oran)}
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="bg-gray-800">
                            <td className="px-3 py-1.5 text-white font-bold">Toplam</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-white font-bold">{fmtN(totSi)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-white font-bold">{fmtN(totSo)}</td>
                            <td className={`px-3 py-1.5 text-right font-bold tabular-nums ${totOran === null ? 'text-gray-400' : totOran >= 0.7 ? 'text-green-300' : totOran >= 0.4 ? 'text-amber-300' : 'text-red-300'}`}>
                              {totOran === null ? '—' : fmtPct(totOran)}
                            </td>
                          </tr>
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Kategori Bazında Adetler */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-purple-700">
              <p className="text-xs font-semibold text-white">Kategori Bazında Adetler</p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Kategori</th>
                      <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SELLOUT_GROUPS.map((g, i) => (
                      <tr key={g} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-[130px]">{g}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 font-medium">{fmtN(adetByGrup[g] ?? 0)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-800 border-t-2 border-gray-400">
                      <td className="px-2 py-1.5 text-white font-bold">Toplam</td>
                      <td className="px-2 py-1.5 text-right text-white font-bold tabular-nums">{fmtN(totalAdet)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* ═══════ SELLOUT ═══════ */}
        <div className="col-span-1 md:col-span-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center gap-2">
              <Award size={14} className="text-white/90" />
              <p className="text-xs font-semibold text-white uppercase tracking-wide">Sellout</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-3">
                {/* 2 Satır: Yıllık (2026) + Aylık (Haziran) */}
                <div className="space-y-3">
                  {/* Yıllık Row */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        {yil} Yılı
                      </span>
                      <div className="flex-1 border-b border-gray-200" />
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {/* Cari */}
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-purple-800 mb-1">
                          Cari ({yil})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.yillikCariTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.cariAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-purple-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.yillikCariTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Şube */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-blue-800 mb-1">
                          Şube ({yil})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.yillikSubeTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.subeAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-blue-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.yillikSubeTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Süpervizör */}
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-indigo-800 mb-1">
                          Süpervizör ({yil})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.yillikSupervizorler.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.supervizorAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-indigo-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.yillikSupervizorler.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Çetinler Merch */}
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-pink-800 mb-1">
                          Çetinler Merch ({yil})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.yillikCetinlerMerchTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.merchAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-pink-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.yillikCetinlerMerchTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Bayi Merch */}
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-teal-800 mb-1">
                          Bayi Merch ({yil})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.yillikBayiMerchTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.merchAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-teal-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.yillikBayiMerchTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Aylık Row */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                        {MONTHS_TR[ay - 1]} {yil}
                      </span>
                      <div className="flex-1 border-b border-gray-200" />
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {/* Cari */}
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-purple-800 mb-1">
                          Cari ({MONTHS_TR[ay - 1]})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.aylikCariTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.cariAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-purple-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.aylikCariTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Şube */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-blue-800 mb-1">
                          Şube ({MONTHS_TR[ay - 1]})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.aylikSubeTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.subeAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-blue-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.aylikSubeTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Süpervizör */}
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-indigo-800 mb-1">
                          Süpervizör ({MONTHS_TR[ay - 1]})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.aylikSupervizorler.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.supervizorAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-indigo-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.aylikSupervizorler.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Çetinler Merch */}
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-pink-800 mb-1">
                          Çetinler Merch ({MONTHS_TR[ay - 1]})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.aylikCetinlerMerchTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.merchAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-pink-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.aylikCetinlerMerchTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>

                      {/* Bayi Merch */}
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-teal-800 mb-1">
                          Bayi Merch ({MONTHS_TR[ay - 1]})
                        </div>
                        <div className="space-y-0.5">
                          {selloutMetrics?.aylikBayiMerchTop10.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-baseline gap-1 text-[9px]">
                              <span className="text-gray-400 font-medium w-3">{i + 1}.</span>
                              <span className="flex-1 truncate text-gray-700">{r.merchAdi}</span>
                              <span className="font-semibold text-gray-800 tabular-nums">{fmtN(r.adet)}</span>
                              <span className="text-teal-600 tabular-nums">%{(r.pay * 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {(!selloutMetrics?.aylikBayiMerchTop10.length) && (
                            <p className="text-[9px] text-gray-400 text-center py-2">Veri yok</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
