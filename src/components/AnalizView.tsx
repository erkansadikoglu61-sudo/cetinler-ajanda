'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { RefreshCw, TrendingUp, AlertTriangle, Zap, Users, BarChart2, ShoppingCart, GitCompare, Clock } from 'lucide-react'
import clsx from 'clsx'
import { useSellout } from '@/hooks/useSellout'

// ─── Sabitler ─────────────────────────────────────────────────
// Sellin: 01.07.2025 ve sonrası
const SELLIN_YIL_BASLANGIC = 2025
const SELLIN_AY_BASLANGIC  = 7
// Sellout: 01.01.2026 ve sonrası
const SELLOUT_YIL_BASLANGIC = 2026
const REFRESH_MS = 5 * 60 * 1000   // 5 dakikada bir otomatik yenile

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

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
  sellin: number; sellout: number; ay: number
}

// ─── Renk varyantı birleştirme ────────────────────────────────
const STOK_BIRLESIM: Record<string, string> = {
  'RMS9200B': 'RMS9200', 'RMS9200P': 'RMS9200',
  'AS8200B':  'AS8200',  'AS8200P':  'AS8200',
  'RHD6165W': 'RHD6165', 'RHD6165G': 'RHD6165',
  'RHD9190W': 'RHD9190', 'RHD9190B': 'RHD9190',
  'RHS8900B': 'RHS8900', 'RHS8900P': 'RHS8900',
  'RHS9000B': 'RHS9000', 'RHS9000P': 'RHS9000',
}
function normStok(kodu: string): string {
  const up = kodu.toUpperCase()
  return STOK_BIRLESIM[up] ?? up
}

