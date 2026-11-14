'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wallet, Store, CalendarDays, Award, BarChart2, RefreshCw, LogOut, Eye, Settings } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import { useTeam } from '@/hooks/useTeam'
import { HesabimView } from '@/components/v2/HesabimView'
import { SubelerimView } from '@/components/v2/SubelerimView'
import { PrimView } from '@/components/v2/PrimView'
import { AjandaView, type AjandaKisi } from '@/components/v2/AjandaView'
import { RaporlarView } from '@/components/v2/RaporlarView'
import { v2Erisimi } from '@/lib/v2/erisim'
import { YonetimView, yonetimBolumleri } from '@/components/v2/YonetimView'
import { V2Veri, V2_ROL_ADI } from '@/components/v2/types'

// Çetinler Ajanda v2 — v1 (/app) ile yan yana hazırlanıyor.
// v2'de "Dashboard" sekmesi YOK; açılış ekranı herkes için "Hesabım".
// Geliştirme süresince yalnızca yönetici erişir; yönetici "Görünüm" ile
// herhangi bir kullanıcının gözünden kontrol edebilir.

type Sekme = 'hesabim' | 'subelerim' | 'ajanda' | 'prim' | 'raporlar' | 'yonetim'

// v1'den taşınan geniş tablolar bu sekmelerde; içerik genişliği büyük
const GENIS: Sekme[] = ['prim', 'raporlar', 'yonetim']

const SEKMELER: { key: Sekme; label: string; icon: typeof Wallet }[] = [
  { key: 'hesabim',   label: 'Hesabım',   icon: Wallet },
  { key: 'subelerim', label: 'Şubelerim', icon: Store },
  { key: 'ajanda',    label: 'Ajanda',    icon: CalendarDays },
  { key: 'prim',      label: 'Prim',      icon: Award },
  { key: 'raporlar',  label: 'Raporlar',  icon: BarChart2 },
]

export default function V2Page() {
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const { team, bsyLinks, visibleIds } = useTeam(profile)
  const [sekme, setSekme] = useState<Sekme>('hesabim')
  const [gorunum, setGorunum] = useState<string>('')
  const [veri, setVeri] = useState<V2Veri | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const yukle = useCallback(async (yenile = false) => {
    if (!profile || !v2Erisimi(profile.role, profile.full_name)) return
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

  // Bekleyen talepler (kapatma yetkisi olduğu açık talepler) → Şubelerim rozeti
  const [bekleyenTalep, setBekleyenTalep] = useState(0)
  useEffect(() => {
    if (!veri) return
    let iptal = false
    const qs = gorunum ? `?gorunum=${encodeURIComponent(gorunum)}` : ''
    fetch(`/api/v2/talepler${qs}`)
      .then(r => (r.ok ? r.json() : { talepler: [] }))
      .then(j => {
        if (iptal) return
        const l = (j.talepler ?? []) as { durum: string; kapatabilir: boolean }[]
        setBekleyenTalep(l.filter(t => t.durum === 'acik' && t.kapatabilir).length)
      })
      .catch(() => {})
    return () => { iptal = true }
  }, [veri, gorunum, sekme])

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

  // v1'den taşınan ekranlar için oturum bilgisi (her zaman gerçek kullanıcı)
  const ids = visibleIds()
  const idsKey = ids.join(',')
  const oturum = useMemo(
    () => (profile ? { profile, team, bsyLinks, visibleIds: idsKey ? idsKey.split(',') : [] } : null),
    [profile, team, bsyLinks, idsKey],
  )

  // Yönetim sekmesi: oturumdaki kullanıcının rolüne göre (v1 yetkileriyle aynı)
  const sekmeler = useMemo(() => {
    const yon = profile && yonetimBolumleri(profile.role).length > 0
    return yon ? [...SEKMELER, { key: 'yonetim' as Sekme, label: 'Yönetim', icon: Settings }] : SEKMELER
  }, [profile])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!v2Erisimi(profile.role, profile.full_name)) {
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
        <div className={clsx('mx-auto px-4 h-14 flex items-center gap-3', GENIS.includes(sekme) ? 'max-w-7xl' : 'max-w-3xl')}>
          <span className="font-semibold text-brand-700">Çetinler Ajanda</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">v2</span>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {sekmeler.map(s => (
              <button key={s.key} onClick={() => setSekme(s.key)}
                className={clsx('px-3 py-1.5 rounded-lg text-sm',
                  sekme === s.key ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                {s.label}
                {s.key === 'subelerim' && bekleyenTalep > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{bekleyenTalep}</span>
                )}
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

      <main className={clsx('mx-auto px-4 py-4 space-y-4', GENIS.includes(sekme) ? 'max-w-7xl' : 'max-w-3xl')}>
        {/* Yönetici: kullanıcının gözünden bak */}
        {profile.role === 'admin' && (
        <label className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-sm max-w-3xl mx-auto">
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
        )}

        {hata && <p className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{hata}</p>}

        {!veri && yukleniyor && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {veri && sekme === 'hesabim' && <HesabimView veri={veri} gorunum={gorunum} onSubelerim={() => setSekme('subelerim')} />}
        {veri && sekme === 'subelerim' && <SubelerimView veri={veri} gorunum={gorunum} />}
        {veri && sekme === 'prim' && <PrimView key={gorunum} rol={veri.kullanici.rol} gorunum={gorunum} oturum={oturum!} />}
        {veri && sekme === 'ajanda' && (
          <AjandaView key={gorunum} kisiler={ajandaKisileri} oturum={{ id: profile.id, rol: profile.role }}
            benRol={veri.kullanici.rol} gorunum={gorunum} team={team} />
        )}
        {sekme === 'yonetim' && (
          <YonetimView profile={profile} team={team} bsyLinks={bsyLinks} gorunumVar={!!gorunum} />
        )}
        {veri && sekme === 'raporlar' && (
          <RaporlarView key={gorunum} rol={veri.kullanici.rol} gorunum={gorunum} kisiler={ajandaKisileri} oturum={oturum!} />
        )}
      </main>

      {/* Mobil alt menü */}
      <nav className={clsx('md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 grid', sekmeler.length > 5 ? 'grid-cols-6' : 'grid-cols-5')}>
        {sekmeler.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSekme(key)}
            className={clsx('relative flex flex-col items-center gap-0.5 py-2 text-[11px]',
              sekme === key ? 'text-brand-600' : 'text-gray-400')}>
            <Icon size={20} />
            {key === 'subelerim' && bekleyenTalep > 0 && (
              <span className="absolute top-1 left-1/2 ml-1.5 rounded-full bg-amber-500 px-1 text-[9px] font-semibold leading-4 text-white">{bekleyenTalep}</span>
            )}
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
