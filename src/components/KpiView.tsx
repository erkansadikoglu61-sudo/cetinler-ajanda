'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Gift, Award, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

// ─── Kampanya Tanımları ───────────────────────────────────────────
interface Kampanya {
  id:         string
  stokKodlar: string[]   // tekli veya çoklu stok kodu
  stokAdi:    string
  marka:      string
  yil:        number
  ay:         number
  ayAdi:      string
  esik:       number
  odul:       string
  odulTutar:  string
  renk:       string     // tailwind gradient class başlangıcı
  renkDark:   string
}

const KAMPANYALAR: Kampanya[] = [
  {
    id:         'k1',
    stokKodlar: ['EP72UB21SW'],
    stokAdi:    'Dikey Şarjlı Süpürge',
    marka:      'Electrolux',
    yil:        2026,
    ay:         5,
    ayAdi:      'Mayıs',
    esik:       60,
    odul:       'Tatilbudur Çeki',
    odulTutar:  '25.000 TL',
    renk:       'from-[#1a8a8a] to-[#1aacac]',
    renkDark:   'bg-[#1a8a8a]',
  },
  {
    id:         'k2',
    stokKodlar: ['REP9548P', 'REP9548G'],
    stokAdi:    'REP9548P + REP9548G',
    marka:      'Relux',
    yil:        2026,
    ay:         5,
    ayAdi:      'Mayıs',
    esik:       250,
    odul:       'Tatilbudur Çeki',
    odulTutar:  '25.000 TL',
    renk:       'from-[#7c3aed] to-[#9f5cf0]',
    renkDark:   'bg-[#7c3aed]',
  },
]

// ─── Tipler ──────────────────────────────────────────────────────
interface BsyKpiRow {
  bsyAdi:       string
  adet:         number
  kazanilanCek: number
  kalanAdet:    number
  ilerleme:     number   // 0–100
}

// ─── Yardımcı ────────────────────────────────────────────────────
function hesapla(adet: number, esik: number): Omit<BsyKpiRow, 'bsyAdi' | 'adet'> {
  const net          = Math.max(0, adet)
  const kazanilanCek = Math.floor(net / esik)
  const mod          = net % esik
  const kalanAdet    = mod === 0 ? esik : esik - mod
  const ilerleme     = mod === 0 ? 0 : Math.round((mod / esik) * 100)
  return { kazanilanCek, kalanAdet, ilerleme }
}

function apiUrl(k: Kampanya): string {
  const base = `/api/kpi-adet?yil=${k.yil}&ay=${k.ay}`
  if (k.stokKodlar.length === 1) {
    return `${base}&stokKodu=${encodeURIComponent(k.stokKodlar[0])}`
  }
  return `${base}&stokKodlar=${encodeURIComponent(k.stokKodlar.join(','))}`
}

