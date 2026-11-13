'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Pencil, Save, X, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { MONTHS_TR } from '@/lib/constants'
import type { BsyAdetSatir, BsyAdetKategori, BsyAdetParams, BsyAdetDurum } from '@/lib/v2/bsyAdetPrim'
import { tl } from './types'

interface BsySonuc {
  profileId: string
  ad: string
  kod: string
  satirlar: BsyAdetSatir[]
  toplamPrim: number
  toplamAnaPrim: number
}

interface Yanit {
  donem: string
  durum: BsyAdetDurum
  params: BsyAdetParams
  kategoriler: BsyAdetKategori[]
  bsylar: BsySonuc[]
  hedefGirebilir: boolean
}

/** Simülasyonun başladığı Kasım 2026'dan bu aya (ve sonraki aya) kadar */
function donemSecenekleri(): string[] {
  const out: string[] = []
  const d = new Date()
  const son = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  for (let t = new Date(2026, 10, 1); t <= son; t = new Date(t.getFullYear(), t.getMonth() + 1, 1)) {
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
  }
  return out.reverse()
}

function donemAdi(d: string) {
  const [y, m] = d.split('-').map(Number)
  return `${MONTHS_TR[m - 1]} ${y}`
}

const yuzde = (o: number | null) => (o === null ? '—' : `%${Math.round(o * 100)}`)

function oranRengi(o: number | null, p: BsyAdetParams) {
  if (o === null) return 'text-gray-400'
  if (o >= p.tamEsik) return 'text-green-700'
  if (o >= p.altEsik) return 'text-amber-700'
  return 'text-red-600'
}

export function BsyAdetPrimView({ gorunum }: { gorunum: string }) {
  const secenekler = useMemo(donemSecenekleri, [])
  const buAy = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const [donem, setDonem] = useState(secenekler.includes(buAy) ? buAy : secenekler[secenekler.length - 1])
  const [veri, setVeri] = useState<Yanit | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [duzenle, setDuzenle] = useState(false)
  const [taslak, setTaslak] = useState<Record<string, string>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [acik, setAcik] = useState<Set<string>>(new Set())

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    try {
      const qs = new URLSearchParams({ donem })
      if (gorunum) qs.set('gorunum', gorunum)
      const r = await fetch(`/api/v2/bsy-adet?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Veri alınamadı')
      setVeri(j as Yanit)
      if ((j as Yanit).bsylar.length === 1) setAcik(new Set([(j as Yanit).bsylar[0].profileId]))
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [donem, gorunum])

  useEffect(() => { yukle(); setDuzenle(false) }, [yukle])

  const duzenlemeyiAc = () => {
    if (!veri) return
    const t: Record<string, string> = {}
    for (const b of veri.bsylar) for (const s of b.satirlar) t[`${b.profileId}|${s.grup}`] = s.hedef ? String(s.hedef) : ''
    setTaslak(t)
    setAcik(new Set(veri.bsylar.map(b => b.profileId)))
    setDuzenle(true)
  }

  const kaydet = async () => {
    if (!veri) return
    setKaydediliyor(true)
    try {
      const hedefler = Object.entries(taslak).map(([k, v]) => {
        const [profile_id, grup] = k.split('|')
        return { profile_id, grup, hedef: Number(v.replace(/\D/g, '')) || 0 }
      })
      const r = await fetch('/api/v2/bsy-adet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donem, hedefler }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Kaydedilemedi')
      setDuzenle(false)
      await yukle()
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setKaydediliyor(false)
    }
  }

  const genelToplam = veri?.bsylar.reduce((t, b) => t + b.toplamPrim, 0) ?? 0
  const toggle = (id: string) => setAcik(s => { const y = new Set(s); if (y.has(id)) y.delete(id); else y.add(id); return y })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-800 flex-1">BSY Adet Primi</h2>
        <select value={donem} onChange={e => setDonem(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm">
          {secenekler.map(d => <option key={d} value={d}>{donemAdi(d)}</option>)}
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

      {veri?.durum === 'simulasyon' && (
        <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800">
          <FlaskConical size={14} className="shrink-0 mt-0.5" />
          <span>Simülasyon: ciro primi bu ay aynen devam ediyor. Bu tablo ödemeye yansımaz; 2027 Ocak&apos;ta adet primi devreye girer.</span>
        </div>
      )}
      {veri && (
        <p className="text-xs text-gray-500">
          Barem: %{Math.round(veri.params.altEsik * 100)} altı 0 ₺ · %{Math.round(veri.params.altEsik * 100)}–{Math.round(veri.params.tamEsik * 100)} arası (ana prim / 2) × oran · %{Math.round(veri.params.tamEsik * 100)} ve üstü ana prim.
          Gerçekleşme: BSY&apos;nin carilerine bağlı şubelerin satış adedi.
        </p>
      )}

      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}
      {yukleniyor && !veri && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}

      {veri && veri.bsylar.length === 0 && !yukleniyor && (
        <p className="py-8 text-center text-sm text-gray-400">Bu görünümde adet primi hesaplanan BSY yok.</p>
      )}

      <div className={clsx('space-y-2', yukleniyor && 'opacity-60')}>
        {veri?.bsylar.map(b => {
          const isAcik = acik.has(b.profileId)
          return (
            <section key={b.profileId} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button onClick={() => toggle(b.profileId)} className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-gray-50">
                {isAcik ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800">{b.ad}</span>
                  <span className="block text-[11px] text-gray-400">{b.kod}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-gray-900">{tl(b.toplamPrim)}</span>
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
                      {b.satirlar.map(s => {
                        const key = `${b.profileId}|${s.grup}`
                        return (
                          <tr key={s.grup}>
                            <td className="px-4 py-2">
                              <span className="block text-gray-800">{s.etiket}</span>
                              <span className="block text-[11px] text-gray-400">Ana prim {tl(s.anaPrim)}</span>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {duzenle ? (
                                <input inputMode="numeric" value={taslak[key] ?? ''}
                                  onChange={e => setTaslak(t => ({ ...t, [key]: e.target.value.replace(/\D/g, '') }))}
                                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm" />
                              ) : (s.hedef || '—')}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{s.gerc}</td>
                            <td className={clsx('px-2 py-2 text-right tabular-nums font-medium', oranRengi(s.oran, veri.params))}>{yuzde(s.oran)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{s.prim ? tl(s.prim) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 text-sm font-medium">
                      <tr>
                        <td className="px-4 py-2" colSpan={4}>Toplam (azami {tl(b.toplamAnaPrim)})</td>
                        <td className="px-4 py-2 text-right tabular-nums">{tl(b.toplamPrim)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {veri && veri.bsylar.length > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-brand-700 px-4 py-3 text-white">
          <span className="text-sm">Genel toplam ({veri.bsylar.length} BSY)</span>
          <span className="font-semibold tabular-nums">{tl(genelToplam)}</span>
        </div>
      )}
    </div>
  )
}
