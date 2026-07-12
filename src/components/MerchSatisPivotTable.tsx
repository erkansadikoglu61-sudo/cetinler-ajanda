'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import type { MerchSatisPivotResponse } from '@/app/api/merch-satis-pivot/route'

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface Props {
  data: MerchSatisPivotResponse
  yil: number
}

export function MerchSatisPivotTable({ data, yil }: Props) {
  const { aylar, cariler } = data
  const [collapsedCaris, setCollapsedCaris] = useState<Set<string>>(new Set())
  const [collapsedSubes, setCollapsedSubes] = useState<Set<string>>(new Set())

  const toggleCari = (key: string) =>
    setCollapsedCaris(prev => {
      const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
    })

  const toggleSube = (key: string) =>
    setCollapsedSubes(prev => {
      const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
    })

  const rows: React.ReactNode[] = []

  for (const cari of cariler) {
    const cariCollapsed = collapsedCaris.has(cari.cariKod)

    rows.push(
      <tr
        key={`cari-${cari.cariKod}`}
        onClick={() => toggleCari(cari.cariKod)}
        className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-b border-gray-200 select-none"
      >
        <td className="px-3 py-2 font-semibold text-gray-800">
          <div className="flex items-center gap-1">
            {cariCollapsed
              ? <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />
              : <ChevronDown  size={12} className="text-gray-500 flex-shrink-0" />}
            {cari.cariAdi}
          </div>
        </td>
        {aylar.map(ay => <td key={ay} />)}
        <td />
      </tr>
    )

    if (cariCollapsed) continue

    for (const sube of cari.subeler) {
      const subeKey     = `${cari.cariKod}|${sube.subeKod}`
      const subeCollapsed = collapsedSubes.has(subeKey)

      rows.push(
        <tr
          key={`sube-${subeKey}`}
          onClick={() => toggleSube(subeKey)}
          className="bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-100 select-none"
        >
          <td className="px-3 py-1.5 text-gray-700 font-medium">
            <div className="flex items-center gap-1 pl-5">
              {subeCollapsed
                ? <ChevronRight size={11} className="text-gray-400 flex-shrink-0" />
                : <ChevronDown  size={11} className="text-gray-400 flex-shrink-0" />}
              {sube.subeAdi}
            </div>
          </td>
          {aylar.map(ay => <td key={ay} />)}
          <td />
        </tr>
      )

      if (subeCollapsed) continue

      rows.push(
        <tr key={`merch-${subeKey}`} className="border-b border-gray-100 bg-white">
          <td className="px-3 py-1 text-gray-400 text-[11px] italic">
            <div className="pl-12">Çetinler Merch</div>
          </td>
          {aylar.map(ay => <td key={ay} />)}
          <td />
        </tr>
      )

      for (let pi = 0; pi < sube.personeller.length; pi++) {
        const p = sube.personeller[pi]
        rows.push(
          <tr
            key={`p-${subeKey}-${p.personelAdi}`}
            className={clsx(
              'border-b border-gray-100',
              pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
            )}
          >
            <td className="px-3 py-1.5 text-brand-700 font-medium">
              <div className="pl-16">{p.personelAdi}</div>
            </td>
            {aylar.map(ay => (
              <td key={ay} className="px-3 py-1.5 text-right text-gray-700 tabular-nums">
                {p.aylikAdet[ay] != null ? fmt(p.aylikAdet[ay]) : ''}
              </td>
            ))}
            <td className="px-3 py-1.5 text-right font-semibold text-gray-800 tabular-nums">
              {fmt(p.toplam)}
            </td>
          </tr>
        )
      }
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="mt-10">
      <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-white">
        Merch Bazında Satış Detayı
      </div>
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-700 text-white text-[11px]">
            <th className="text-left px-3 py-2.5 font-semibold">Satır Etiketleri</th>
            {aylar.map(ay => (
              <th key={ay} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">
                {yil}-{String(ay).padStart(2, '0')}
              </th>
            ))}
            <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Genel Toplam</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}
