'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, ChevronDown, TrendingUp, AlertTriangle, Zap, Users, BarChart2, ShoppingCart } from 'lucide-react'
import clsx from 'clsx'
import { useSellout } from '@/hooks/useSellout'

// ─── Tipler ───────────────────────────────────────────────────
interface SellinRow {
  bsyKod: string; bsyAdi: string; cariKod: string; cariIsim: string
  stokKodu: string; stokAdi: string; kategori: string
  ay: number; yil: number; adet: number
}

interface CariStokEntry {
  cariIsim: string; cariKod: string
  bsyAdi: string;  bsyKod: string
  stokKodu: string; stokAdi: string; kategori: string
  sellin: number; sellout: number
}

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function fmtNum(n: number) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function pctStr(n: number) {
  return `%${n.toFixed(1)}`
}

// ─── Bölüm başlığı bileşeni ───────────────────────────────────
function Section({
  icon, title, subtitle, color = 'gray', count, children,
}: {
  icon: React.ReactNode; title: string; subtitle: string
  color?: 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'gray'
  count?: number; children: React.ReactNode
}) {
  const headerCls = {
    green:  'bg-green-600',
    red:    'bg-red-600',
    amber:  'bg-amber-500',
    blue:   'bg-blue-600',
    violet: 'bg-violet-600',
    gray:   'bg-gray-700',
  }[color]

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className={clsx('px-4 py-3 text-white flex items-start gap-2', headerCls)}>
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">{title}</h2>
            {count !== undefined && (
              <span className="text-[11px] bg-white/20 rounded-full px-2 py-0.5 font-semibold">{count}</span>
            )}
          </div>
          <p className="text-[11px] opacity-80 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  )
}

// ─── Oran badge ───────────────────────────────────────────────
function OranBadge({ oran }: { oran: number }) {
  const cls = oran >= 100 ? 'bg-red-100 text-red-700 font-bold'
            : oran >= 80  ? 'bg-amber-100 text-amber-700 font-semibold'
            : oran >= 50  ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-500'
  return (
    <span className={clsx('text-[10px] rounded px-1.5 py-0.5 tabular-nums', cls)}>
      {pctStr(oran)}
    </span>
  )
}

// ─── Risk badge ───────────────────────────────────────────────
function RiskBadge({ oran }: { oran: number }) {
  const cls = oran < 5   ? 'bg-red-100 text-red-700 font-bold'
            : oran < 15  ? 'bg-orange-100 text-orange-700 font-semibold'
                         : 'bg-amber-100 text-amber-700'
  return (
    <span className={clsx('text-[10px] rounded px-1.5 py-0.5 tabular-nums', cls)}>
      {pctStr(oran)}
    </span>
  )
}

