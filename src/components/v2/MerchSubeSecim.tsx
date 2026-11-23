'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X, Check, Store, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { sadeAd } from '@/lib/v2/nokta'

interface SubeKisa { key: string; subeKod: string; cariAdi: string; subeAdi: string }
interface Secenekler {
  merch: { id: string; ad: string }
  kaynak: 'elle' | 'b2b'
  secili: string[]
  b2b: string[]
  oneri: string[]
  ustler: string[]
  tum: SubeKisa[]
}

/** Cari kısaltması: ilk kelime (2–3 harfse ikinci kelime de) */
export function cariKisa(cari: string): string {
  const w = cari.trim().split(/\s+/)
  return (w[0]?.length ?? 0) <= 3 && w[1] ? `${w[0]} ${w[1]}` : (w[0] ?? '')
}

export function subeEtiketi(s: { cariAdi: string; subeAdi: string }): string {
  const c = cariKisa(s.cariAdi)
  const sube = (s.subeAdi || '').trim()
  if (!sube) return c
  return sadeAd(sube).startsWith(sadeAd(c)) ? sube : `${c} ${sube}`
}

export function MerchSubeSecim({ merchId, gorunum, onClose, onKaydedildi }: {
  merchId: string
  gorunum: string
  onClose: () => void
  onKaydedildi: () => void
}) {
  const [veri, setVeri] = useState<Secenekler | null>(null)
  const [hata, setHata] = useState('')
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [arama, setArama] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    let iptal = false
    const qs = new URLSearchParams({ merch: merchId })
    if (gorunum) qs.set('gorunum', gorunum)
    fetch(`/api/v2/merch-sube?${qs}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Şubeler alınamadı')
        if (iptal) return
        setVeri(j as Secenekler)
        setSecili(new Set((j as Secenekler).secili))
      })
      .catch(e => { if (!iptal) setHata(e instanceof Error ? e.message : String(e)) })
    return () => { iptal = true }
  }, [merchId, gorunum])

  const byKey = useMemo(() => new Map((veri?.tum ?? []).map(s => [s.key, s])), [veri])
  const q = sadeAd(arama)
  const liste = useMemo(() => {
    if (!veri) return []
    const kaynak = q.length >= 2
      ? veri.tum.filter(s => sadeAd(`${s.cariAdi} ${s.subeAdi} ${s.subeKod}`).includes(q)).slice(0, 60)
      : veri.oneri.map(k => byKey.get(k)).filter((s): s is SubeKisa => !!s)
    return [...kaynak].sort((a, b) => subeEtiketi(a).localeCompare(subeEtiketi(b), 'tr'))
  }, [veri, q, byKey])

  const degistir = (k: string) => setSecili(s => {
    const y = new Set(s)
    if (y.has(k)) y.delete(k); else y.add(k)
    return y
  })

  const kaydet = async (keys: string[]) => {
    setKaydediliyor(true)
    setHata('')
    try {
      const qs = gorunum ? `?gorunum=${encodeURIComponent(gorunum)}` : ''
      const r = await fetch(`/api/v2/merch-sube${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merch_id: merchId, keys }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Kaydedilemedi')
      onKaydedildi()
      onClose()
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 space-y-2 border-b border-gray-100">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800">Görev şubeleri</h3>
              <p className="text-xs text-gray-500 truncate">{veri?.merch.ad ?? '…'}</p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          {veri && (
            <p className="text-[11px] text-gray-500">
              {veri.kaynak === 'elle' ? 'Şubeler elle seçilmiş.' : 'Şu an B2B merch kaydındaki şubeler geçerli.'}
              {veri.ustler.length > 0 && ` Öneriler: ${veri.ustler.join(', ')} şubeleri.`}
              {' '}Başka bir şube için arayın.
            </p>
          )}
          {secili.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...secili].map(k => {
                const s = byKey.get(k)
                return (
                  <button key={k} onClick={() => degistir(k)}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-800 hover:bg-brand-100">
                    {s ? subeEtiketi(s) : k}<X size={11} />
                  </button>
                )
              })}
            </div>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Tüm şubelerde ara (cari, şube, kod)…"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!veri && !hata && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {veri && liste.length === 0 && (
            <p className="px-5 py-6 text-center text-xs text-gray-400">
              {q.length >= 2 ? 'Eşleşen şube yok.' : 'Önerilecek şube bulunamadı — yukarıdan arayın.'}
            </p>
          )}
          <ul className="divide-y divide-gray-50">
            {liste.map(s => {
              const on = secili.has(s.key)
              return (
                <li key={s.key}>
                  <button onClick={() => degistir(s.key)}
                    className={clsx('w-full px-5 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50', on && 'bg-brand-50/50')}>
                    <span className={clsx('w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                      on ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300')}>
                      {on && <Check size={13} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 truncate">{subeEtiketi(s)}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{s.cariAdi}{s.subeKod ? ` · ${s.subeKod}` : ''}</span>
                    </span>
                    {veri?.b2b.includes(s.key) && <span className="text-[10px] rounded bg-gray-100 px-1.5 py-0.5 text-gray-500 shrink-0">B2B</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 space-y-2">
          {hata && <p className="text-xs text-red-600">{hata}</p>}
          <div className="flex gap-2">
            {veri?.kaynak === 'elle' && (
              <button onClick={() => kaydet([])} disabled={kaydediliyor} title="Elle seçimi kaldır, B2B merch kaydına dön"
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                <RotateCcw size={13} /> B2B&apos;ye dön
              </button>
            )}
            <button onClick={() => kaydet([...secili])} disabled={!veri || kaydediliyor || secili.size === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              <Store size={15} /> {kaydediliyor ? 'Kaydediliyor…' : `Kaydet (${secili.size} şube)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Sup / Jr: ekibimdeki merch'ler ve görev şubeleri */
export function EkipMerchleri({ gorunum, yenile, onDegisti }: { gorunum: string; yenile: number; onDegisti: () => void }) {
  const [merchler, setMerchler] = useState<{ id: string; ad: string; kaynak: 'elle' | 'b2b'; subeler: SubeKisa[] }[] | null>(null)
  const [hata, setHata] = useState('')
  const [secim, setSecim] = useState<string | null>(null)
  const [sayac, setSayac] = useState(0)

  useEffect(() => {
    let iptal = false
    const qs = gorunum ? `?gorunum=${encodeURIComponent(gorunum)}` : ''
    fetch(`/api/v2/merch-sube${qs}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Merch listesi alınamadı')
        if (!iptal) setMerchler(j.merchler)
      })
      .catch(e => { if (!iptal) setHata(e instanceof Error ? e.message : String(e)) })
    return () => { iptal = true }
  }, [gorunum, yenile, sayac])

  if (hata) return <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{hata}</p>
  if (!merchler || merchler.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 text-sm font-medium text-gray-700 flex items-center gap-2">
        <Store size={16} /> Ekibimdeki Çetinler Merch&apos;ler <span className="text-xs font-normal text-gray-400">({merchler.length})</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {merchler.map(m => (
          <li key={m.id} className="px-5 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{m.ad}</p>
              <p className="text-xs text-gray-500">
                {m.subeler.length ? m.subeler.map(subeEtiketi).join(' · ') : 'Şube yok'}
                {m.kaynak === 'elle' && <span className="ml-1 text-[10px] text-brand-700">(elle)</span>}
              </p>
            </div>
            <button onClick={() => setSecim(m.id)}
              className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50">Değiştir</button>
          </li>
        ))}
      </ul>
      {secim && (
        <MerchSubeSecim merchId={secim} gorunum={gorunum} onClose={() => setSecim(null)}
          onKaydedildi={() => { setSayac(s => s + 1); onDegisti() }} />
      )}
    </section>
  )
}
