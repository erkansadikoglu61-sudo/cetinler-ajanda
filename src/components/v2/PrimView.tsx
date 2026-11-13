'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { EkipPrimView } from './EkipPrimView'
import { BsyAdetPrimView } from './BsyAdetPrimView'
import { SahaPrimView } from './SahaPrimView'

type Bolum = 'ekip' | 'bsy' | 'saha'

const BOLUMLER: { key: Bolum; label: string; roller: string[] }[] = [
  { key: 'ekip', label: 'Sup · Jr · Merch', roller: ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr', 'merch'] },
  { key: 'bsy',  label: 'BSY Adet',         roller: ['admin', 'ik', 'manager', 'bsy'] },
  { key: 'saha', label: 'Bayi Merch · Destek', roller: ['admin', 'ik', 'manager', 'bsy', 'sup', 'jr'] },
]

/** v2 Prim sekmesi — tüm adet primleri tek yerde; bölümler role göre görünür. */
export function PrimView({ rol, gorunum }: { rol: string; gorunum: string }) {
  const bolumler = useMemo(() => BOLUMLER.filter(b => b.roller.includes(rol)), [rol])
  const [bolum, setBolum] = useState<Bolum>(rol === 'bsy' ? 'bsy' : 'ekip')

  useEffect(() => {
    if (!bolumler.some(b => b.key === bolum)) setBolum(bolumler[0]?.key ?? 'ekip')
  }, [bolumler, bolum])

  return (
    <div className="space-y-4">
      {bolumler.length > 1 && (
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {bolumler.map(b => (
            <button key={b.key} onClick={() => setBolum(b.key)}
              className={clsx('flex-1 rounded-lg px-2 py-1.5 text-xs font-medium',
                bolum === b.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}>
              {b.label}
            </button>
          ))}
        </div>
      )}
      {bolum === 'ekip' && <EkipPrimView gorunum={gorunum} />}
      {bolum === 'bsy' && <BsyAdetPrimView gorunum={gorunum} />}
      {bolum === 'saha' && <SahaPrimView gorunum={gorunum} />}
    </div>
  )
}
