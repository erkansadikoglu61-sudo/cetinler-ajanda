'use client'

import { useState } from 'react'
import { Copy, Check, Store, Building2, Users, ChevronRight, Wallet, Clock } from 'lucide-react'
import { MONTHS_TR } from '@/lib/constants'
import { V2Veri, V2_ROL_ADI, ibanBicimle } from './types'

interface Props {
  veri: V2Veri
  onSubelerim: () => void
}

/** Son 3 ay + bu ay (bu ay en üstte) */
function sonAylar(): { yil: number; ay: number }[] {
  const d = new Date()
  const out: { yil: number; ay: number }[] = []
  for (let i = 0; i < 4; i++) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ yil: t.getFullYear(), ay: t.getMonth() + 1 })
  }
  return out
}

export function HesabimView({ veri, onSubelerim }: Props) {
  const k = veri.kullanici
  const [kopyalandi, setKopyalandi] = useState(false)
  const aylar = sonAylar()

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
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Wallet size={16} /> {MONTHS_TR[aylar[0].ay - 1]} {aylar[0].yil} hakedişi
        </div>
        <p className="mt-2 text-3xl font-semibold text-gray-300">— ₺</p>
        <p className="mt-1 text-xs text-gray-400">
          Anlık hakediş, adet prim motoru v2'ye bağlandığında burada görünecek.
        </p>
      </section>

      {/* Son 3 ay */}
      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-medium text-gray-700">Prim geçmişi</div>
        <ul className="divide-y divide-gray-100">
          {aylar.map((a, i) => (
            <li key={`${a.yil}-${a.ay}`} className="px-5 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-700">{MONTHS_TR[a.ay - 1]} {a.yil}</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={12} />
                {i === 0 ? 'Hakediş devam ediyor' : 'Ödeme bilgisi bağlanacak'}
              </span>
            </li>
          ))}
        </ul>
      </section>

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
