'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Gift, Award, ChevronRight, Users, User } from 'lucide-react'
import clsx from 'clsx'

// ─── Kampanya Tanımları ───────────────────────────────────────────
interface Kampanya {
  id:          string
  stokKodlar:  string[]
  stokAdi:     string
  marka:       string
  yil:         number
  ay:          number
  ayAdi:       string
  esik:        number          // bireysel eşik
  toplamEsik?: number         // kolektif eşik (tümü kazanır)
  odul:        string
  odulTutar:   string
  renk:        string
  headerBg:    string
  accentText:  string
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
  {
    id:          'k3',
    stokKodlar:  ['EP82AB25UG', 'EP82H25WET', 'EP82UB25UG'],
    stokAdi:     'EP82AB25UG · EP82H25WET · EP82UB25UG',
    marka:       'Electrolux',
    yil:         2026, ay: 5, ayAdi: 'Mayıs',
    esik:        50,            // bireysel: her BSY ≥50 → çek
    toplamEsik:  300,           // kolektif: toplam ≥300 → herkes çek
    odul:        'Tatilbudur Çeki', odulTutar: '25.000 TL',
    renk:        'from-[#1d4ed8] to-[#3b82f6]',
    headerBg:    'bg-[#1d4ed8]',
    accentText:  'text-blue-600',
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

// ─── Standart Kampanya Bloğu ──────────────────────────────────────
function KampanyaBlok({ k, rows, loading, onRefresh }: {
  k: Kampanya
  rows: BsyKpiRow[]
  loading: boolean
  onRefresh: () => void
}) {
  const toplamAdet = rows.reduce((s, r) => s + r.adet, 0)
  const toplamCek  = rows.reduce((s, r) => s + r.kazanilanCek, 0)

  // Kolektif hedef varsa onu kullan
  const toplamEsik     = k.toplamEsik
  const kolektifKazandi = toplamEsik != null && toplamAdet >= toplamEsik
  const kolektifPct    = toplamEsik != null ? Math.min(100, Math.round((toplamAdet / toplamEsik) * 100)) : null

  return (
    <div className="flex flex-col">
      {/* Başlık */}
      <div className={clsx('bg-gradient-to-br text-white px-4 py-3', k.renk)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
              {k.ayAdi} {k.yil} · BSY Kampanyası
            </div>
            <div className="text-[10px] opacity-80">{k.marka}</div>
            <div className="text-base font-bold leading-tight">{k.stokKodlar.join(' + ')}</div>
            <div className="text-[10px] opacity-80 mb-2">{k.stokAdi}</div>

            <div className="flex flex-col gap-1.5">
              {/* Bireysel kural */}
              <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-2.5 py-1.5 w-fit">
                <User size={10} />
                <span className="text-[10px]">
                  Bireysel: Her BSY <span className="font-bold">{k.esik}+</span> adet → {k.odul}
                </span>
                <ChevronRight size={9} className="opacity-60" />
                <span className="font-bold text-xs">{k.odulTutar}</span>
              </div>

              {/* Kolektif kural */}
              {toplamEsik != null && (
                <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-2.5 py-1.5 w-fit">
                  <Users size={10} />
                  <span className="text-[10px]">
                    Kolektif: Toplam <span className="font-bold">{toplamEsik}+</span> adet → Herkes çek alır
                  </span>
                </div>
              )}
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
                {toplamEsik == null && (
                  <div className="flex items-center gap-1 justify-end">
                    <Award size={10} />
                    <span className="font-bold text-sm">{toplamCek}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kolektif ilerleme barı */}
        {toplamEsik != null && !loading && rows.length > 0 && (
          <div className="mt-3">
            {kolektifKazandi ? (
              <div className="flex items-center gap-2 bg-green-400/30 rounded-lg px-3 py-2">
                <Award size={14} />
                <span className="text-xs font-bold">🎉 Kolektif hedef aşıldı! Tüm BSY&apos;ler çek kazandı!</span>
              </div>
            ) : (
              <div>
                <div className="flex justify-between text-[10px] opacity-80 mb-1">
                  <span>Kolektif hedef: {toplamAdet.toLocaleString('tr-TR')} / {toplamEsik.toLocaleString('tr-TR')} adet</span>
                  <span>{kolektifPct}%</span>
                </div>
                <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-white rounded-full transition-all duration-700"
                    style={{ width: `${kolektifPct}%` }}
                  />
                </div>
                <div className="text-[10px] opacity-70 mt-1">
                  Kalan: {Math.max(0, toplamEsik - toplamAdet).toLocaleString('tr-TR')} adet
                </div>
              </div>
            )}
          </div>
        )}
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
              <th className="text-center px-3 py-2 font-semibold">Durum</th>
              <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">Kalan</th>
              <th className="px-3 py-2 font-semibold min-w-[120px] hidden sm:table-cell">İlerleme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const bireyselKazandi = row.adet >= k.esik
              const kazandi = bireyselKazandi || kolektifKazandi
              return (
                <tr key={row.bsyAdi} className={clsx(
                  'border-b border-gray-100',
                  kazandi ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                )}>
                  <td className="px-3 py-2.5 text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{row.bsyAdi}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                    {row.adet.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {kazandi ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-bold text-[10px] bg-green-100 rounded-full px-2 py-0.5">
                        <Award size={10} /> Çek Kazandı
                      </span>
                    ) : (
                      <span className="text-gray-300 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400 hidden sm:table-cell">
                    {kazandi ? '—' : `${row.kalanAdet} adet`}
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {kazandi ? (
                      <div className="flex-1 bg-green-200 rounded-full h-2 overflow-hidden">
                        <div className="h-2 w-full bg-green-500 rounded-full" />
                      </div>
                    ) : (
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
                        <span className="text-[10px] text-gray-400 w-6 text-right tabular-nums">
                          {row.ilerleme}%
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={clsx('text-white text-[10px] font-semibold', k.headerBg)}>
              <td className="px-3 py-2" colSpan={2}>Toplam</td>
              <td className="px-3 py-2 text-right font-bold">{toplamAdet.toLocaleString('tr-TR')}</td>
              <td className="px-3 py-2 text-center">
                {toplamEsik == null && (
                  <span className="inline-flex items-center gap-1">
                    <Award size={10} />{toplamCek} çek
                  </span>
                )}
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
