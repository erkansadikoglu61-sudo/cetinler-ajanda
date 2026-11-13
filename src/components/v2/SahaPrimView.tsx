'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Store } from 'lucide-react'
import clsx from 'clsx'
import { donemOptions, donemLabel } from '@/lib/sellout'
import { sadeAd } from '@/lib/v2/nokta'
import { tl } from './types'

interface SahaKisi { ad: string; hakedis: number; adet?: number }
interface SahaSube { key: string; cariAdi: string; subeAdi: string; bayiMerch: SahaKisi[]; destek: SahaKisi[]; toplam: number }
interface Yanit { donem: string; subeler: SahaSube[]; ozet: { bayiMerch: number; destek: number; kisi: number } }

export function SahaPrimView({ gorunum }: { gorunum: string }) {
  const secenekler = useMemo(() => donemOptions().slice().reverse(), [])
  const [donem, setDonem] = useState(secenekler[0])
  const [veri, setVeri] = useState<Yanit | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [arama, setArama] = useState('')

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    try {
      const qs = new URLSearchParams({ donem })
      if (gorunum) qs.set('gorunum', gorunum)
      const r = await fetch(`/api/v2/saha-prim?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Veri alınamadı')
      setVeri(j as Yanit)
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [donem, gorunum])

  useEffect(() => { yukle() }, [yukle])

  const liste = useMemo(() => {
    const q = sadeAd(arama)
    return (veri?.subeler ?? []).filter(s => !q || sadeAd([
      s.cariAdi, s.subeAdi, ...s.bayiMerch.map(k => k.ad), ...s.destek.map(k => k.ad),
    ].join(' ')).includes(q))
  }, [veri, arama])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-800 flex-1">Bayi Merch · Destek</h2>
        <select value={donem} onChange={e => setDonem(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm">
          {secenekler.map(d => <option key={d} value={d}>{donemLabel(d)}</option>)}
        </select>
      </div>

      {veri && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Bayi Merch</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">{tl(veri.ozet.bayiMerch)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Destek</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">{tl(veri.ozet.destek)}</p>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Bayi Merch: satış adedi × ürün prim oranı (özel kurallar dahil). Destek: Destek Personelleri Hakediş ekranında kaydedilen tutarlar.
      </p>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Cari, şube, kişi ara…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
      </div>

      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}
      {yukleniyor && !veri && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}
      {veri && liste.length === 0 && !yukleniyor && (
        <p className="py-8 text-center text-sm text-gray-400">Bu dönemde hakediş yok.</p>
      )}

      <div className={clsx('space-y-2', yukleniyor && 'opacity-60')}>
        {liste.map(s => (
          <section key={s.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-50">
              <Store size={14} className="text-brand-600 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{s.subeAdi || '—'}</span>
                <span className="block text-[11px] text-gray-400 truncate">{s.cariAdi}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{tl(s.toplam)}</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {s.bayiMerch.map(k => (
                <li key={`b-${k.ad}`} className="px-4 py-1.5 flex items-center gap-2 text-sm">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">Bayi</span>
                  <span className="flex-1 truncate text-gray-700">{k.ad}</span>
                  {k.adet !== undefined && <span className="text-xs text-gray-400 tabular-nums">{k.adet} adet</span>}
                  <span className="tabular-nums text-gray-900">{tl(k.hakedis)}</span>
                </li>
              ))}
              {s.destek.map(k => (
                <li key={`d-${k.ad}`} className="px-4 py-1.5 flex items-center gap-2 text-sm">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">Destek</span>
                  <span className="flex-1 truncate text-gray-700">{k.ad}</span>
                  <span className="tabular-nums text-gray-900">{tl(k.hakedis)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
