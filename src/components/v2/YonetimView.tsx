'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Profile, BsySupervisor } from '@/lib/supabase'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'
import { NihaiPrimListesi } from '@/components/NihaiPrimListesi'
import { PrimOdemeListesi } from '@/components/AdetPrimView'
import { DestekPersonelHakedisView } from '@/components/DestekPersonelHakedisView'
import { DigerPrimView } from '@/components/DigerPrimView'
import { NoktalarimizView } from '@/components/NoktalarimizView'
import { KullanicilarView } from '@/components/KullanicilarView'

// v2 Yönetim sekmesi — v1 kapanınca da gereken yönetim ekranları.
// Ekranlar v1 ile aynı bileşenler ve aynı yetkilerle çalışır (veri/işlem birebir aynı);
// her zaman oturumdaki kullanıcının kendi yetkisiyle açılır ("Görünüm" uygulanmaz).

type Bolum = 'nihai' | 'odeme' | 'destek' | 'diger' | 'noktalar' | 'kullanicilar'

const BOLUMLER: { key: Bolum; label: string; roller: string[] }[] = [
  { key: 'nihai',        label: 'Nihai Prim',        roller: ['admin', 'ik', 'bsy', 'sup', 'jr'] },
  { key: 'odeme',        label: 'Prim Ödeme Listesi', roller: ['admin', 'ik', 'bsy', 'sup'] },
  { key: 'destek',       label: 'Destek Hakediş',    roller: ['admin', 'sup'] },
  { key: 'diger',        label: 'Diğer Prim',        roller: ['admin'] },
  { key: 'noktalar',     label: 'Noktalarımız',      roller: ['admin', 'bsy', 'sup', 'jr', 'manager'] },
  { key: 'kullanicilar', label: 'Kullanıcılar',      roller: ['admin', 'bsy', 'sup', 'jr', 'manager'] },
]

export function yonetimBolumleri(rol: string) {
  return BOLUMLER.filter(b => b.roller.includes(rol))
}

export function YonetimView({ profile, team, bsyLinks, gorunumVar }: {
  profile: Profile
  team: Profile[]
  bsyLinks: BsySupervisor[]
  gorunumVar: boolean
}) {
  const bolumler = useMemo(() => yonetimBolumleri(profile.role), [profile.role])
  const [bolum, setBolum] = useState<Bolum>(bolumler[0]?.key ?? 'nihai')

  // v1 Primler sayfasıyla aynı filtreler
  const { supFiltre, bsyKod } = useMemo(() => {
    if (profile.role === 'sup') {
      const jrlar = team.filter(p => p.role === 'jr' && p.manager_id === profile.id).map(p => p.full_name)
      return { supFiltre: [profile.full_name, ...jrlar] as string[] | null, bsyKod: null as string | null }
    }
    if (profile.role === 'bsy') {
      return { supFiltre: null, bsyKod: BSY_NAME_TO_KOD[profile.full_name.toLocaleLowerCase('tr')] ?? null }
    }
    return { supFiltre: null, bsyKod: null }
  }, [profile, team])

  if (bolumler.length === 0) return <p className="py-8 text-center text-sm text-gray-400">Bu bölümde ekranınız yok.</p>

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {bolumler.map(b => (
          <button key={b.key} onClick={() => setBolum(b.key)}
            className={clsx('shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap',
              bolum === b.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}>
            {b.label}
          </button>
        ))}
      </div>
      {gorunumVar && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Yönetim ekranları her zaman kendi yetkinizle açılır; &quot;Görünüm&quot; seçimi burada uygulanmaz.
        </p>
      )}
      <div className="h-[calc(100dvh-12rem)] md:h-[calc(100dvh-9rem)] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
        {bolum === 'nihai' && <NihaiPrimListesi currentProfile={profile} team={team} />}
        {bolum === 'odeme' && <PrimOdemeListesi supervisorFilter={supFiltre} bsyKodFilter={bsyKod} userId={profile.id} />}
        {bolum === 'destek' && <DestekPersonelHakedisView currentUserName={profile.full_name} currentUserRole={profile.role} />}
        {bolum === 'diger' && <DigerPrimView userId={profile.id} />}
        {bolum === 'noktalar' && <NoktalarimizView currentProfile={profile} team={team} bsyLinks={bsyLinks} />}
        {bolum === 'kullanicilar' && <KullanicilarView currentProfile={profile} team={team} bsyLinks={bsyLinks} />}
      </div>
    </div>
  )
}
