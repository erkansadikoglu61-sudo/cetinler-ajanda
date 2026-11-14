'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wallet, Store, CalendarDays, Award, BarChart2, RefreshCw, LogOut, Eye } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import { useTeam } from '@/hooks/useTeam'
import { HesabimView } from '@/components/v2/HesabimView'
import { SubelerimView } from '@/components/v2/SubelerimView'
import { PrimView } from '@/components/v2/PrimView'
import { AjandaView, type AjandaKisi } from '@/components/v2/AjandaView'
import { V2Veri, V2_ROL_ADI } from '@/components/v2/types'

// Çetinler Ajanda v2 — v1 (/app) ile yan yana hazırlanıyor.
// v2'de "Dashboard" sekmesi YOK; açılış ekranı herkes için "Hesabım".
// Geliştirme süresince yalnızca yönetici erişir; yönetici "Görünüm" ile
// herhangi bir kullanıcının gözünden kontrol edebilir.

type Sekme = 'hesabim' | 'subelerim' | 'ajanda' | 'prim' | 'raporlar'

const SEKMELER: { key: Sekme; label: string; icon: typeof Wallet }[] = [
  { key: 'hesabim',   label: 'Hesabım',   icon: Wallet },
  { key: 'subelerim', label: 'Şubelerim', icon: Store },
  { key: 'ajanda',    label: 'Ajanda',    icon: CalendarDays },
  { key: 'prim',      label: 'Prim',      icon: Award },
  { key: 'raporlar',  label: 'Raporlar',  icon: BarChart2 },
]

const YAKINDA: Record<'raporlar', { baslik: string; maddeler: string[] }> = {
  raporlar: {
    baslik: 'Raporlar',
    maddeler: [
      'Sellout, tahsilat ve ziyaret raporları tek görünürlük kuralıyla.',
      'Dashboard sekmesi v2\'de yok.',
    ],
  },
}

export default function V2Page() {
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const { team } = useTeam(profile)
  const [sekme, setSekme] = useState<Sekme>('hesabim')
  const [gorunum, setGorunum] = useState<string>('')
  const [veri, setVeri] = useState<V2Veri | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const yukle = useCallback(async (yenile = false) => {
    if (!profile || profile.role !== 'admin') return
    setYukleniyor(true)
    setHata('')
    try {
      const qs = new URLSearchParams()
      if (gorunum) qs.set('gorunum', gorunum)
      if (yenile) qs.set('yenile', '1')
      const res = await fetch(`/api/v2/noktalar?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Veri alınamadı')
      setVeri(json as V2Veri)
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [profile, gorunum])

  useEffect(() => { yukle() }, [yukle])

  // Ajanda: bakılan kullanıcı + alt kullanıcıları; yönetici kendisine bakarken tüm ekip
  const ajandaKisileri = useMemo<AjandaKisi[]>(() => {
    if (!veri) return []
    const k = veri.kullanici
    if (k.rol === 'admin') {
      return [{ id: k.id, ad: k.ad, rol: k.rol },
        ...team.filter(p => p.id !== k.id && ['bsy', 'sup', 'jr'].includes(p.role)).map(p => ({ id: p.id, ad: p.full_name, rol: p.role }))]
    }
    return [{ id: k.id, ad: k.ad, rol: k.rol }, ...k.altlar]
  }, [veri, team])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <p className="text-lg font-semibold text-gray-800">Çetinler Ajanda v2 hazırlanıyor</p>
        <p className="text-sm text-gray-500">Yeni sürüm hazır olduğunda buradan kullanabileceksiniz.</p>
        <Link href="/app" className="mt-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm">Ajandaya dön</Link>
      </div>
    )
  }

  const gorunumAdaylari = team.filter(p => p.id !== profile.id)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Üst bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="font-semibold text-brand-700">Çetinler Ajanda</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">v2</span>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {SEKMELER.map(s => (
              <button key={s.key} onClick={() => setSekme(s.key)}
                className={clsx('px-3 py-1.5 rounded-lg text-sm',
                  sekme === s.key ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => yukle(true)} title="B2B'den yenile"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <RefreshCw size={16} className={clsx(yukleniyor && 'animate-spin')} />
            </button>
            <Link href="/app" className="px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100">v1</Link>
            <button onClick={async () => { await signOut(); router.replace('/login') }} title="Çıkış"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Yönetici: kullanıcının gözünden bak */}
        <label className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-sm">
          <Eye size={15} className="text-gray-400 shrink-0" />
          <span className="text-gray-500 shrink-0">Görünüm:</span>
          <select value={gorunum} onChange={e => setGorunum(e.target.value)}
            className="flex-1 min-w-0 bg-transparent focus:outline-none text-gray-800">
            <option value="">Kendim ({profile.full_name})</option>
            {gorunumAdaylari.map(p => (
              <option key={p.id} value={p.id}>{p.full_name} — {V2_ROL_ADI[p.role] ?? p.role}</option>
            ))}
          </select>
        </label>

        {hata && <p className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{hata}</p>}

        {!veri && yukleniyor && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {veri && sekme === 'hesabim' && <HesabimView veri={veri} gorunum={gorunum} onSubelerim={() => setSekme('subelerim')} />}
        {veri && sekme === 'subelerim' && <SubelerimView veri={veri} gorunum={gorunum} />}
        {veri && sekme === 'prim' && <PrimView key={gorunum} rol={veri.kullanici.rol} gorunum={gorunum} />}
        {veri && sekme === 'ajanda' && (
          <AjandaView key={gorunum} kisiler={ajandaKisileri} oturum={{ id: profile.id, rol: profile.role }}
            benRol={veri.kullanici.rol} gorunum={gorunum} />
        )}
        {sekme === 'raporlar' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-gray-400">Yapım aşamasında</p>
            <h2 className="text-lg font-semibold text-gray-800 mt-1">{YAKINDA.raporlar.baslik}</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc ml-5">
              {YAKINDA.raporlar.maddeler.map(m => <li key={m}>{m}</li>)}
            </ul>
            <Link href="/app" className="inline-block mt-4 text-sm text-brand-600">Şimdilik v1'de aç →</Link>
          </section>
        )}
      </main>

      {/* Mobil alt menü */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 grid grid-cols-5">
        {SEKMELER.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSekme(key)}
            className={clsx('flex flex-col items-center gap-0.5 py-2 text-[11px]',
              sekme === key ? 'text-brand-600' : 'text-gray-400')}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
