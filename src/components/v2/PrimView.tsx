'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { EkipPrimView } from './EkipPrimView'
import { BsyAdetPrimView } from './BsyAdetPrimView'
import { SahaPrimView } from './SahaPrimView'
import { PRIM_V1_BOLUMLERI, V1Cerceve, type Oturum } from './V1Ekranlar'

const YENI_BOLUMLER: { key: string; label: string; roller: string[] }[] = [
  { key: 'ekip', label: 'Sup · Jr · Merch',    roller: ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr', 'merch'] },
  { key: 'bsy',  label: 'BSY Adet',            roller: ['admin', 'ik', 'manager', 'bsy'] },
  { key: 'saha', label: 'Bayi Merch · Destek', roller: ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr'] },
]

/** v2 Prim sekmesi — adet primleri (v2) + v1'den taşınan prim ekranları. */
export function PrimView({ rol, gorunum, oturum }: { rol: string; gorunum: string; oturum: Oturum }) {
  const bolumler = useMemo(() => [
    ...YENI_BOLUMLER.filter(b => b.roller.includes(rol)).map(b => ({ key: b.key, label: b.label, v1: false })),
    ...PRIM_V1_BOLUMLERI.filter(b => b.roller.includes(oturum.profile.role)).map(b => ({ key: b.key, label: b.label, v1: true })),
  ], [rol, oturum.profile.role])
  const [bolum, setBolum] = useState<string>(rol === 'bsy' ? 'bsy' : 'ekip')

  useEffect(() => {
    if (!bolumler.some(b => b.key === bolum)) setBolum(bolumler[0]?.key ?? 'ekip')
  }, [bolumler, bolum])

  const v1 = PRIM_V1_BOLUMLERI.find(b => b.key === bolum)

  return (
    <div className="space-y-4">
      {bolumler.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 max-w-3xl mx-auto">
          {bolumler.map(b => (
            <button key={b.key} onClick={() => setBolum(b.key)}
              className={clsx('shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap',
                bolum === b.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}>
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        {bolum === 'ekip' && <EkipPrimView gorunum={gorunum} />}
        {bolum === 'bsy' && <BsyAdetPrimView gorunum={gorunum} />}
        {bolum === 'saha' && <SahaPrimView gorunum={gorunum} />}
      </div>
      {v1 && <V1Cerceve>{v1.render(oturum)}</V1Cerceve>}
    </div>
  )
}
