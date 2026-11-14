'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Search, ChevronDown, ChevronRight, Check, FileText } from 'lucide-react'
import clsx from 'clsx'
import { supabase, type Task, type Profile } from '@/lib/supabase'
import { generateVisitReport } from '@/lib/pdf'
import { donemOptions, donemLabel, donemdeAktif } from '@/lib/sellout'
import { ziyaretHedefi } from '@/lib/ziyaretHedef'
import { sadeAd } from '@/lib/v2/nokta'
import { tl } from './types'
import type { AjandaKisi } from './AjandaView'
import { RAPOR_V1_BOLUMLERI, V1Cerceve, type Oturum } from './V1Ekranlar'

// v2 Raporlar — Ziyaret, Sellout, Tahsilat. Dashboard sekmesi v2'de yok;
// raporlar tek görünürlük kuralıyla (Şubelerim / hiyerarşi) burada.

type Bolum = 'ziyaret' | 'sellout' | 'tahsilat'

const BOLUMLER: { key: Bolum; label: string; roller: string[] }[] = [
  { key: 'ziyaret',  label: 'Ziyaret',  roller: ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr'] },
  { key: 'sellout',  label: 'Sellout',  roller: ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr', 'merch'] },
  { key: 'tahsilat', label: 'Tahsilat', roller: ['admin', 'ik', 'manager', 'bsy'] },
]

async function excelIndir(ad: string, satirlar: Record<string, string | number>[]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(satirlar)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rapor')
  XLSX.writeFile(wb, `${ad}.xlsx`)
}

function DonemSecici({ donem, onChange }: { donem: string; onChange: (d: string) => void }) {
  const secenekler = useMemo(() => donemOptions().slice().reverse(), [])
  return (
    <select value={donem} onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm">
      {secenekler.map(d => <option key={d} value={d}>{donemLabel(d)}</option>)}
    </select>
  )
}

const ExcelDugme = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled}
    className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40">
    <Download size={13} /> Excel
  </button>
)

