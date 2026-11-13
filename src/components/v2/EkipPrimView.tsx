'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Save, X, ChevronDown, ChevronRight, Search } from 'lucide-react'
import clsx from 'clsx'
import { donemOptions, donemLabel, PRIM_ESIGI } from '@/lib/sellout'
import { sadeAd } from '@/lib/v2/nokta'
import { tl } from './types'

interface Kategori { grup: string; hedef: number; gerc: number; prim: number; kategoriPrimi: number; oran: number | null }
interface Kisi {
  key: string
  tip: 'Süpervizör' | 'Jr. Süpervizör' | 'Çetinler Merch'
  ad: string
  profileId: string | null
  ownerSupAd: string | null
  ownerJrAd: string | null
  prim: number
  kategoriler: Kategori[]
}
interface Yanit { donem: string; gruplar: string[]; kisiler: Kisi[]; hedefGirebilir: boolean }

const TIPLER: Kisi['tip'][] = ['Süpervizör', 'Jr. Süpervizör', 'Çetinler Merch']
const yuzde = (o: number | null) => (o === null ? '—' : `%${Math.round(o * 100)}`)

export function EkipPrimView({ gorunum }: { gorunum: string }) {
  const secenekler = useMemo(() => donemOptions().slice().reverse(), [])
  const [donem, setDonem] = useState(secenekler[0])
  const [veri, setVeri] = useState<Yanit | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [arama, setArama] = useState('')
  const [acik, setAcik] = useState<Set<string>>(new Set())
  const [duzenle, setDuzenle] = useState(false)
  const [taslak, setTaslak] = useState<Record<string, string>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    try {
      const qs = new URLSearchParams({ donem })
      if (gorunum) qs.set('gorunum', gorunum)
      const r = await fetch(`/api/v2/ekip-prim?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Veri alınamadı')
      setVeri(j as Yanit)
      if ((j as Yanit).kisiler.length === 1) setAcik(new Set([(j as Yanit).kisiler[0].key]))
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [donem, gorunum])

  useEffect(() => { yukle(); setDuzenle(false) }, [yukle])

  const filtreli = useMemo(() => {
    const q = sadeAd(arama)
    return (veri?.kisiler ?? []).filter(k => !q || sadeAd(`${k.ad} ${k.ownerSupAd ?? ''} ${k.ownerJrAd ?? ''}`).includes(q))
  }, [veri, arama])

  const duzenlemeyiAc = () => {
    const t: Record<string, string> = {}
    for (const k of filtreli) for (const c of k.kategoriler) t[`${k.key}|${c.grup}`] = c.hedef ? String(c.hedef) : ''
    setTaslak(t)
    setDuzenle(true)
  }

  const kaydet = async () => {
    if (!veri) return
    setKaydediliyor(true)
    setHata('')
    try {
      const profil: { profile_id: string; grup: string; hedef: number }[] = []
      const merch: { merch_name: string; grup: string; hedef: number }[] = []
      for (const k of veri.kisiler) {
        for (const c of k.kategoriler) {
          const v = taslak[`${k.key}|${c.grup}`]
          if (v === undefined) continue
          const hedef = Number(v) || 0
          if (hedef === c.hedef) continue   // yalnızca değişenler
          if (k.profileId) profil.push({ profile_id: k.profileId, grup: c.grup, hedef })
          else merch.push({ merch_name: k.ad, grup: c.grup, hedef })
        }
      }
      if (profil.length || merch.length) {
        const r = await fetch('/api/v2/ekip-prim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ donem, profil, merch }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Kaydedilemedi')
      }
      setDuzenle(false)
      await yukle()
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setKaydediliyor(false)
    }
  }

  const toggle = (k: string) => setAcik(s => { const y = new Set(s); if (y.has(k)) y.delete(k); else y.add(k); return y })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-800 flex-1">Süpervizör · Jr · Çetinler Merch</h2>
        <select value={donem} onChange={e => setDonem(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm">
          {secenekler.map(d => <option key={d} value={d}>{donemLabel(d)}</option>)}
        </select>
        {veri?.hedefGirebilir && !duzenle && (
          <button onClick={duzenlemeyiAc} className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-sm text-white">
            <Pencil size={14} /> Hedef gir
          </button>
        )}
        {duzenle && (
          <>
            <button onClick={() => setDuzenle(false)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><X size={16} /></button>
            <button onClick={kaydet} disabled={kaydediliyor}
              className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-sm text-white disabled:opacity-50">
              <Save size={14} /> {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Kategori primi × gerçekleşme oranı (en fazla %100); oran %{Math.round(PRIM_ESIGI * 100)} altındaysa 0 ₺. Rakamlar v1 Sellout ve Nihai Prim ile aynı hesaptan gelir.
      </p>

      {(veri?.kisiler.length ?? 0) > 6 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Kişi ara…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
        </div>
      )}

      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}
      {yukleniyor && !veri && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}
      {veri && filtreli.length === 0 && !yukleniyor && (
        <p className="py-8 text-center text-sm text-gray-400">Bu görünümde kişi yok.</p>
      )}

      <div className={clsx('space-y-4', yukleniyor && 'opacity-60')}>
        {TIPLER.map(tip => {
          const kisiler = filtreli.filter(k => k.tip === tip)
          if (kisiler.length === 0) return null
          const toplam = kisiler.reduce((t, k) => t + k.prim, 0)
          return (
            <section key={tip} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{tip} ({kisiler.length})</h3>
                <span className="text-xs tabular-nums text-gray-500">{tl(toplam)}</span>
              </div>
              {kisiler.map(k => {
                const isAcik = duzenle || acik.has(k.key)
                const ust = k.tip === 'Çetinler Merch' ? (k.ownerJrAd || k.ownerSupAd) : k.tip === 'Jr. Süpervizör' ? k.ownerSupAd : null
                return (
                  <div key={k.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <button onClick={() => toggle(k.key)} className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50">
                      {isAcik ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-800 truncate">{k.ad}</span>
                        {ust && <span className="block text-[11px] text-gray-400 truncate">{ust}</span>}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900">{tl(k.prim)}</span>
                    </button>
                    {isAcik && (
                      <div className="border-t border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Kategori</th>
                              <th className="px-2 py-2 text-right font-medium">Hedef</th>
                              <th className="px-2 py-2 text-right font-medium">Gerç.</th>
                              <th className="px-2 py-2 text-right font-medium">Oran</th>
                              <th className="px-4 py-2 text-right font-medium">Prim</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {k.kategoriler.map(c => {
                              const tk = `${k.key}|${c.grup}`
                              return (
                                <tr key={c.grup}>
                                  <td className="px-4 py-1.5">
                                    <span className="block text-gray-800">{c.grup}</span>
                                    <span className="block text-[11px] text-gray-400">Kategori primi {tl(c.kategoriPrimi)}</span>
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {duzenle ? (
                                      <input inputMode="numeric" value={taslak[tk] ?? ''}
                                        onChange={e => setTaslak(t => ({ ...t, [tk]: e.target.value.replace(/\D/g, '') }))}
                                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm" />
                                    ) : (c.hedef || '—')}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{c.gerc}</td>
                                  <td className={clsx('px-2 py-1.5 text-right tabular-nums font-medium',
                                    c.oran === null ? 'text-gray-400' : c.oran >= PRIM_ESIGI ? 'text-green-700' : 'text-red-600')}>
                                    {yuzde(c.oran)}
                                  </td>
                                  <td className="px-4 py-1.5 text-right tabular-nums">{c.prim ? tl(c.prim) : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}