// ─── Ana bileşen ──────────────────────────────────────────────
export function AnalizView() {
  const now = new Date()
  const [sellinRows,   setSellinRows]   = useState<SellinRow[]>([])
  const [yillar,       setYillar]       = useState<number[]>([])
  const [loading,      setLoading]      = useState(false)
  const [filterYil,    setFilterYil]    = useState('')
  const [filterAy,     setFilterAy]     = useState('')

  const loadSellin = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/sellin-sellout')
      const json = await res.json()
      const rows: SellinRow[] = json.rows ?? []
      const yils: number[]    = json.yillar ?? []
      setSellinRows(rows)
      setYillar(yils)
      if (yils.length) setFilterYil(String(Math.max(...yils)))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSellin() }, [loadSellin])

  const { rows: selloutRows, loading: soLoading, reload: reloadSo } = useSellout(true)

  // ── Filtrelenmiş setler ────────────────────────────────────
  const filtSellin = useMemo(() =>
    sellinRows.filter(r => {
      if (r.kategori !== 'EKEA' && r.kategori !== 'RELUX') return false
      if (filterYil && r.yil !== parseInt(filterYil)) return false
      if (filterAy  && r.ay  !== parseInt(filterAy))  return false
      return true
    }), [sellinRows, filterYil, filterAy])

  const filtSellout = useMemo(() =>
    selloutRows.filter(r => {
      const gk = r.grup_kodu.toUpperCase()
      if (gk !== 'EKEA' && gk !== 'RELUX') return false
      if (filterYil && r.donem.split('-')[0] !== filterYil) return false
      if (filterAy) {
        const soAy = parseInt(r.donem.split('-')[1] ?? '0')
        if (soAy !== parseInt(filterAy)) return false
      }
      return true
    }), [selloutRows, filterYil, filterAy])

  // ── Cari × Stok bazlı master harita ───────────────────────
  const cariStokMap: CariStokEntry[] = useMemo(() => {
    const map = new Map<string, CariStokEntry>()

    filtSellin.forEach(r => {
      const key = `${r.cariIsim}||${r.stokKodu.toUpperCase()}`
      const cur = map.get(key) ?? {
        cariIsim: r.cariIsim, cariKod: r.cariKod,
        bsyAdi: r.bsyAdi, bsyKod: r.bsyKod,
        stokKodu: r.stokKodu.toUpperCase(), stokAdi: r.stokAdi,
        kategori: r.kategori, sellin: 0, sellout: 0,
      }
      cur.sellin += r.adet
      map.set(key, cur)
    })

    filtSellout.forEach(r => {
      const key = `${r.cari_isim}||${r.stok_kodu.toUpperCase()}`
      const cur = map.get(key)
      if (cur) { cur.sellout += r.satilan_adet }
    })

    return [...map.values()].filter(r => r.sellin > 0)
  }, [filtSellin, filtSellout])

  // ── Özet KPI'lar ──────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalSellin  = cariStokMap.reduce((s, r) => s + r.sellin,  0)
    const totalSellout = cariStokMap.reduce((s, r) => s + r.sellout, 0)
    const acilSiparis  = cariStokMap.filter(r => r.sellout / r.sellin >= 1.0).length
    const yakinSiparis = cariStokMap.filter(r => { const o = r.sellout/r.sellin; return o >= 0.75 && o < 1.0 }).length
    const donukStok    = cariStokMap.filter(r => r.sellin >= 3 && r.sellout / r.sellin < 0.25).length
    const saglikliMus  = new Set(cariStokMap.filter(r => r.sellout / r.sellin >= 0.70).map(r => r.cariIsim)).size
    return { totalSellin, totalSellout, acilSiparis, yakinSiparis, donukStok, saglikliMus,
             genel: totalSellin > 0 ? (totalSellout / totalSellin) * 100 : 0 }
  }, [cariStokMap])

  // ── Analiz 1: Sipariş Tahmini ─────────────────────────────
  const reorderList = useMemo(() =>
    cariStokMap
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100 }))
      .filter(r => r.oran >= 75)
      .sort((a, b) => b.oran - a.oran)
      .slice(0, 30),
    [cariStokMap])

  // ── Analiz 2: Hareketsiz / Donuk Stok ─────────────────────
  const deadStockList = useMemo(() =>
    cariStokMap
      .filter(r => r.sellin >= 3)
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100 }))
      .filter(r => r.oran < 25)
      .sort((a, b) => a.oran - b.oran)
      .slice(0, 30),
    [cariStokMap])

  // ── Analiz 3: En Hızlı Satan Ürünler ──────────────────────
  const fastMovers = useMemo(() => {
    const map = new Map<string, { stokKodu: string; stokAdi: string; kategori: string; sellin: number; sellout: number; cariSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.stokKodu) ?? { stokKodu: r.stokKodu, stokAdi: r.stokAdi, kategori: r.kategori, sellin: 0, sellout: 0, cariSet: new Set() }
      cur.sellin  += r.sellin
      cur.sellout += r.sellout
      cur.cariSet.add(r.cariIsim)
      map.set(r.stokKodu, cur)
    })
    return [...map.values()]
      .filter(r => r.sellin >= 5)
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, cariSayisi: r.cariSet.size }))
      .sort((a, b) => b.oran - a.oran)
      .slice(0, 15)
  }, [cariStokMap])

  // ── Analiz 4: En Yavaş / Sorunlu Ürünler ─────────────────
  const slowMovers = useMemo(() => {
    const map = new Map<string, { stokKodu: string; stokAdi: string; kategori: string; sellin: number; sellout: number; cariSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.stokKodu) ?? { stokKodu: r.stokKodu, stokAdi: r.stokAdi, kategori: r.kategori, sellin: 0, sellout: 0, cariSet: new Set() }
      cur.sellin  += r.sellin
      cur.sellout += r.sellout
      cur.cariSet.add(r.cariIsim)
      map.set(r.stokKodu, cur)
    })
    return [...map.values()]
      .filter(r => r.sellin >= 10)
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, cariSayisi: r.cariSet.size }))
      .sort((a, b) => a.oran - b.oran)
      .slice(0, 15)
  }, [cariStokMap])

  // ── Analiz 5: Müşteri Sağlık Endeksi ──────────────────────
  const customerHealth = useMemo(() => {
    const map = new Map<string, { cariIsim: string; bsyAdi: string; sellin: number; sellout: number; stokSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.cariIsim) ?? { cariIsim: r.cariIsim, bsyAdi: r.bsyAdi, sellin: 0, sellout: 0, stokSet: new Set() }
      cur.sellin  += r.sellin
      cur.sellout += r.sellout
      cur.stokSet.add(r.stokKodu)
      map.set(r.cariIsim, cur)
    })
    return [...map.values()]
      .filter(r => r.sellin >= 3)
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, stokSayisi: r.stokSet.size }))
      .sort((a, b) => b.oran - a.oran)
  }, [cariStokMap])

  // ── Analiz 6: BSY Portföy ─────────────────────────────────
  const bsyPortfoy = useMemo(() => {
    const map = new Map<string, { bsyAdi: string; bsyKod: string; sellin: number; sellout: number; cariSet: Set<string>; stokSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.bsyKod) ?? { bsyAdi: r.bsyAdi, bsyKod: r.bsyKod, sellin: 0, sellout: 0, cariSet: new Set(), stokSet: new Set() }
      cur.sellin  += r.sellin
      cur.sellout += r.sellout
      cur.cariSet.add(r.cariIsim)
      cur.stokSet.add(r.stokKodu)
      map.set(r.bsyKod, cur)
    })
    return [...map.values()]
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, cariSayisi: r.cariSet.size, stokSayisi: r.stokSet.size }))
      .sort((a, b) => b.oran - a.oran)
  }, [cariStokMap])

  const isLoadingAny = loading || soLoading
  const marka = (k: string) => k === 'EKEA' ? 'ELX' : k === 'RELUX' ? 'RLX' : k

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Üst bar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <BarChart2 size={14} className="text-brand-600" />
        <span className="text-xs font-semibold text-gray-700">Satış Analizi</span>

        <div className="relative">
          <select value={filterYil} onChange={e => setFilterYil(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400">
            <option value="">Tüm Yıllar</option>
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterAy} onChange={e => setFilterAy(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-600 focus:outline-none focus:border-brand-400">
            <option value="">Tüm Aylar</option>
            {MONTHS_TR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={() => { loadSellin(); reloadSo() }} disabled={isLoadingAny}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50" title="Yenile">
          <RefreshCw size={14} className={isLoadingAny ? 'animate-spin' : ''} />
        </button>

        <div className="flex-1" />
        {!isLoadingAny && (
          <span className="text-[10px] text-gray-400">
            {cariStokMap.length} kombinasyon · {filterYil || 'Tüm yıllar'}{filterAy ? ' / ' + MONTHS_TR[parseInt(filterAy)-1] : ''}
          </span>
        )}
      </div>

      {isLoadingAny && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin mr-2" /> Veriler analiz ediliyor…
        </div>
      )}

      {!isLoadingAny && cariStokMap.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          Seçili dönem için veri bulunamadı.
        </div>
      )}

      {!isLoadingAny && cariStokMap.length > 0 && (
        <div className="flex-1 overflow-auto p-4 space-y-5">

          {/* ── KPI Kartları ─────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Genel Sellout Oranı', value: pctStr(kpi.genel), sub: `${fmtNum(kpi.totalSellout)} / ${fmtNum(kpi.totalSellin)} adet`, color: kpi.genel >= 70 ? 'bg-green-600' : kpi.genel >= 50 ? 'bg-amber-500' : 'bg-red-600' },
              { label: 'Acil Sipariş Beklenen', value: String(kpi.acilSiparis + kpi.yakinSiparis), sub: `${kpi.acilSiparis} acil · ${kpi.yakinSiparis} yakın`, color: 'bg-blue-600' },
              { label: 'Donuk Stok Riski', value: String(kpi.donukStok), sub: 'Stok %25 altında satan', color: kpi.donukStok > 10 ? 'bg-red-600' : 'bg-amber-500' },
              { label: 'Sağlıklı Müşteri', value: String(kpi.saglikliMus), sub: '%70+ sellout oranıyla', color: 'bg-green-600' },
            ].map(k => (
              <div key={k.label} className={clsx('rounded-xl p-3 text-white', k.color)}>
                <p className="text-lg font-bold leading-tight">{k.value}</p>
                <p className="text-[10px] opacity-80 mt-0.5">{k.label}</p>
                <p className="text-[9px] opacity-60 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Analiz 1: Sipariş Tahmini ─────────────── */}
          <Section
            icon={<ShoppingCart size={14} />}
            title="Yeniden Sipariş Tahmini"
            subtitle="Sellout/Sellin oranı ≥%75 olan ürünler — bu müşterilerle iletişime geçmek için doğru zaman"
            color="blue"
            count={reorderList.length}
          >
            {reorderList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Bu dönem için uygun veri yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {reorderList.map((r, i) => (
                  <div key={i} className={clsx('flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-gray-50', r.oran >= 100 && 'bg-red-50/40')}>
                    <span className="text-gray-400 w-5 text-right flex-shrink-0 font-mono">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800 truncate block">{r.cariIsim}</span>
                      <span className="text-gray-500 truncate block">{r.stokKodu}
                        <span className="ml-1 text-[10px] text-gray-400">{r.stokAdi}</span>
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <OranBadge oran={r.oran} />
                      <div className="text-[9px] text-gray-400 tabular-nums">
                        ↓{fmtNum(r.sellin)} → ↑{fmtNum(r.sellout)}
                      </div>
                    </div>
                    <span className={clsx('text-[9px] rounded px-1.5 py-0.5 flex-shrink-0',
                      r.oran >= 100 ? 'bg-red-100 text-red-700 font-bold' :
                      r.oran >= 80  ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600')}>
                      {r.oran >= 100 ? '🔴 Acil' : r.oran >= 80 ? '🟡 Yakın' : '🔵 İzle'}
                    </span>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{r.bsyAdi.split(' ')[0]}</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1 flex-shrink-0">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Analiz 2: Donuk Stok ──────────────────── */}
          <Section
            icon={<AlertTriangle size={14} />}
            title="Hareketsiz / Donuk Stok Riski"
            subtitle="En az 3 adet sellin yapılan ama sellout oranı %25'in altında kalan ürünler — müşteride stok birikmiş"
            color="red"
            count={deadStockList.length}
          >
            {deadStockList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Bu dönem için uygun veri yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {deadStockList.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-5 text-right flex-shrink-0 font-mono">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800 truncate block">{r.cariIsim}</span>
                      <span className="text-gray-500 truncate block">{r.stokKodu}
                        <span className="ml-1 text-[10px] text-gray-400">{r.stokAdi}</span>
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <RiskBadge oran={r.oran} />
                      <div className="text-[9px] text-gray-400 tabular-nums">
                        ↓{fmtNum(r.sellin)} → ↑{fmtNum(r.sellout)}
                      </div>
                    </div>
                    <span className={clsx('text-[9px] rounded px-1.5 py-0.5 flex-shrink-0',
                      r.oran < 5 ? 'bg-red-100 text-red-700 font-bold' : 'bg-orange-100 text-orange-700')}>
                      {r.oran < 5 ? '🔴 Kritik' : '🟠 Yüksek'}
                    </span>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{r.bsyAdi.split(' ')[0]}</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1 flex-shrink-0">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Analiz 3 + 4: Ürün Hız Analizi ──────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Section
              icon={<Zap size={14} />}
              title="En Hızlı Satan Ürünler"
              subtitle="Sellout/Sellin oranı en yüksek stoklar (min 5 sellin)"
              color="green"
            >
              <div className="divide-y divide-gray-50">
                {fastMovers.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-4 text-right font-mono">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800">{r.stokKodu}</span>
                      <span className="text-[10px] text-gray-500 ml-1">{r.stokAdi.slice(0, 30)}</span>
                    </div>
                    <OranBadge oran={r.oran} />
                    <span className="text-[9px] text-gray-400">{r.cariSayisi} müş.</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              icon={<AlertTriangle size={14} />}
              title="En Yavaş Satan Ürünler"
              subtitle="Sellout/Sellin oranı en düşük stoklar (min 10 sellin)"
              color="amber"
            >
              <div className="divide-y divide-gray-50">
                {slowMovers.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-4 text-right font-mono">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800">{r.stokKodu}</span>
                      <span className="text-[10px] text-gray-500 ml-1">{r.stokAdi.slice(0, 30)}</span>
                    </div>
                    <RiskBadge oran={r.oran} />
                    <span className="text-[9px] text-gray-400">{r.cariSayisi} müş.</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ── Analiz 5: Müşteri Sağlık Endeksi ─────── */}
          <Section
            icon={<Users size={14} />}
            title="Müşteri Sağlık Endeksi"
            subtitle="Müşteri bazında toplam sellout/sellin oranı — yüksek oran = sağlıklı ilişki ve tekrar sipariş potansiyeli"
            color="violet"
          >
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2 font-semibold text-gray-500">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Müşteri</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">BSY</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Sellin</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Sellout</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-500">Oran</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-500">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {customerHealth.map((r, i) => {
                    const badge = r.oran >= 85 ? { label: '🟢 Mükemmel',  cls: 'bg-green-100 text-green-700' }
                                : r.oran >= 65 ? { label: '🔵 İyi',        cls: 'bg-blue-100 text-blue-700' }
                                : r.oran >= 40 ? { label: '🟡 Orta',       cls: 'bg-yellow-100 text-yellow-700' }
                                : r.oran >= 20 ? { label: '🟠 Zayıf',      cls: 'bg-orange-100 text-orange-700' }
                                :               { label: '🔴 Kritik',     cls: 'bg-red-100 text-red-700' }
                    return (
                      <tr key={r.cariIsim} className={clsx('border-b border-gray-50 hover:bg-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                        <td className="px-4 py-2 text-gray-400 font-mono">{i+1}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800 max-w-[200px] truncate">{r.cariIsim}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.bsyAdi.split(' ').slice(0,2).join(' ')}</td>
                        <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtNum(r.sellin)}</td>
                        <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtNum(r.sellout)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={clsx('text-[10px] rounded px-1.5 py-0.5 tabular-nums font-semibold',
                            r.oran >= 70 ? 'bg-green-100 text-green-700' :
                            r.oran >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                            {pctStr(r.oran)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={clsx('text-[10px] rounded px-1.5 py-0.5', badge.cls)}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── Analiz 6: BSY Portföy ─────────────────── */}
          <Section
            icon={<TrendingUp size={14} />}
            title="BSY Portföy Performansı"
            subtitle="BSY bazında müşteri sellout sağlığı — hangi BSY'nin portföyü daha hızlı satıyor?"
            color="gray"
          >
            <div className="divide-y divide-gray-50">
              {bsyPortfoy.map((r, i) => {
                const barW = Math.min(r.oran, 100)
                return (
                  <div key={r.bsyKod} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <span className="text-gray-400 font-mono text-xs w-5">{i+1}.</span>
                    <div className="w-28 flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{r.bsyAdi.split(' ').slice(0,2).join(' ')}</p>
                      <p className="text-[10px] text-gray-400">{r.cariSayisi} müşteri · {r.stokSayisi} ürün</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className={clsx('h-2 rounded-full transition-all',
                            r.oran >= 70 ? 'bg-green-500' : r.oran >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${barW}%` }} />
                        </div>
                        <span className={clsx('text-xs font-semibold tabular-nums w-14 text-right',
                          r.oran >= 70 ? 'text-green-600' : r.oran >= 40 ? 'text-amber-600' : 'text-red-500')}>
                          {pctStr(r.oran)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {fmtNum(r.sellout)} / {fmtNum(r.sellin)} adet
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

        </div>
      )}
    </div>
  )
}
