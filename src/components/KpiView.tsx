'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Gift, Award, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

// ─── Kampanya Tanımları ───────────────────────────────────────────
interface Kampanya {
  id:         string
  stokKodlar: string[]
  stokAdi:    string
  marka:      string
  yil:        number
  ay:         number
  ayAdi:      string
  esik:       number
  odul:       string
  odulTutar:  string
  renk:       string
  headerBg:   string
  accentText: string
}

const KAMPANYALAR: Kampanya[] = [
  {
    id:         'k1',
    stokKodlar: ['EP72UB21SW'],
    stokAdi:    'Dikey Şarjlı Süpürge',
    marka:      'Electrolux',
    yil:        2026, ay: 5, ayAdi: 'Mayıs',
    esik:       60,
    odul:       'Tatilbudur Çeki', odulTutar: '25.000 TL',
    renk:       'from-[#1a8a8a] to-[#1aacac]',
    headerBg:   'bg-[#1a8a8a]',
    accentText: 'text-teal-600',
  },
  {
    id:         'k2',
    stokKodlar: ['REP9548P', 'REP9548G'],
    stokAdi:    'REP9548P + REP9548G',
    marka:      'Relux',
    yil:        2026, ay: 5, ayAdi: 'Mayıs',
    esik:       250,
    odul:       'Tatilbudur Çeki', odulTutar: '25.000 TL',
    renk:       'from-[#7c3aed] to-[#9f5cf0]',
    headerBg:   'bg-[#7c3aed]',
    accentText: 'text-violet-600',
  },
]

// ─── Tipler ──────────────────────────────────────────────────────
interface BsyKpiRow {
  bsyAdi:       string
  adet:         number
  kazanilanCek: number
  kalanAdet:    number
  ilerleme:     number
}

// ─── Yardımcılar ─────────────────────────────────────────────────
function hesapla(adet: number, esik: number): Omit<BsyKpiRow, 'bsyAdi' | 'adet'> {
  const net          = Math.max(0, adet)
  const kazanilanCek = Math.floor(net / esik)
  const mod          = net % esik
  const kalanAdet    = mod === 0 ? esik : esik - mod
  const ilerleme     = mod === 0 ? 0 : Math.round((mod / esik) * 100)
  return { kazanilanCek, kalanAdet, ilerleme }
}

function apiUrl(k: Kampanya) {
  const base = `/api/kpi-adet?yil=${k.yil}&ay=${k.ay}`
  return k.stokKodlar.length === 1
    ? `${base}&stokKodu=${encodeURIComponent(k.stokKodlar[0])}`
    : `${base}&stokKodlar=${encodeURIComponent(k.stokKodlar.join(','))}`
}

