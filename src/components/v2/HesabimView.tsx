'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Store, Building2, Users, ChevronRight, Wallet, Clock, CheckCircle2, FlaskConical } from 'lucide-react'
import clsx from 'clsx'
import { MONTHS_TR } from '@/lib/constants'
import { V2Veri, V2Hesabim, V2_ROL_ADI, ibanBicimle, tl } from './types'

interface Props {
  veri: V2Veri
  gorunum: string
  onSubelerim: () => void
}

function tarihTr(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

export function HesabimView({ veri, gorunum, onSubelerim }: Props) {
  const k = veri.kullanici
  const [kopyalandi, setKopyalandi] = useState(false)
  const [hesap, setHesap] = useState<V2Hesabim | null>(null)
  const [hesapHata, setHesapHata] = useState('')

  useEffect(() => {
    let iptal = false
    setHesap(null)
    setHesapHata('')
    const qs = gorunum ? `?gorunum=${encodeURIComponent(gorunum)}` : ''
    fetch(`/api/v2/hesabim${qs}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Hakediş alınamadı')
        if (!iptal) setHesap(j as V2Hesabim)
      })
      .catch(e => { if (!iptal) setHesapHata(e instanceof Error ? e.message : String(e)) })
    return () => { iptal = true }
  }, [gorunum])

  const buAy = hesap?.aylar[0]

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(k.iban.replace(/\s/g, ''))
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1500)
    } catch { /* pano izni yok */ }
  }

  // Görünen ilk birkaç şube (kendi şubeleri önce)
  const ilkSubeler = [...veri.noktalar]
    .sort((a, b) => (a.kapsam === b.kapsam ? 0 : a.kapsam === 'kendi' ? -1 : 1))
    .slice(0, 4)

  return (
    <div className="space-y-4">
      {/* Kimlik kartı */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-white/60">{V2_ROL_ADI[k.rol] ?? k.rol}</p>
            <h2 className="text-xl font-semibold truncate">{k.ad}</h2>
            {k.ust && <p className="text-sm text-white/70 mt-0.5">Bağlı olduğu: {k.ust}</p>}
          </div>
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-sm font-semibold shrink-0">
            {k.ad.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-white/60">IBAN</p>
          {k.iban ? (
            <button onClick={kopyala} className="mt-0.5 flex items-center gap-2 font-mono text-sm tracking-wide hover:text-white/90">
              {ibanBicimle(k.iban)}
              {kopyalandi ? <Check size={14} /> : <Copy size={14} className="text-white/60" />}
            </button>
          ) : (
            <p className="mt-0.5 text-sm text-white/70">B2B'de kayıtlı IBAN bulunamadı</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/10 py-2">
            <p className="text-lg font-semibold">{veri.ozet.cari}</p>
            <p className="text-[11px] text-white/70">Cari</p>
          </div>
          <div className="rounded-xl bg-white/10 py-2">
            <p className="text-lg font-semibold">{veri.ozet.nokta}</p>
            <p className="text-[11px] text-white/70">Şube</p>
          </div>
          <div className="rounded-xl bg-white/10 py-2">
            <p className="text-lg font-semibold">{k.altlar.length}</p>
            <p className="text-[11px] text-white/70">Ekip</p>
          </div>
        </div>
      </section>

      {/* Bakiye kartı */}
      {hesap?.tip !== null && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Wallet size={16} />
            {buAy ? `${MONTHS_TR[buAy.ay - 1]} ${buAy.yil} hakedişi` : 'Bu ayın hakedişi'}
          </div>
          {!hesap && !hesapHata && <div className="mt-3 h-9 w-40 rounded-lg bg-gray-100 animate-pulse" />}
          {hesapHata && <p className="mt-2 text-sm text-red-600">{hesapHata}</p>}
          {buAy && (
            <>
              <p className="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">{tl(buAy.toplam)}</p>
              <p className="mt-1 text-xs text-gray-400">Ay sonuna kadar satışlarla birlikte güncellenir.</p>
              {buAy.ekPrim > 0 && <p className="mt-1 text-xs text-gray-500">Ek prim dahil: {tl(buAy.ekPrim)}</p>}
              {buAy.adetSimulasyon !== null && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800">
                  <FlaskConical size={14} className="shrink-0" />
                  <span>Adet primi simülasyonu: <b className="tabular-nums">{tl(buAy.adetSimulasyon)}</b> — ödemeye yansımaz (2027 Ocak&apos;ta devreye girer).</span>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Son 3 ay */}
      {hesap?.tip !== null && (
        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-sm font-medium text-gray-700">Prim geçmişi</div>
          {!hesap && !hesapHata && <div className="px-5 py-4"><div className="h-4 w-full rounded bg-gray-100 animate-pulse" /></div>}
          <ul className="divide-y divide-gray-100">
            {(hesap?.aylar ?? []).slice(1).map(a => (
              <li key={a.donem} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">{MONTHS_TR[a.ay - 1]} {a.yil}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums font-medium text-gray-900">{tl(a.toplam)}</span>
                  <span className={clsx('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
                    a.durum === 'odendi' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                    {a.durum === 'odendi' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                    {a.durum === 'odendi' ? `Ödendi${a.odemeTarihi ? ' · ' + tarihTr(a.odemeTarihi) : ''}` : 'Bekliyor'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Şubelerim özeti */}
      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <button onClick={onSubelerim} className="w-full px-5 py-3 border-b border-gray-100 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50">
          <span className="flex items-center gap-2"><Store size={16} /> Şubelerim</span>
          <span className="flex items-center gap-1 text-brand-600 text-xs">Tümü <ChevronRight size={14} /></span>
        </button>
        {ilkSubeler.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">Bağlı şube bulunamadı.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ilkSubeler.map(n => (
              <li key={n.key} className="px-5 py-3 text-sm">
                <p className="font-medium text-gray-800 truncate">{n.subeAdi || '—'}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                  <Building2 size={11} /> {n.cariAdi}
                  {n.kapsam === 'ekip' && n.ekiptenKim && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-gray-400"><Users size={11} /> {n.ekiptenKim}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