// ─── Ana Bileşen ─────────────────────────────────────────────────
export function KpiView() {
  const [aktifIdx, setAktifIdx] = useState(0)
  const kampanya = KAMPANYALAR[aktifIdx]

  const [rowsMap, setRowsMap]     = useState<Record<string, BsyKpiRow[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const load = useCallback(async (k: Kampanya) => {
    setLoadingId(k.id)
    try {
      const res  = await fetch(apiUrl(k))
      const data = await res.json()
      const apiRows = (data.rows ?? []) as { bsyAdi: string; adet: number }[]
      const parsed = apiRows
        .map(r => ({ bsyAdi: r.bsyAdi, adet: Math.max(0, r.adet), ...hesapla(r.adet, k.esik) }))
        .sort((a, b) => b.adet - a.adet)
      setRowsMap(prev => ({ ...prev, [k.id]: parsed }))
    } finally {
      setLoadingId(null)
    }
  }, [])

  // Aktif kampanya değişince yükle (henüz yüklenmediyse)
  useEffect(() => {
    if (!rowsMap[kampanya.id]) load(kampanya)
  }, [kampanya, rowsMap, load])

  const rows    = rowsMap[kampanya.id] ?? []
  const loading = loadingId === kampanya.id

  const toplamAdet = rows.reduce((s, r) => s + r.adet, 0)
  const toplamCek  = rows.reduce((s, r) => s + r.kazanilanCek, 0)

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Sekme Seçimi ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex border-b border-gray-200 bg-white">
        {KAMPANYALAR.map((k, idx) => (
          <button
            key={k.id}
            onClick={() => setAktifIdx(idx)}
            className={clsx(
              'flex-1 py-2.5 text-xs font-semibold transition-colors',
              aktifIdx === idx
                ? 'text-white ' + k.renkDark
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {k.marka}
            <div className="text-[10px] font-normal opacity-75">Her {k.esik} adet → Çek</div>
          </button>
        ))}
      </div>

      {/* ── Kampanya Başlık Kartı ─────────────────────────────────── */}
      <div className={clsx(
        'flex-shrink-0 bg-gradient-to-br text-white px-5 py-4 shadow-sm',
        kampanya.renk
      )}>
        <div className="flex items-start justify-between gap-4">

          {/* Sol: Ürün Bilgisi */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
              {kampanya.ayAdi} {kampanya.yil} · BSY Kampanyası
            </div>
            <div className="text-[11px] opacity-80">{kampanya.marka}</div>
            <div className="text-xl font-bold tracking-tight leading-tight">
              {kampanya.stokKodlar.join(' + ')}
            </div>
            <div className="text-xs opacity-80 mb-3">{kampanya.stokAdi}</div>

            {/* Ödül Bandı */}
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl px-3 py-2 w-fit">
              <Gift size={13} className="flex-shrink-0" />
              <span className="text-xs">
                Her{' '}
                <span className="font-bold text-sm">{kampanya.esik}</span>
                {' '}adette{' '}
                <span className="font-bold">1</span>{' '}
                {kampanya.odul}
              </span>
              <ChevronRight size={11} className="opacity-60" />
              <span className="font-bold text-sm">{kampanya.odulTutar}</span>
            </div>
          </div>

          {/* Sağ: Özet + Yenile */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button
              onClick={() => load(kampanya)}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {!loading && rows.length > 0 && (
              <div className="text-right">
                <div className="text-[10px] opacity-70">Toplam Satış</div>
                <div className="text-lg font-bold">{toplamAdet.toLocaleString('tr-TR')}</div>
                <div className="text-[10px] opacity-70 mt-1">Kazanılan Çek</div>
                <div className="flex items-center gap-1 justify-end">
                  <Award size={11} />
                  <span className="font-bold">{toplamCek}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tablo ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-4 py-2.5 font-semibold">#</th>
                <th className="text-left px-4 py-2.5 font-semibold">BSY</th>
                <th className="text-right px-4 py-2.5 font-semibold min-w-[90px]">Satış Adedi</th>
                <th className="text-right px-4 py-2.5 font-semibold min-w-[110px]">Kazanılan Çek</th>
                <th className="text-right px-4 py-2.5 font-semibold min-w-[90px]">Kalan</th>
                <th className="px-4 py-2.5 font-semibold min-w-[180px]">Sonraki Çeke İlerleme</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400">
                    {kampanya.stokKodlar.join(', ')} için {kampanya.ayAdi} {kampanya.yil} verisi bulunamadı
                  </td>
                </tr>
              )}

              {rows.map((row, idx) => (
                <tr
                  key={row.bsyAdi}
                  className={clsx(
                    'border-b border-gray-100 transition-colors',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                  )}
                >
                  <td className="px-4 py-3 text-gray-400 font-mono w-8">{idx + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-semibold">{row.bsyAdi}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-sm">
                    {row.adet.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.kazanilanCek > 0 ? (
                      <span className="inline-flex items-center justify-end gap-1 text-teal-600 font-bold">
                        <Award size={12} />
                        {row.kazanilanCek} çek
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {row.kalanAdet} adet
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={clsx(
                            'h-2.5 rounded-full transition-all duration-500',
                            row.ilerleme >= 80 ? 'bg-teal-500'
                            : row.ilerleme >= 50 ? 'bg-amber-400'
                            : 'bg-gray-300'
                          )}
                          style={{ width: `${row.ilerleme}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-7 text-right tabular-nums">
                        {row.ilerleme}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-800 text-white font-semibold text-[11px]">
                  <td className="px-4 py-2.5" colSpan={2}>Genel Toplam</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold">
                    {toplamAdet.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Award size={11} />{toplamCek} çek
                    </span>
                  </td>
                  <td className="px-4 py-2.5" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