// ─── Kampanya Bloğu ───────────────────────────────────────────────
function KampanyaBlok({ k, rows, loading, onRefresh }: {
  k: Kampanya
  rows: BsyKpiRow[]
  loading: boolean
  onRefresh: () => void
}) {
  const toplamAdet = rows.reduce((s, r) => s + r.adet, 0)
  const toplamCek  = rows.reduce((s, r) => s + r.kazanilanCek, 0)

  return (
    <div className="flex flex-col">
      {/* Başlık Kartı */}
      <div className={clsx('bg-gradient-to-br text-white px-4 py-3', k.renk)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
              {k.ayAdi} {k.yil} · BSY Kampanyası
            </div>
            <div className="text-[10px] opacity-80">{k.marka}</div>
            <div className="text-base font-bold leading-tight">{k.stokKodlar.join(' + ')}</div>
            <div className="text-[10px] opacity-80 mb-2">{k.stokAdi}</div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-2.5 py-1.5 w-fit">
              <Gift size={11} />
              <span className="text-[10px]">
                Her <span className="font-bold">{k.esik}</span> adette{' '}
                <span className="font-bold">1</span> {k.odul}
              </span>
              <ChevronRight size={9} className="opacity-60" />
              <span className="font-bold text-xs">{k.odulTutar}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            {!loading && rows.length > 0 && (
              <div className="text-right">
                <div className="text-[9px] opacity-70">Toplam</div>
                <div className="text-base font-bold">{toplamAdet.toLocaleString('tr-TR')}</div>
                <div className="flex items-center gap-1 justify-end">
                  <Award size={10} />
                  <span className="font-bold text-sm">{toplamCek}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
          <RefreshCw size={13} className="animate-spin" /> Yükleniyor…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-xs text-gray-400">
          {k.stokKodlar.join(', ')} için {k.ayAdi} {k.yil} verisi bulunamadı
        </div>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className={clsx('text-white text-[10px]', k.headerBg)}>
              <th className="text-left px-3 py-2 font-semibold w-6">#</th>
              <th className="text-left px-3 py-2 font-semibold">BSY</th>
              <th className="text-right px-3 py-2 font-semibold">Adet</th>
              <th className="text-right px-3 py-2 font-semibold">Çek</th>
              <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">Kalan</th>
              <th className="px-3 py-2 font-semibold min-w-[120px] hidden sm:table-cell">İlerleme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.bsyAdi} className={clsx(
                'border-b border-gray-100',
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
              )}>
                <td className="px-3 py-2.5 text-gray-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-2.5 text-gray-800 font-semibold">{row.bsyAdi}</td>
                <td className="px-3 py-2.5 text-right font-bold text-gray-900">{row.adet.toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2.5 text-right">
                  {row.kazanilanCek > 0 ? (
                    <span className={clsx('inline-flex items-center justify-end gap-1 font-bold', k.accentText)}>
                      <Award size={11} />{row.kazanilanCek}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-400 hidden sm:table-cell">{row.kalanAdet}</td>
                <td className="px-3 py-2.5 hidden sm:table-cell">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={clsx(
                          'h-2 rounded-full transition-all duration-500',
                          row.ilerleme >= 80 ? 'bg-teal-500'
                          : row.ilerleme >= 50 ? 'bg-amber-400'
                          : 'bg-gray-300'
                        )}
                        style={{ width: `${row.ilerleme}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 w-6 text-right tabular-nums">{row.ilerleme}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={clsx('text-white text-[10px] font-semibold', k.headerBg)}>
              <td className="px-3 py-2" colSpan={2}>Toplam</td>
              <td className="px-3 py-2 text-right font-bold">{toplamAdet.toLocaleString('tr-TR')}</td>
              <td className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Award size={10} />{toplamCek}
                </span>
              </td>
              <td className="px-3 py-2 hidden sm:table-cell" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────
export function KpiView() {
  const [rowsMap,    setRowsMap]    = useState<Record<string, BsyKpiRow[]>>({})
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set())

  const load = useCallback(async (k: Kampanya) => {
    setLoadingSet(prev => new Set(prev).add(k.id))
    try {
      const res  = await fetch(apiUrl(k))
      const data = await res.json()
      const parsed = ((data.rows ?? []) as { bsyAdi: string; adet: number }[])
        .map(r => ({ bsyAdi: r.bsyAdi, adet: Math.max(0, r.adet), ...hesapla(r.adet, k.esik) }))
        .sort((a, b) => b.adet - a.adet)
      setRowsMap(prev => ({ ...prev, [k.id]: parsed }))
    } finally {
      setLoadingSet(prev => { const s = new Set(prev); s.delete(k.id); return s })
    }
  }, [])

  useEffect(() => {
    KAMPANYALAR.forEach(k => load(k))
  }, [load])

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50 divide-y divide-gray-200">
      {KAMPANYALAR.map(k => (
        <KampanyaBlok
          key={k.id}
          k={k}
          rows={rowsMap[k.id] ?? []}
          loading={loadingSet.has(k.id)}
          onRefresh={() => load(k)}
        />
      ))}
    </div>
  )
}
