'use client'

import { useState, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useBsyCiro, BRAND_KEYS, BrandKey } from '@/hooks/useBsyCiro'
import { BRAND_LABEL } from '@/lib/bsy'

// ─── Sabitler ─────────────────────────────────────────────────
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const PRIM_BARAJI_PCT = 80  // % — sonraki brief'te yapılandırılacak

// ─── Format yardımcıları ───────────────────────────────────────
function fmtCur(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

// ─── BsyView Bileşeni ─────────────────────────────────────────
export function BsyView() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)

  const {
    bsyRows, brandTotals, genelToplamGercCiro,
    yillar, loading, error, source, reload,
  } = useBsyCiro(yil, ay)

  // Özet satırları — hedefler sonraki aşamada eklenecek, şimdilik 0
  const summary = BRAND_KEYS.map(brand => ({
    brand,
    hedefCiro:      0,
    gercCiro:       brandTotals[brand],
    toplamPrim:     0,
    havuzdakiPrim:  0,
  }))

  const toplamHedef    = summary.reduce((s, r) => s + r.hedefCiro, 0)
  const toplamGercCiro = genelToplamGercCiro
  const toplamGercPct  = toplamHedef > 0 ? (toplamGercCiro / toplamHedef) * 100 : 0

  // BSY detay satırları
  const bsyTableRows = useMemo(() =>
    bsyRows.map(r => {
      const cols = BRAND_KEYS.map(b => {
        const gt  = brandTotals[b]
        const gc  = r.brands[b].gercCiro
        const pay = gt > 0 ? (gc / gt) * 100 : 0
        return { gercCiro: gc, pay, hakedilen: 0 }
      })
      const toplamPay = toplamGercCiro > 0 ? (r.toplamGercCiro / toplamGercCiro) * 100 : 0
      return { bsyAdi: r.bsyAdi, cols, toplamGercCiro: r.toplamGercCiro, toplamPay }
    }),
    [bsyRows, brandTotals, toplamGercCiro]
  )

  const yilOptions = yillar.length
    ? yillar
    : [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Üst Bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">BSY Hedef Takip</span>

        {/* Yıl */}
        <div className="relative">
          <select
            value={yil}
            onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
          >
            {yilOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay */}
        <div className="relative">
          <select
            value={ay}
            onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
          >
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={reload}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {source === 'empty' && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Excel bağlantısı yok
          </span>
        )}

        <div className="flex-1" />
        {!loading && bsyRows.length > 0 && (
          <span className="text-[10px] text-gray-400">
            {bsyRows.length} BSY · {MONTHS_TR[ay - 1]} {yil}
          </span>
        )}
      </div>

      {/* Yükleniyor */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin mr-2" /> Veriler yükleniyor…
        </div>
      )}

      {/* Hata */}
      {!loading && error && (
        <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">{error}</div>
      )}

      {!loading && !error && (
        <div className="flex-1 overflow-auto p-4 space-y-4">

          {/* ── 1. Özet Tablo ───────────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[640px] bg-white rounded-xl shadow-sm overflow-hidden">
              <thead>
                <tr>
                  <th className="w-[148px] border border-gray-200 bg-gray-100" />
                  {BRAND_KEYS.map(b => (
                    <th key={b} className="border border-gray-300 bg-gray-800 text-white font-bold py-2 px-4 text-center">
                      {BRAND_LABEL[b]}
                    </th>
                  ))}
                  <th className="border border-gray-300 bg-gray-800 text-white font-bold py-2 px-4 text-center">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Hedef Ciro */}
                <SummaryRow label="Hedef Ciro" colSpan={4}>
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">
                      {fmtCur(s.hedefCiro)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">
                    {fmtCur(toplamHedef)}
                  </td>
                </SummaryRow>

                {/* Gerç. Ciro */}
                <SummaryRow label="Gerç. Ciro" shaded>
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center text-gray-800">
                      {fmtCur(s.gercCiro)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-800">
                    {fmtCur(toplamGercCiro)}
                  </td>
                </SummaryRow>

                {/* Gerç. Oranı */}
                <SummaryRow label="Gerç. Oranı">
                  {summary.map(s => {
                    const pct = s.hedefCiro > 0 ? (s.gercCiro / s.hedefCiro) * 100 : 0
                    return (
                      <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center text-gray-700">
                        {fmtPct(pct)}
                      </td>
                    )
                  })}
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-700">{fmtPct(toplamGercPct)}</td>
                </SummaryRow>

                {/* Toplam Prim */}
                <SummaryRow label="Toplam Prim" shaded>
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center font-bold text-gray-800">
                      {fmtCur(s.toplamPrim)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center font-bold text-gray-800">
                    {fmtCur(summary.reduce((a, s) => a + s.toplamPrim, 0))}
                  </td>
                </SummaryRow>

                {/* Havuzdaki Prim */}
                <SummaryRow label="Havuzdaki Prim">
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center font-medium text-green-600">
                      {fmtCur(s.havuzdakiPrim)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center font-medium text-green-600">
                    {fmtCur(summary.reduce((a, s) => a + s.havuzdakiPrim, 0))}
                  </td>
                </SummaryRow>

                {/* Prim Barajı */}
                <tr className="bg-green-50">
                  <td className="border border-green-200 bg-green-100 px-3 py-2 font-semibold text-green-800">Prim Barajı</td>
                  {BRAND_KEYS.map(b => (
                    <td key={b} className="border border-green-200 px-3 py-2 text-center font-semibold text-green-700">
                      %{PRIM_BARAJI_PCT},00
                    </td>
                  ))}
                  <td className="border border-green-200 px-3 py-2 text-center font-semibold text-green-700">
                    {fmtPct(toplamGercPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── 2. Dönem Banner ─────────────────────────────── */}
          <div className="overflow-x-auto">
            <div className="min-w-[640px] bg-red-600 text-white rounded-lg px-4 py-2 flex items-center gap-4 text-sm font-bold">
              <span className="bg-white/20 rounded px-2 py-0.5">{yil}</span>
              <span className="bg-white/20 rounded px-2 py-0.5">{ay}</span>
              <span>{MONTHS_TR[ay - 1]}</span>
              <span className="flex-1 text-center">Prim Ciro Barajı</span>
              <span>%{PRIM_BARAJI_PCT}</span>
              <span className="ml-auto">{fmtCur(toplamHedef)}</span>
            </div>
          </div>

          {/* ── 3. BSY Detay Tablosu ────────────────────────── */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs border-collapse min-w-max bg-white w-full">
              <thead className="sticky top-0 z-20">
                {/* Marka başlıkları */}
                <tr className="bg-gray-800 text-white">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 bg-gray-800 border-r border-gray-600 px-4 py-2 text-left min-w-[150px]"
                  >
                    Bsy Adı
                  </th>
                  {BRAND_KEYS.map(b => (
                    <th key={b} colSpan={3} className="border-r border-gray-600 px-3 py-2 text-center font-bold">
                      {BRAND_LABEL[b]}
                    </th>
                  ))}
                  <th colSpan={3} className="px-3 py-2 text-center font-bold">Toplam</th>
                </tr>
                {/* Kolon etiketleri */}
                <tr className="bg-gray-700 text-white text-[10px]">
                  {([...BRAND_KEYS, 'TOPLAM'] as const).map(b => (
                    <>
                      <th key={`${b}-gc`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[110px]">Gerç. Ciro</th>
                      <th key={`${b}-pay`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[90px]">Gerç. Cirodaki Payı</th>
                      <th key={`${b}-hak`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[100px]">Hakedilen Prim</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bsyTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={1 + (BRAND_KEYS.length + 1) * 3} className="py-12 text-center text-gray-400">
                      {source === 'empty'
                        ? 'Excel dosyasına erişilemiyor. BSY_EXCEL_PATH env veya lokal geliştirme ortamında çalışır.'
                        : 'Bu döneme ait veri bulunamadı.'}
                    </td>
                  </tr>
                ) : (
                  bsyTableRows.map((r, i) => (
                    <tr key={r.bsyAdi} className={clsx('border-b border-gray-100 hover:bg-blue-50/20', i % 2 === 1 && 'bg-gray-50/40')}>
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                        {r.bsyAdi}
                      </td>
                      {r.cols.map((c, ci) => (
                        <>
                          <td key={`${r.bsyAdi}-${ci}-gc`} className="border-r border-gray-100 px-3 py-1.5 text-right text-gray-800">
                            {c.gercCiro !== 0 ? fmtCur(c.gercCiro) : '—'}
                          </td>
                          <td key={`${r.bsyAdi}-${ci}-p`} className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-600">
                            {fmtPct(c.pay)}
                          </td>
                          <td key={`${r.bsyAdi}-${ci}-h`} className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-400">
                            —
                          </td>
                        </>
                      ))}
                      {/* Toplam */}
                      <td className="border-r border-gray-100 px-3 py-1.5 text-right font-semibold text-gray-800">
                        {fmtCur(r.toplamGercCiro)}
                      </td>
                      <td className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-600">
                        {fmtPct(r.toplamPay)}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-400">—</td>
                    </tr>
                  ))
                )}

                {/* Genel Toplam */}
                {bsyTableRows.length > 0 && (
                  <tr className="bg-red-50 border-t-2 border-red-300 font-semibold text-[11px]">
                    <td className="sticky left-0 z-10 bg-red-50 border-r border-red-200 px-4 py-2 text-red-700">
                      Genel Toplam
                    </td>
                    {BRAND_KEYS.map(b => {
                      const gc  = brandTotals[b]
                      const pct = toplamGercCiro > 0 ? (gc / toplamGercCiro) * 100 : 0
                      return (
                        <>
                          <td key={`gt-${b}-gc`} className="border-r border-red-100 px-3 py-2 text-right text-gray-800">{fmtCur(gc)}</td>
                          <td key={`gt-${b}-p`}  className="border-r border-red-100 px-3 py-2 text-center text-gray-700">{fmtPct(pct)}</td>
                          <td key={`gt-${b}-h`}  className="border-r border-red-100 px-3 py-2 text-center text-gray-400">—</td>
                        </>
                      )
                    })}
                    <td className="border-r border-red-100 px-3 py-2 text-right text-red-700 font-bold">{fmtCur(toplamGercCiro)}</td>
                    <td className="border-r border-red-100 px-3 py-2 text-center text-red-700">{fmtPct(100)}</td>
                    <td className="px-3 py-2 text-center text-gray-400">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Yardımcı bileşen: Özet tablo satırı ──────────────────────
function SummaryRow({
  label, shaded = false, children,
}: {
  label: string
  shaded?: boolean
  colSpan?: number
  children: React.ReactNode
}) {
  return (
    <tr className={shaded ? 'bg-gray-50/50' : ''}>
      <td className="border border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
        {label}
      </td>
      {children}
    </tr>
  )
}
