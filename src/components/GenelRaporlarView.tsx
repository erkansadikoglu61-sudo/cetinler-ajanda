'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// ─── BSY Rapor Tablo Bileşeni ──────────────────────────────────
function BsyRaporTablosu({
  baslik, altyazi, rows, aylar, renkClass,
}: {
  baslik:    string
  altyazi:   string
  rows:      { bsyAdi: string; ay: number; adet: number }[]
  aylar:     number[]
  renkClass: string
}) {
  const bsyler = [...new Set(rows.map(r => r.bsyAdi))].sort((a, b) => {
    const totA = rows.filter(r => r.bsyAdi === a).reduce((s, r) => s + r.adet, 0)
    const totB = rows.filter(r => r.bsyAdi === b).reduce((s, r) => s + r.adet, 0)
    return totB - totA
  })

  const pivot = new Map<string, Map<number, number>>()
  rows.forEach(r => {
    if (!pivot.has(r.bsyAdi)) pivot.set(r.bsyAdi, new Map())
    pivot.get(r.bsyAdi)!.set(r.ay, r.adet)
  })

  const ayToplam = new Map<number, number>()
  aylar.forEach(ay => {
    ayToplam.set(ay, rows.filter(r => r.ay === ay).reduce((s, r) => s + r.adet, 0))
  })
  const genelToplam = rows.reduce((s, r) => s + r.adet, 0)

  if (bsyler.length === 0) {
    return (
      <div>
        <div className={clsx('px-3 py-2 rounded-t-xl text-white text-xs font-bold', renkClass)}>
          {baslik} <span className="font-normal opacity-80 ml-1">{altyazi}</span>
        </div>
        <div className="border border-t-0 border-gray-200 rounded-b-xl px-4 py-6 text-center text-xs text-gray-400">
          Veri bulunamadı
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className={clsx('px-3 py-2 rounded-t-xl text-white text-xs font-bold flex items-baseline gap-2', renkClass)}>
        {baslik}
        <span className="font-normal opacity-80 text-[10px]">{altyazi}</span>
      </div>
      <div className="overflow-x-auto border border-t-0 border-gray-200 rounded-b-xl">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">BSY</th>
              {aylar.map(ay => (
                <th key={ay} className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap min-w-[70px]">
                  {MONTHS_TR[ay - 1]}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-bold text-gray-700 whitespace-nowrap">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {bsyler.map((bsy, idx) => {
              const ayMap  = pivot.get(bsy) ?? new Map()
              const toplam = [...ayMap.values()].reduce((s, v) => s + v, 0)
              return (
                <tr key={bsy} className={clsx('border-b border-gray-100 last:border-0', idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-inherit">{bsy}</td>
                  {aylar.map(ay => {
                    const adet = ayMap.get(ay) ?? 0
                    return (
                      <td key={ay} className="px-3 py-2 text-right text-gray-700 tabular-nums">
                        {adet > 0 ? adet.toLocaleString('tr-TR') : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-bold text-gray-900 tabular-nums">{toplam.toLocaleString('tr-TR')}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={clsx('text-white text-[10px] font-semibold', renkClass)}>
              <td className="px-3 py-2">Toplam</td>
              {aylar.map(ay => (
                <td key={ay} className="px-3 py-2 text-right tabular-nums">
                  {(ayToplam.get(ay) ?? 0).toLocaleString('tr-TR')}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-bold">{genelToplam.toLocaleString('tr-TR')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Ana Bileşen ───────────────────────────────────────────────
export function GenelRaporlarView() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())

  interface RaporRow { bsyAdi: string; ay: number; adet: number }
  const [iplRows,      setIplRows]      = useState<RaporRow[]>([])
  const [rmsRows,      setRmsRows]      = useState<RaporRow[]>([])
  const [iplAylar,     setIplAylar]     = useState<number[]>([])
  const [rmsAylar,     setRmsAylar]     = useState<number[]>([])
  const [raporLoading, setRaporLoading] = useState(false)
  const [yillar,       setYillar]       = useState<number[]>([now.getFullYear() - 1, now.getFullYear()])

  useEffect(() => {
    setRaporLoading(true)
    const iplKodlar = 'IPL9650,IPL9750,IPL9850,IPL9950'
    const rmsKodlar = 'RMS9200P,RMS9200B'
    Promise.all([
      fetch(`/api/bsy-rapor?yil=${yil}&stokKodlar=${encodeURIComponent(iplKodlar)}`).then(r => r.json()),
      fetch(`/api/bsy-rapor?yil=${yil}&stokKodlar=${encodeURIComponent(rmsKodlar)}`).then(r => r.json()),
    ]).then(([ipl, rms]) => {
      setIplRows(ipl.rows ?? [])
      setIplAylar(ipl.aylar ?? [])
      setRmsRows(rms.rows ?? [])
      setRmsAylar(rms.aylar ?? [])
      if (ipl.yillar?.length) setYillar(ipl.yillar)
    }).finally(() => setRaporLoading(false))
  }, [yil])

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Üst Bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">Genel Raporlar</span>

        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400">
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={() => setYil(y => y)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Yenile">
          <RefreshCw size={14} className={raporLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <h2 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-2">BSY Rapor</h2>

        {raporLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
            <RefreshCw size={13} className="animate-spin" /> Yükleniyor…
          </div>
        ) : (
          <>
            <BsyRaporTablosu
              baslik="IPL Serisi"
              altyazi="IPL9650 · IPL9750 · IPL9850 · IPL9950"
              rows={iplRows}
              aylar={iplAylar}
              renkClass="bg-[#0e7490]"
            />
            <BsyRaporTablosu
              baslik="RMS9200 Serisi"
              altyazi="RMS9200P · RMS9200B"
              rows={rmsRows}
              aylar={rmsAylar}
              renkClass="bg-[#7c3aed]"
            />
          </>
        )}
      </div>
    </div>
  )
}