// ─── Format yardımcıları ──────────────────────────────────────
function fmtNum(n: number) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function pctStr(n: number) {
  return `%${n.toFixed(1)}`
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Bölüm başlığı bileşeni ───────────────────────────────────
function Section({
  icon, title, subtitle, color = 'gray', count, children,
}: {
  icon: React.ReactNode; title: string; subtitle: string
  color?: 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'gray' | 'teal' | 'orange'
  count?: number; children: React.ReactNode
}) {
  const headerCls: Record<string, string> = {
    green:  'bg-green-600',   red:    'bg-red-600',
    amber:  'bg-amber-500',   blue:   'bg-blue-600',
    violet: 'bg-violet-600',  gray:   'bg-gray-700',
    teal:   'bg-teal-600',    orange: 'bg-orange-500',
  }
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className={clsx('px-4 py-3 text-white flex items-start gap-2', headerCls[color])}>
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

function OranBadge({ oran }: { oran: number }) {
  const cls = oran >= 100 ? 'bg-red-100 text-red-700 font-bold'
            : oran >= 80  ? 'bg-amber-100 text-amber-700 font-semibold'
            : oran >= 50  ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-500'
  return <span className={clsx('text-[10px] rounded px-1.5 py-0.5 tabular-nums', cls)}>{pctStr(oran)}</span>
}

function RiskBadge({ oran }: { oran: number }) {
  const cls = oran < 5  ? 'bg-red-100 text-red-700 font-bold'
            : oran < 15 ? 'bg-orange-100 text-orange-700 font-semibold'
                        : 'bg-amber-100 text-amber-700'
  return <span className={clsx('text-[10px] rounded px-1.5 py-0.5 tabular-nums', cls)}>{pctStr(oran)}</span>
}

function StatusBadge({ oran }: { oran: number }) {
  if (oran >= 85) return <span className="text-[10px] rounded px-1.5 py-0.5 bg-green-100 text-green-700">🟢 Mükemmel</span>
  if (oran >= 65) return <span className="text-[10px] rounded px-1.5 py-0.5 bg-blue-100 text-blue-700">🔵 İyi</span>
  if (oran >= 40) return <span className="text-[10px] rounded px-1.5 py-0.5 bg-yellow-100 text-yellow-700">🟡 Orta</span>
  if (oran >= 20) return <span className="text-[10px] rounded px-1.5 py-0.5 bg-orange-100 text-orange-700">🟠 Zayıf</span>
  return <span className="text-[10px] rounded px-1.5 py-0.5 bg-red-100 text-red-700">🔴 Kritik</span>
}

const marka = (k: string) => k === 'EKEA' ? 'ELX' : k === 'RELUX' ? 'RLX' : k

// ─── Ana bileşen ──────────────────────────────────────────────
export function AnalizView() {
  const [sellinRows, setSellinRows] = useState<SellinRow[]>([])
  const [loading,    setLoading]    = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSellin = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/sellin-sellout')
      const json = await res.json()
      setSellinRows(json.rows ?? [])
      setLastUpdate(new Date())
    } finally { setLoading(false) }
  }, [])

  // İlk yükleme + otomatik yenileme
  useEffect(() => {
    loadSellin()
    timerRef.current = setInterval(loadSellin, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadSellin])

  const { rows: selloutRows, loading: soLoading, reload: reloadSo } = useSellout(true)

  // ── Sellin: 01.07.2025'ten itibaren ──────────────────────
  const filtSellin = useMemo(() =>
    sellinRows.filter(r => {
      if (r.kategori !== 'EKEA' && r.kategori !== 'RELUX') return false
      if (r.yil === SELLIN_YIL_BASLANGIC) return r.ay >= SELLIN_AY_BASLANGIC
      return r.yil > SELLIN_YIL_BASLANGIC
    }), [sellinRows])

  // ── Sellout: 01.01.2026'dan itibaren ─────────────────────
  const filtSellout = useMemo(() =>
    selloutRows.filter(r => {
      const yil = parseInt(r.donem.split('-')[0] ?? '0')
      if (yil < SELLOUT_YIL_BASLANGIC) return false
      const gk = r.grup_kodu.toUpperCase()
      return gk === 'EKEA' || gk === 'RELUX'
    }), [selloutRows])

  // ── Cari × Stok master harita ─────────────────────────────
  const cariStokMap: CariStokEntry[] = useMemo(() => {
    const map = new Map<string, CariStokEntry>()
    filtSellin.forEach(r => {
      const stok = normStok(r.stokKodu)
      const key  = `${r.cariIsim}||${stok}`
      const cur  = map.get(key) ?? {
        cariIsim: r.cariIsim, cariKod: r.cariKod,
        bsyAdi: r.bsyAdi, bsyKod: r.bsyKod,
        stokKodu: stok, stokAdi: r.stokAdi,
        kategori: r.kategori, sellin: 0, sellout: 0, ay: r.ay,
      }
      cur.sellin += r.adet
      if (r.ay > cur.ay) cur.ay = r.ay
      map.set(key, cur)
    })
    filtSellout.forEach(r => {
      const stok = normStok(r.stok_kodu)
      const key  = `${r.cari_isim}||${stok}`
      const cur  = map.get(key)
      if (cur) cur.sellout += r.satilan_adet
    })
    return [...map.values()].filter(r => r.sellin > 0)
  }, [filtSellin, filtSellout])

  // ── Aktif yıl-ay kombinasyonları ──────────────────────────
  const activeYilAylar = useMemo(() => {
    const s = new Set<string>()
    filtSellin.forEach(r => s.add(`${r.yil}-${String(r.ay).padStart(2,'0')}`))
    return [...s].sort()
  }, [filtSellin])

  // ── KPI özeti ─────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalSellin  = cariStokMap.reduce((s, r) => s + r.sellin,  0)
    const totalSellout = cariStokMap.reduce((s, r) => s + r.sellout, 0)
    const acil   = cariStokMap.filter(r => r.sellout / r.sellin >= 1.0).length
    const yakin  = cariStokMap.filter(r => { const o = r.sellout/r.sellin; return o >= 0.75 && o < 1.0 }).length
    const donuk  = cariStokMap.filter(r => r.sellin >= 3 && r.sellout / r.sellin < 0.25).length
    const saglik = new Set(cariStokMap.filter(r => r.sellout / r.sellin >= 0.70).map(r => r.cariIsim)).size
    return {
      totalSellin, totalSellout, acil, yakin, donuk, saglik,
      genel: totalSellin > 0 ? (totalSellout / totalSellin) * 100 : 0,
    }
  }, [cariStokMap])

  // ── A1: Sipariş Tahmini — müşteri bazlı gruplama ──────────
  const reorderList = useMemo(() => {
    const map = new Map<string, {
      cariIsim: string; bsyAdi: string
      urunler: { stokKodu: string; oran: number }[]
    }>()

    cariStokMap.forEach(r => {
      const oran = r.sellin > 0 ? (r.sellout / r.sellin) * 100 : 0
      if (oran < 50) return
      const cur = map.get(r.cariIsim) ?? { cariIsim: r.cariIsim, bsyAdi: r.bsyAdi, urunler: [] }
      cur.urunler.push({ stokKodu: r.stokKodu, oran })
      map.set(r.cariIsim, cur)
    })

    return [...map.values()]
      .map(c => {
        c.urunler.sort((a, b) => b.oran - a.oran)
        c.urunler = c.urunler.slice(0, 10)   // max 10 ürün
        return { ...c, maxOran: c.urunler[0]?.oran ?? 0 }
      })
      .sort((a, b) => b.maxOran - a.maxOran)
  }, [cariStokMap])

  // ── A2: Donuk Stok ────────────────────────────────────────
  const deadStockList = useMemo(() =>
    cariStokMap
      .filter(r => r.sellin >= 3)
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100 }))
      .filter(r => r.oran < 25)
      .sort((a, b) => a.oran - b.oran)
      .slice(0, 30),
    [cariStokMap])

  // ── A3: En Hızlı/Yavaş Ürünler ───────────────────────────
  const productMap = useMemo(() => {
    const map = new Map<string, { stokKodu: string; stokAdi: string; kategori: string; sellin: number; sellout: number; cariSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.stokKodu) ?? { stokKodu: r.stokKodu, stokAdi: r.stokAdi, kategori: r.kategori, sellin: 0, sellout: 0, cariSet: new Set() }
      cur.sellin += r.sellin; cur.sellout += r.sellout; cur.cariSet.add(r.cariIsim)
      map.set(r.stokKodu, cur)
    })
    return [...map.values()].map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, cariSayisi: r.cariSet.size }))
  }, [cariStokMap])

  const fastMovers = useMemo(() => productMap.filter(r => r.sellin >= 5).sort((a, b) => b.oran - a.oran).slice(0, 15), [productMap])
  const slowMovers = useMemo(() => productMap.filter(r => r.sellin >= 10).sort((a, b) => a.oran - b.oran).slice(0, 15), [productMap])

  // ── A4: Müşteri Sağlık ────────────────────────────────────
  const customerHealth = useMemo(() => {
    const map = new Map<string, { cariIsim: string; bsyAdi: string; sellin: number; sellout: number; stokSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.cariIsim) ?? { cariIsim: r.cariIsim, bsyAdi: r.bsyAdi, sellin: 0, sellout: 0, stokSet: new Set() }
      cur.sellin += r.sellin; cur.sellout += r.sellout; cur.stokSet.add(r.stokKodu)
      map.set(r.cariIsim, cur)
    })
    return [...map.values()]
      .filter(r => r.sellin >= 3)
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, stokSayisi: r.stokSet.size }))
      .sort((a, b) => b.oran - a.oran)
  }, [cariStokMap])

  // ── A5: BSY Portföy ───────────────────────────────────────
  const bsyPortfoy = useMemo(() => {
    const map = new Map<string, { bsyAdi: string; bsyKod: string; sellin: number; sellout: number; cariSet: Set<string>; stokSet: Set<string> }>()
    cariStokMap.forEach(r => {
      const cur = map.get(r.bsyKod) ?? { bsyAdi: r.bsyAdi, bsyKod: r.bsyKod, sellin: 0, sellout: 0, cariSet: new Set(), stokSet: new Set() }
      cur.sellin += r.sellin; cur.sellout += r.sellout
      cur.cariSet.add(r.cariIsim); cur.stokSet.add(r.stokKodu)
      map.set(r.bsyKod, cur)
    })
    return [...map.values()]
      .map(r => ({ ...r, oran: (r.sellout / r.sellin) * 100, cariSayisi: r.cariSet.size, stokSayisi: r.stokSet.size }))
      .sort((a, b) => b.oran - a.oran)
  }, [cariStokMap])

  // ── A6: Aylık Trend ───────────────────────────────────────
  const aylikTrend = useMemo(() => {
    return activeYilAylar.map(yilAy => {
      const [yilStr, ayStr] = yilAy.split('-')
      const yil = parseInt(yilStr); const ay = parseInt(ayStr)
      const aySellin = filtSellin.filter(r => r.yil === yil && r.ay === ay)
      // Sellout: sadece 2026 ve sonrası var
      const aysSo = filtSellout.filter(r => r.donem.startsWith(yilAy))
      const totalSi  = aySellin.reduce((s, r) => s + r.adet, 0)
      const totalSo  = aysSo.reduce((s, r) => s + r.satilan_adet, 0)
      const musSet   = new Set(aySellin.map(r => r.cariIsim))
      const stokSet  = new Set(aySellin.map(r => normStok(r.stokKodu)))
      return {
        yilAy, yil, ay,
        label: `${MONTHS_TR[ay-1]} ${yil}`,
        sellin: totalSi, sellout: totalSo,
        oran: totalSi > 0 ? (totalSo / totalSi) * 100 : 0,
        musteriSayisi: musSet.size, stokSayisi: stokSet.size,
      }
    })
  }, [filtSellin, filtSellout, activeYilAylar])

  // ── A7: Marka Karşılaştırması (ELX vs RELUX) ─────────────
  const markaKarsilastirma = useMemo(() => {
    const elxSI  = filtSellin.filter(r => r.kategori === 'EKEA').reduce((s, r) => s + r.adet, 0)
    const relxSI = filtSellin.filter(r => r.kategori === 'RELUX').reduce((s, r) => s + r.adet, 0)
    const elxSO  = filtSellout.filter(r => r.grup_kodu.toUpperCase() === 'EKEA').reduce((s, r) => s + r.satilan_adet, 0)
    const relxSO = filtSellout.filter(r => r.grup_kodu.toUpperCase() === 'RELUX').reduce((s, r) => s + r.satilan_adet, 0)
    const elxMus  = new Set(filtSellin.filter(r => r.kategori === 'EKEA').map(r => r.cariIsim)).size
    const relxMus = new Set(filtSellin.filter(r => r.kategori === 'RELUX').map(r => r.cariIsim)).size
    const elxStok  = new Set(filtSellin.filter(r => r.kategori === 'EKEA').map(r => r.stokKodu.toUpperCase())).size
    const relxStok = new Set(filtSellin.filter(r => r.kategori === 'RELUX').map(r => r.stokKodu.toUpperCase())).size
    return [
      { marka: 'Electrolux', key: 'EKEA',  sellin: elxSI,  sellout: elxSO,  oran: elxSI  > 0 ? (elxSO  / elxSI)  * 100 : 0, musteriSayisi: elxMus,  stokSayisi: elxStok,  color: '#003087' },
      { marka: 'Relux',      key: 'RELUX', sellin: relxSI, sellout: relxSO, oran: relxSI > 0 ? (relxSO / relxSI) * 100 : 0, musteriSayisi: relxMus, stokSayisi: relxStok, color: '#6b21a8' },
    ]
  }, [filtSellin, filtSellout])

  // ── A8: Çapraz Satış Fırsatı ──────────────────────────────
  // ELX alan ama RELUX almayan müşteriler ve tersi
  const caprazFirsat = useMemo(() => {
    const elxMus  = new Set(filtSellin.filter(r => r.kategori === 'EKEA').map(r => r.cariIsim))
    const relxMus = new Set(filtSellin.filter(r => r.kategori === 'RELUX').map(r => r.cariIsim))

    // Müşteri bazında BSY map
    const bsyMap = new Map<string, string>()
    filtSellin.forEach(r => bsyMap.set(r.cariIsim, r.bsyAdi))

    // Müşteri bazında toplam sellin
    const sellinMus = new Map<string, { elx: number; relux: number }>()
    filtSellin.forEach(r => {
      const cur = sellinMus.get(r.cariIsim) ?? { elx: 0, relux: 0 }
      if (r.kategori === 'EKEA')  cur.elx   += r.adet
      if (r.kategori === 'RELUX') cur.relux += r.adet
      sellinMus.set(r.cariIsim, cur)
    })

    const sadElx  = [...elxMus].filter(c => !relxMus.has(c))
      .map(c => ({ cariIsim: c, bsyAdi: bsyMap.get(c) ?? '', elxAdet: sellinMus.get(c)?.elx ?? 0, reluxAdet: 0 }))
      .sort((a, b) => b.elxAdet - a.elxAdet)
      .slice(0, 15)

    const sadRelx = [...relxMus].filter(c => !elxMus.has(c))
      .map(c => ({ cariIsim: c, bsyAdi: bsyMap.get(c) ?? '', elxAdet: 0, reluxAdet: sellinMus.get(c)?.relux ?? 0 }))
      .sort((a, b) => b.reluxAdet - a.reluxAdet)
      .slice(0, 15)

    return { sadElx, sadRelx }
  }, [filtSellin])

  // ── A9: En Değerli Açık Stok (donuk adet × olası sıklık) ─
  // "Satılmayı bekleyen" değer: müşteride bekleyen adet, aciliyet derecesi
  const topBekleyenler = useMemo(() =>
    cariStokMap
      .map(r => ({ ...r, bekleyen: r.sellin - r.sellout, oran: (r.sellout / r.sellin) * 100 }))
      .filter(r => r.bekleyen > 2)
      .sort((a, b) => b.bekleyen - a.bekleyen)
      .slice(0, 20),
    [cariStokMap])

  const isLoadingAny = loading || soLoading

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Üst bar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <BarChart2 size={14} className="text-brand-600" />
        <span className="text-xs font-bold text-gray-700">Satış Analizi</span>
        <span className="text-[10px] bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 font-semibold">
          Sellin: Tem 2025→ · Sellout: Oca 2026→
        </span>

        <button onClick={() => { loadSellin(); reloadSo() }} disabled={isLoadingAny}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50" title="Şimdi yenile">
          <RefreshCw size={14} className={isLoadingAny ? 'animate-spin' : ''} />
        </button>

        <div className="flex-1" />

        {lastUpdate && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock size={10} />
            Son güncelleme: {fmtTime(lastUpdate)}
            <span className="opacity-60">· 5dk'da bir otomatik yenilenir</span>
          </span>
        )}
        {!isLoadingAny && cariStokMap.length > 0 && (
          <span className="text-[10px] text-gray-400">{cariStokMap.length} kombinasyon</span>
        )}
      </div>

      {isLoadingAny && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin mr-2" /> Veriler analiz ediliyor…
        </div>
      )}

      {!isLoadingAny && cariStokMap.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          Seçili dönem için sellin/sellout verisi bulunamadı.
        </div>
      )}

      {!isLoadingAny && cariStokMap.length > 0 && (
        <div className="flex-1 overflow-auto p-4 space-y-5">

          {/* ── KPI Kartları ─────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Genel Sellout Oranı', value: pctStr(kpi.genel), sub: `${fmtNum(kpi.totalSellout)} / ${fmtNum(kpi.totalSellin)} adet`, color: kpi.genel >= 70 ? 'bg-green-600' : kpi.genel >= 50 ? 'bg-amber-500' : 'bg-red-600' },
              { label: 'Sipariş Beklenen', value: String(kpi.acil + kpi.yakin), sub: `${kpi.acil} acil · ${kpi.yakin} yakın kombinasyon`, color: 'bg-blue-600' },
              { label: 'Donuk Stok Riski', value: String(kpi.donuk), sub: '%25 altında satan kombinasyon', color: kpi.donuk > 10 ? 'bg-red-600' : 'bg-amber-500' },
              { label: 'Sağlıklı Müşteri', value: String(kpi.saglik), sub: '%70+ sellout oranıyla', color: 'bg-green-600' },
            ].map(k => (
              <div key={k.label} className={clsx('rounded-xl p-3 text-white', k.color)}>
                <p className="text-xl font-bold leading-tight">{k.value}</p>
                <p className="text-[10px] opacity-80 mt-0.5 font-semibold">{k.label}</p>
                <p className="text-[9px] opacity-60 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── A6: Aylık Trend ──────────────────────── */}
          {aylikTrend.length > 0 && (
            <Section icon={<TrendingUp size={14} />}
              title="Aylık Sellin → Sellout Trendi (Tem 2025 – Güncel)"
              subtitle="Aylara göre satışa verilen ve satılan adet karşılaştırması — sellout oranı düşen aylar dikkat gerektiriyor"
              color="teal">
              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2 font-semibold text-gray-500">Ay</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Sellin</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Sellout</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-500">Oran</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500 min-w-[160px]">İlerleme</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Müşteri</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Ürün</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aylikTrend.map((r, i) => (
                      <tr key={r.ay} className={clsx('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                        <td className="px-4 py-2 font-semibold text-gray-800">{r.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtNum(r.sellin)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtNum(r.sellout)}</td>
                        <td className="px-3 py-2 text-center">
                          <OranBadge oran={r.oran} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden min-w-[80px]">
                              <div className={clsx('h-2 rounded-full',
                                r.oran >= 80 ? 'bg-green-500' : r.oran >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                                style={{ width: `${Math.min(r.oran, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.musteriSayisi}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.stokSayisi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── A7: Marka Karşılaştırması ─────────────── */}
          <Section icon={<GitCompare size={14} />}
            title="Electrolux vs Relux Karşılaştırması"
            subtitle="İki markanın sellin/sellout performansı, müşteri ve ürün çeşitliliği"
            color="violet">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {markaKarsilastirma.map(m => (
                <div key={m.key} className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="text-sm font-bold text-gray-800">{m.marka}</span>
                    <span className={clsx('ml-auto text-xs font-bold',
                      m.oran >= 70 ? 'text-green-600' : m.oran >= 45 ? 'text-amber-600' : 'text-red-500')}>
                      {pctStr(m.oran)}
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full" style={{ width: `${Math.min(m.oran, 100)}%`, backgroundColor: m.color }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Sellin</p>
                      <p className="font-bold text-gray-800 text-sm">{fmtNum(m.sellin)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Sellout</p>
                      <p className="font-bold text-gray-800 text-sm">{fmtNum(m.sellout)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Müşteri</p>
                      <p className="font-bold text-gray-800 text-sm">{m.musteriSayisi}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Ürün Çeşidi</p>
                      <p className="font-bold text-gray-800 text-sm">{m.stokSayisi}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── A1: Sipariş Tahmini ───────────────────── */}
          <Section icon={<ShoppingCart size={14} />}
            title="Yeniden Sipariş Tahmini"
            subtitle="Sellout/Sellin ≥%50 ürünler, yüksekten düşüğe sıralı · 🔴 ≥%70 acil · 🔵 %50–69 yakın · max 10 ürün"
            color="blue" count={reorderList.length}>
            {reorderList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Bu dönem için uygun veri yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {reorderList.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-5 text-right flex-shrink-0 font-mono mt-0.5">{i+1}.</span>

                    {/* Müşteri adı */}
                    <div className="w-44 flex-shrink-0">
                      <p className="font-semibold text-gray-800 leading-tight">{r.cariIsim}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.bsyAdi.split(' ').slice(0,2).join(' ')}</p>
                    </div>

                    {/* Stok kodları + oranları */}
                    <div className="flex-1 flex flex-wrap gap-x-0 gap-y-1 items-center">
                      {r.urunler.map((s, si) => {
                        const acil = s.oran >= 70
                        return (
                          <span key={s.stokKodu} className="flex items-center">
                            {si > 0 && <span className="text-gray-300 mx-1.5 font-light select-none">—</span>}
                            <span className={clsx(
                              'font-mono font-semibold',
                              acil ? 'text-red-600' : 'text-blue-600'
                            )}>
                              {s.stokKodu}
                            </span>
                            <span className={clsx(
                              'ml-0.5 text-[10px]',
                              acil ? 'text-red-400 font-semibold' : 'text-gray-400'
                            )}>
                              ({Math.round(s.oran)}%)
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── A9: Müşteride Bekleyen Stok (adet bazlı) ─ */}
          <Section icon={<AlertTriangle size={14} />}
            title="Müşteride Bekleyen En Yüksek Stok (Adet)"
            subtitle="(Sellin − Sellout) farkı en yüksek kombinasyonlar — müşteride birikmiş stok takip listesi"
            color="orange" count={topBekleyenler.length}>
            {topBekleyenler.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Veri yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {topBekleyenler.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-5 text-right font-mono flex-shrink-0">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800 block truncate">{r.cariIsim}</span>
                      <span className="text-gray-400 text-[10px]">{r.stokKodu} — {r.stokAdi.slice(0,40)}</span>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <span className="block font-bold text-orange-600 tabular-nums">{fmtNum(r.bekleyen)} adet bekliyor</span>
                      <div className="text-[9px] text-gray-400 tabular-nums">↓{fmtNum(r.sellin)} ↑{fmtNum(r.sellout)} · <OranBadge oran={r.oran} /></div>
                    </div>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{r.bsyAdi.split(' ')[0]}</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1 flex-shrink-0">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── A2: Donuk Stok ───────────────────────── */}
          <Section icon={<AlertTriangle size={14} />}
            title="Hareketsiz / Donuk Stok Riski"
            subtitle="En az 3 adet sellin yapılmış ama sellout oranı %25'in altında kalan kombinasyonlar — müşteride stok birikmiş, iade riski"
            color="red" count={deadStockList.length}>
            {deadStockList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Bu dönem için uygun veri yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {deadStockList.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-5 text-right font-mono flex-shrink-0">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800 block truncate">{r.cariIsim}</span>
                      <span className="text-gray-400 text-[10px]">{r.stokKodu} — {r.stokAdi.slice(0,40)}</span>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <RiskBadge oran={r.oran} />
                      <div className="text-[9px] text-gray-400 tabular-nums">↓{fmtNum(r.sellin)} ↑{fmtNum(r.sellout)}</div>
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

          {/* ── A8: Çapraz Satış ─────────────────────── */}
          <Section icon={<Zap size={14} />}
            title="Çapraz Satış Fırsatı"
            subtitle="Yalnızca bir markadan alan müşteriler — diğer markayı da sunmak için fırsat"
            color="green">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {/* Sadece ELX alanlar */}
              <div className="p-3">
                <p className="text-[11px] font-bold text-blue-700 mb-2 px-1">
                  Electrolux aldı, Relux almadı ({caprazFirsat.sadElx.length})
                </p>
                {caprazFirsat.sadElx.length === 0 ? (
                  <p className="text-[10px] text-gray-400 px-1">Yok</p>
                ) : caprazFirsat.sadElx.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 px-1 py-1.5 border-b border-gray-50 text-xs last:border-0">
                    <span className="text-gray-400 w-4 text-right font-mono">{i+1}.</span>
                    <span className="flex-1 truncate text-gray-800 font-medium">{r.cariIsim}</span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 rounded px-1 flex-shrink-0">{fmtNum(r.elxAdet)} adet</span>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{r.bsyAdi.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
              {/* Sadece RELUX alanlar */}
              <div className="p-3">
                <p className="text-[11px] font-bold text-purple-700 mb-2 px-1">
                  Relux aldı, Electrolux almadı ({caprazFirsat.sadRelx.length})
                </p>
                {caprazFirsat.sadRelx.length === 0 ? (
                  <p className="text-[10px] text-gray-400 px-1">Yok</p>
                ) : caprazFirsat.sadRelx.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 px-1 py-1.5 border-b border-gray-50 text-xs last:border-0">
                    <span className="text-gray-400 w-4 text-right font-mono">{i+1}.</span>
                    <span className="flex-1 truncate text-gray-800 font-medium">{r.cariIsim}</span>
                    <span className="text-[10px] bg-purple-50 text-purple-600 rounded px-1 flex-shrink-0">{fmtNum(r.reluxAdet)} adet</span>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{r.bsyAdi.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── A3+A4: Ürün Hız Analizi ─────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section icon={<Zap size={14} />}
              title="En Hızlı Satan Ürünler"
              subtitle="Sellout/Sellin oranı en yüksek stoklar (min 5 sellin)"
              color="green">
              <div className="divide-y divide-gray-50">
                {fastMovers.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-4 text-right font-mono">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800">{r.stokKodu}</span>
                      <span className="text-[10px] text-gray-500 ml-1 truncate">{r.stokAdi.slice(0,28)}</span>
                    </div>
                    <OranBadge oran={r.oran} />
                    <span className="text-[9px] text-gray-400">{r.cariSayisi}m</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={<AlertTriangle size={14} />}
              title="En Yavaş Satan Ürünler"
              subtitle="Sellout/Sellin oranı en düşük stoklar (min 10 sellin)"
              color="amber">
              <div className="divide-y divide-gray-50">
                {slowMovers.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <span className="text-gray-400 w-4 text-right font-mono">{i+1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800">{r.stokKodu}</span>
                      <span className="text-[10px] text-gray-500 ml-1 truncate">{r.stokAdi.slice(0,28)}</span>
                    </div>
                    <RiskBadge oran={r.oran} />
                    <span className="text-[9px] text-gray-400">{r.cariSayisi}m</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1">{marka(r.kategori)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ── A5: Müşteri Sağlık ───────────────────── */}
          <Section icon={<Users size={14} />}
            title="Müşteri Sağlık Endeksi"
            subtitle="Müşteri bazında toplam sellout/sellin oranı — yüksek oran sağlıklı ilişki ve tekrar sipariş sinyali verir"
            color="violet">
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2 font-semibold text-gray-500 w-8">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Müşteri</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">BSY</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Sellin</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">Sellout</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-500">Oran</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-500">Ürün</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-500">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {customerHealth.map((r, i) => (
                    <tr key={r.cariIsim} className={clsx('border-b border-gray-50 hover:bg-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                      <td className="px-4 py-2 text-gray-400 font-mono">{i+1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800 max-w-[180px] truncate">{r.cariIsim}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.bsyAdi.split(' ').slice(0,2).join(' ')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtNum(r.sellin)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmtNum(r.sellout)}</td>
                      <td className="px-3 py-2 text-center"><OranBadge oran={r.oran} /></td>
                      <td className="px-3 py-2 text-center text-gray-500">{r.stokSayisi}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge oran={r.oran} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── A6 (BSY): Portföy ────────────────────── */}
          <Section icon={<TrendingUp size={14} />}
            title="BSY Portföy Performansı"
            subtitle="BSY bazında müşteri sellout sağlığı — hangi BSY'nin portföyü daha hızlı satıyor?"
            color="gray">
            <div className="divide-y divide-gray-50">
              {bsyPortfoy.map((r, i) => (
                <div key={r.bsyKod} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <span className="text-gray-400 font-mono text-xs w-5">{i+1}.</span>
                  <div className="w-32 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-800">{r.bsyAdi.split(' ').slice(0,2).join(' ')}</p>
                    <p className="text-[10px] text-gray-400">{r.cariSayisi} müş · {r.stokSayisi} ürün</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={clsx('h-2 rounded-full',
                          r.oran >= 70 ? 'bg-green-500' : r.oran >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                          style={{ width: `${Math.min(r.oran, 100)}%` }} />
                      </div>
                      <span className={clsx('text-xs font-bold tabular-nums w-14 text-right',
                        r.oran >= 70 ? 'text-green-600' : r.oran >= 40 ? 'text-amber-600' : 'text-red-500')}>
                        {pctStr(r.oran)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtNum(r.sellout)} / {fmtNum(r.sellin)} adet</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      )}
    </div>
  )
}