// ─── Ziyaret raporu ───────────────────────────────────────────
function ZiyaretRaporu({ kisiler, team }: { kisiler: AjandaKisi[]; team: Profile[] }) {
  const [donem, setDonem] = useState(donemOptions().slice(-1)[0])
  const [gorevler, setGorevler] = useState<Task[] | null>(null)
  const [hata, setHata] = useState('')
  const [acik, setAcik] = useState<string | null>(null)

  useEffect(() => {
    let iptal = false
    setGorevler(null)
    setHata('')
    const [y, m] = donem.split('-').map(Number)
    const son = new Date(y, m, 0).getDate()
    supabase.from('tasks').select('*')
      .in('pid', kisiler.map(k => k.id))
      .gte('date', `${donem}-01`).lte('date', `${donem}-${String(son).padStart(2, '0')}`)
      .order('date').order('time', { nullsFirst: true })
      .then(({ data, error }) => {
        if (iptal) return
        if (error) setHata(error.message)
        else setGorevler((data ?? []) as Task[])
      })
    return () => { iptal = true }
  }, [kisiler, donem])

  const ozet = useMemo(() => kisiler
    .filter(k => donemdeAktif(k.ad, donem))
    .map(k => {
      const g = (gorevler ?? []).filter(t => t.pid === k.id)
      const checkin = g.filter(t => t.checkin_ts)
      return {
        kisi: k,
        gorev: g.length,
        checkin: checkin.length,
        nokta: new Set(checkin.map(t => t.customer).filter(Boolean)).size,
        hedef: ['sup', 'jr'].includes(k.rol) ? ziyaretHedefi(k.ad) : null,
        liste: checkin,
      }
    })
    .filter(o => o.gorev > 0 || o.hedef !== null)
    .sort((a, b) => b.checkin - a.checkin), [kisiler, gorevler, donem])

  const indir = () => excelIndir(`ziyaret-raporu-${donem}`,
    (gorevler ?? []).filter(t => t.checkin_ts).map(t => ({
      'Kişi': kisiler.find(k => k.id === t.pid)?.ad ?? '',
      'Tarih': t.date,
      'Saat': t.time?.slice(0, 5) ?? '',
      'Tür': t.type,
      'Cari / Şube': t.customer ?? '',
      'Check-in': t.checkin_ts ? new Date(t.checkin_ts).toLocaleString('tr-TR') : '',
      'Adres': t.checkin_address ?? '',
    })))

  // v1 ile aynı PDF ziyaret raporu
  const pdf = () => {
    const [y, m] = donem.split('-').map(Number)
    const idler = new Set(kisiler.map(k => k.id))
    generateVisitReport(gorevler ?? [], team.filter(p => idler.has(p.id)), y, m - 1)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-gray-800">Ziyaret raporu</h2>
        <DonemSecici donem={donem} onChange={setDonem} />
        <ExcelDugme onClick={indir} disabled={!gorevler?.some(t => t.checkin_ts)} />
        <button onClick={pdf} disabled={!gorevler?.length}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40">
          <FileText size={13} /> PDF
        </button>
      </div>
      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}
      {!gorevler && !hata && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}
      {gorevler && ozet.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Bu dönemde görev yok.</p>}
      <div className="space-y-2">
        {ozet.map(o => (
          <section key={o.kisi.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button onClick={() => setAcik(a => (a === o.kisi.id ? null : o.kisi.id))}
              className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50">
              {acik === o.kisi.id ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{o.kisi.ad}</span>
              <span className="text-xs tabular-nums text-gray-500">{o.gorev} görev · {o.nokta} nokta</span>
              <span className={clsx('text-sm font-semibold tabular-nums',
                o.hedef !== null ? (o.checkin >= o.hedef ? 'text-green-700' : 'text-gray-900') : 'text-gray-900')}>
                {o.checkin}{o.hedef !== null ? ` / ${o.hedef}` : ''}
              </span>
            </button>
            {acik === o.kisi.id && (
              <ul className="border-t border-gray-100 divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {o.liste.length === 0 && <li className="px-4 py-2 text-xs text-gray-400">Check-in yok.</li>}
                {o.liste.map(t => (
                  <li key={t.id} className="px-4 py-1.5 flex items-center gap-2 text-sm">
                    <Check size={12} className="text-green-600 shrink-0" />
                    <span className="w-20 shrink-0 text-xs tabular-nums text-gray-500">{t.date.slice(8)}.{t.date.slice(5, 7)} {t.time?.slice(0, 5) ?? ''}</span>
                    <span className="flex-1 min-w-0 truncate text-gray-700">{t.customer || t.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

// ─── Sellout raporu ───────────────────────────────────────────
interface SelloutYanit {
  donem: string
  kategoriler: string[]
  kategoriToplam: Record<string, number>
  genelToplam: number
  subeler: { cariAdi: string; subeAdi: string; adetler: Record<string, number>; toplam: number }[]
}

function SelloutRaporu({ gorunum }: { gorunum: string }) {
  const [donem, setDonem] = useState(donemOptions().slice(-1)[0])
  const [veri, setVeri] = useState<SelloutYanit | null>(null)
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [arama, setArama] = useState('')

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    try {
      const qs = new URLSearchParams({ donem })
      if (gorunum) qs.set('gorunum', gorunum)
      const r = await fetch(`/api/v2/rapor/sellout?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Veri alınamadı')
      setVeri(j as SelloutYanit)
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [donem, gorunum])
  useEffect(() => { yukle() }, [yukle])

  const kategoriler = (veri?.kategoriler ?? []).filter(k => (veri?.kategoriToplam[k] ?? 0) > 0)
  const liste = useMemo(() => {
    const q = sadeAd(arama)
    return (veri?.subeler ?? []).filter(s => !q || sadeAd(`${s.cariAdi} ${s.subeAdi}`).includes(q))
  }, [veri, arama])

  const indir = () => excelIndir(`sellout-${donem}`, (veri?.subeler ?? []).map(s => ({
    'Cari': s.cariAdi, 'Şube': s.subeAdi,
    ...Object.fromEntries(kategoriler.map(k => [k, s.adetler[k] ?? 0])),
    'Toplam': s.toplam,
  })))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-gray-800">Sellout</h2>
        <DonemSecici donem={donem} onChange={setDonem} />
        <ExcelDugme onClick={indir} disabled={!veri?.subeler.length} />
      </div>
      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}
      {!veri && yukleniyor && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}
      {veri && (
        <div className={clsx('space-y-3', yukleniyor && 'opacity-60')}>
          <div className="rounded-xl bg-brand-700 px-4 py-3 text-white flex items-center justify-between">
            <span className="text-sm">Toplam satış adedi</span>
            <span className="text-lg font-semibold tabular-nums">{veri.genelToplam.toLocaleString('tr-TR')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kategoriler.map(k => (
              <div key={k} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                <p className="text-[11px] text-gray-500 truncate">{k}</p>
                <p className="text-base font-semibold tabular-nums text-gray-900">{(veri.kategoriToplam[k] ?? 0).toLocaleString('tr-TR')}</p>
              </div>
            ))}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Cari, şube ara…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium">Şube</th>
                  {kategoriler.map(k => <th key={k} className="px-2 py-2 text-right font-medium whitespace-nowrap">{k.replace(' Grubu', '')}</th>)}
                  <th className="px-3 py-2 text-right font-medium">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {liste.slice(0, 300).map(s => (
                  <tr key={`${s.cariAdi}|${s.subeAdi}`}>
                    <td className="sticky left-0 bg-white px-3 py-1.5 max-w-[180px]">
                      <span className="block truncate text-gray-800">{s.subeAdi || '—'}</span>
                      <span className="block truncate text-[10px] text-gray-400">{s.cariAdi}</span>
                    </td>
                    {kategoriler.map(k => <td key={k} className="px-2 py-1.5 text-right tabular-nums">{s.adetler[k] || ''}</td>)}
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{s.toplam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {liste.length > 300 && <p className="px-3 py-2 text-[11px] text-gray-400">İlk 300 şube gösteriliyor; tamamı Excel'de.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tahsilat raporu ──────────────────────────────────────────
interface TahsilatYanit {
  donem: string
  rows: { bsyAdi: string; acikHesap: number; hedef: number; gerceklesen: number; oran: number }[]
  detay: { bsyAdi: string; cariIsim: string; tur: string; acikHesap: number; gerceklesen: number }[]
}

function TahsilatRaporu({ gorunum }: { gorunum: string }) {
  const [donem, setDonem] = useState(donemOptions().slice(-1)[0])
  const [veri, setVeri] = useState<TahsilatYanit | null>(null)
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [acik, setAcik] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    try {
      const qs = new URLSearchParams({ donem })
      if (gorunum) qs.set('gorunum', gorunum)
      const r = await fetch(`/api/v2/rapor/tahsilat?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Veri alınamadı')
      setVeri(j as TahsilatYanit)
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [donem, gorunum])
  useEffect(() => { yukle() }, [yukle])

  const toplam = (veri?.rows ?? []).reduce((t, r) => ({
    acik: t.acik + r.acikHesap, hedef: t.hedef + r.hedef, gerc: t.gerc + r.gerceklesen,
  }), { acik: 0, hedef: 0, gerc: 0 })

  const indir = () => excelIndir(`tahsilat-${donem}`, (veri?.detay ?? []).map(d => ({
    'BSY': d.bsyAdi, 'Cari': d.cariIsim, 'Tür': d.tur, 'Açık hesap': d.acikHesap, 'Gerçekleşen': d.gerceklesen,
  })))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-gray-800">Tahsilat</h2>
        <DonemSecici donem={donem} onChange={setDonem} />
        <ExcelDugme onClick={indir} disabled={!veri?.detay.length} />
      </div>
      <p className="text-xs text-gray-500">Hedef = açık hesabın %90&apos;ı. Kaynak: SAHA.xlsx (Ciro ve Tahsilat Takip ile aynı).</p>
      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}
      {!veri && yukleniyor && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}
      {veri && veri.rows.length === 0 && !yukleniyor && <p className="py-8 text-center text-sm text-gray-400">Bu dönemde tahsilat verisi yok.</p>}
      <div className={clsx('space-y-2', yukleniyor && 'opacity-60')}>
        {veri?.rows.map(r => {
          const detay = veri.detay.filter(d => d.bsyAdi === r.bsyAdi).sort((a, b) => b.gerceklesen - a.gerceklesen)
          const isAcik = acik === r.bsyAdi
          return (
            <section key={r.bsyAdi} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button onClick={() => setAcik(a => (a === r.bsyAdi ? null : r.bsyAdi))}
                className="w-full px-4 py-2.5 text-left hover:bg-gray-50 space-y-1.5">
                <div className="flex items-center gap-2">
                  {isAcik ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                  <span className="flex-1 text-sm font-medium text-gray-800">{r.bsyAdi}</span>
                  <span className={clsx('text-sm font-semibold tabular-nums', r.oran >= 100 ? 'text-green-700' : 'text-gray-900')}>%{Math.round(r.oran)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={clsx('h-full rounded-full', r.oran >= 100 ? 'bg-green-500' : 'bg-brand-500')} style={{ width: `${Math.min(r.oran, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 tabular-nums">
                  <span>Gerçekleşen {tl(r.gerceklesen)}</span>
                  <span>Hedef {tl(r.hedef)}</span>
                </div>
              </button>
              {isAcik && (
                <ul className="border-t border-gray-100 divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {detay.map(d => (
                    <li key={`${d.cariIsim}|${d.tur}`} className="px-4 py-1.5 flex items-center gap-2 text-xs">
                      <span className="flex-1 min-w-0 truncate text-gray-700">{d.cariIsim}{d.tur ? ` · ${d.tur}` : ''}</span>
                      <span className="tabular-nums text-gray-900">{tl(d.gerceklesen)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
        {veri && veri.rows.length > 1 && (
          <div className="flex items-center justify-between rounded-xl bg-brand-700 px-4 py-3 text-white text-sm">
            <span>Toplam · %{toplam.hedef > 0 ? Math.round((toplam.gerc / toplam.hedef) * 100) : 0}</span>
            <span className="font-semibold tabular-nums">{tl(toplam.gerc)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Raporlar sekmesi ─────────────────────────────────────────
export function RaporlarView({ rol, gorunum, kisiler, oturum }: {
  rol: string; gorunum: string; kisiler: AjandaKisi[]; oturum: Oturum
}) {
  const bolumler = useMemo(() => [
    ...BOLUMLER.filter(b => b.roller.includes(rol)).map(b => ({ key: b.key as string, label: b.label })),
    ...RAPOR_V1_BOLUMLERI.filter(b => b.roller.includes(oturum.profile.role)).map(b => ({ key: b.key, label: b.label })),
  ], [rol, oturum.profile.role])
  const [bolum, setBolum] = useState<string>(bolumler[0]?.key ?? 'sellout')
  const v1 = RAPOR_V1_BOLUMLERI.find(b => b.key === bolum)

  return (
    <div className="space-y-4">
      {bolumler.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 max-w-3xl mx-auto">
          {bolumler.map(b => (
            <button key={b.key} onClick={() => setBolum(b.key)}
              className={clsx('shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap',
                bolum === b.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}>
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        {bolum === 'ziyaret' && <ZiyaretRaporu kisiler={kisiler} team={oturum.team} />}
        {bolum === 'sellout' && <SelloutRaporu gorunum={gorunum} />}
        {bolum === 'tahsilat' && <TahsilatRaporu gorunum={gorunum} />}
      </div>
      {v1 && <V1Cerceve>{v1.render(oturum)}</V1Cerceve>}
    </div>
  )
}
