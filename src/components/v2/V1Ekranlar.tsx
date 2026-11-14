'use client'

// v1'den v2'ye taşınan ekranlar. v1 kapanacağı için tüm ekranlar (Dashboard hariç)
// v2'de; bileşenler v1 ile aynı, yetkiler v1 ile aynı. Her zaman oturumdaki
// kullanıcının kendi yetkisiyle açılır ("Görünüm" uygulanmaz).

import type { ReactNode } from 'react'
import type { Profile, BsySupervisor } from '@/lib/supabase'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'
import { BsyView } from '@/components/BsyView'
import { AdetPrimTablosu, PrimAnalizView } from '@/components/AdetPrimView'
import { SelloutView } from '@/components/SelloutView'
import { KpiView } from '@/components/KpiView'
import { GenelRaporlarView } from '@/components/GenelRaporlarView'
import { TahsilatPlanimView } from '@/components/TahsilatPlanimView'
import { TahsilatTakvimiView } from '@/components/TahsilatTakvimiView'
import { SellinSelloutView } from '@/components/SellinSelloutView'
import { AnalizView } from '@/components/AnalizView'
import { PersonelliNoktaAnalizView } from '@/components/PersonelliNoktaAnalizView'

export interface Oturum {
  profile: Profile
  team: Profile[]
  bsyLinks: BsySupervisor[]
  visibleIds: string[]
}

export interface V1Bolum {
  key: string
  label: string
  roller: string[]
  render: (o: Oturum) => ReactNode
}

/** v1 ekranının tam yükseklikte çalışması için kap */
export function V1Cerceve({ children }: { children: ReactNode }) {
  return (
    <div className="h-[calc(100dvh-13rem)] md:h-[calc(100dvh-10rem)] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {children}
    </div>
  )
}

function primFiltreleri(o: Oturum) {
  const p = o.profile
  if (p.role === 'sup') {
    const jrlar = o.team.filter(x => x.role === 'jr' && x.manager_id === p.id).map(x => x.full_name)
    return { supFiltre: [p.full_name, ...jrlar] as string[] | null, bsyKod: null as string | null }
  }
  if (p.role === 'bsy') return { supFiltre: null, bsyKod: BSY_NAME_TO_KOD[p.full_name.toLocaleLowerCase('tr')] ?? null }
  return { supFiltre: null, bsyKod: null }
}

const bsyAdi = (o: Oturum) => (o.profile.role === 'bsy' ? o.profile.full_name : '')

/** Prim sekmesine eklenen v1 ekranları */
export const PRIM_V1_BOLUMLERI: V1Bolum[] = [
  {
    key: 'ciro', label: 'Ciro ve Tahsilat', roller: ['admin', 'bsy'],
    render: o => <BsyView isAdmin={o.profile.role === 'admin'} isBsy={o.profile.role === 'bsy'} bsyAdi={bsyAdi(o)} />,
  },
  {
    key: 'adet-tablo', label: 'Adet Prim Tablosu', roller: ['admin', 'bsy', 'sup'],
    render: o => <AdetPrimTablosu isAdmin={o.profile.role === 'admin'} />,
  },
  {
    key: 'prim-analiz', label: 'Prim Analiz', roller: ['admin', 'manager'],
    render: o => { const f = primFiltreleri(o); return <PrimAnalizView supervisorFilter={f.supFiltre} bsyKodFilter={f.bsyKod} /> },
  },
]

/** Raporlar sekmesine eklenen v1 ekranları */
export const RAPOR_V1_BOLUMLERI: V1Bolum[] = [
  {
    key: 'sellout-detay', label: 'Sellout Detay', roller: ['admin', 'bsy', 'sup', 'jr', 'merch', 'manager'],
    render: o => <SelloutView currentProfile={o.profile} team={o.team} visibleIds={o.visibleIds} active />,
  },
  { key: 'kpi', label: 'Özel Hedefler', roller: ['admin', 'bsy'], render: () => <KpiView /> },
  { key: 'genel', label: 'Genel Raporlar', roller: ['admin', 'bsy'], render: () => <GenelRaporlarView /> },
  {
    key: 'tahsilat-planim', label: 'Tahsilat Planım', roller: ['admin', 'bsy'],
    render: o => (
      <TahsilatPlanimView bsyAdi={bsyAdi(o)} isAdmin={o.profile.role === 'admin'}
        isBolgeMuduru={o.profile.full_name === 'Burak Kılıç'} />
    ),
  },
  {
    key: 'tahsilat-takvimi', label: 'Tahsilat Takvimi', roller: ['admin', 'manager', 'bsy'],
    render: o => <TahsilatTakvimiView isAdmin={o.profile.role === 'admin'} bsyAdi={bsyAdi(o)} />,
  },
  {
    key: 'sellinout', label: 'Sell-in / Sell-out', roller: ['admin', 'bsy'],
    render: o => <SellinSelloutView currentProfile={o.profile} active />,
  },
  { key: 'analiz', label: 'Satış Analizi', roller: ['admin', 'bsy'], render: o => <AnalizView currentProfile={o.profile} active /> },
  { key: 'personelli', label: 'Personelli Nokta Analiz', roller: ['admin'], render: () => <PersonelliNoktaAnalizView /> },
]
