'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'
import type { MerchSatisPivotResponse } from '@/app/api/merch-satis-pivot/route'

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface Props {
  data:           MerchSatisPivotResponse
  yil:            number
  excludedSlots:  Set<string>           // "cariKod|subeKod"
  onToggleSlot:   (key: string) => void
}

export function MerchSatisPivotTable({ data, yil, excludedSlots, onToggleSlot }: Props) {
  const { aylar, cariler } = data
  const [collapsedCaris, setCollapsedCaris] = useState<Set<string>>(new Set())
  const [collapsedSubes, setCollapsedSubes] = useState<Set<string>>(new Set())

  const toggleCari = (key: string) =>
    setCollapsedCaris(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleSube = (key: string) =>
    setCollapsedSubes(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const rows: React.ReactNode[] = []

  for (const cari of cariler) {
    const cariCollapsed = collapsedCaris.has(cari.cariKod)

    rows.push(
      <tr
        key={`cari-${cari.cariKod}`}
        onClick={() => toggleCari(cari.cariKod)}
        className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-b border-gray-200 select-none"
      >
        <td className="w-8 px-2" />
        <td className="px-3 py-2 font-semibold text-gray-800" colSpan={aylar.length + 1}>
          <div className="flex items-center gap-1">
            {cariCollapsed
              ? <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />
              : <ChevronDown  size={12} className="text-gray-500 flex-shrink-0" />}
            {cari.cariAdi}
          </div>
        </td>
      </tr>
    )

    if (cariCollapsed) continue

    for (const sube of cari.subeler) {
      const subeKey      = `${cari.cariKod}|${sube.subeKod}`
      const subeCollapsed = collapsedSubes.has(subeKey)

      rows.push(
        <tr
          key={`sube-${subeKey}`}
          onClick={() => toggleSube(subeKey)}
          className="bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-100 select-none"
        >
          <td className="w-8 px-2" />
          <td className="px-3 py-1.5 text-gray-700 font-medium" colSpan={aylar.length + 1}>
            <div className="flex items-center gap-1 pl-5">
              {subeCollapsed
                ? <ChevronRight size={11} className="text-gray-400 flex-shrink-0" />
                : <ChevronDown  size={11} className="text-gray-400 flex-shrink-0" />}
              {sube.subeAdi}
            </div>
          </td>
        </tr>
      )

      if (subeCollapsed) continue

      rows.push(
        <tr key={`merch-${subeKey}`} className="border-b border-gray-100 bg-white">
          <td className="w-8 px-2" />
          <td className="px-3 py-1 text-gray-400 text-[11px] italic" colSpan={aylar.length + 1}>
            <div className="pl-12">Çetinler Merch</div>
          </td>
        </tr>
      )

      for (let pi = 0; pi < sube.personeller.length; pi++) {
        const p        = sube.personeller[pi]
        const slotKey  = `${cari.cariKod}|${sube.subeKod}|${p.personelAdi}`
        const excluded = excludedSlots.has(slotKey)

        rows.push(
          <tr
            key={`p-${subeKey}-${p.personelAdi}`}
            className={clsx(
              'border-b border-gray-100 transition-colors',
              excluded ? 'opacity-35 bg-gray-100' : pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
            )}
          >
            {/* Checkbox */}
            <td className="w-8 px-2 text-center">
              <button
                type="button"
                onClick={() => onToggleSlot(slotKey)}
                className={clsx(
                  'w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors mx-auto',
                  excluded ? 'border-gray-300 bg-white' : 'bg-brand-500 border-brand-500'
                )}
              >
                {!excluded && <Check size={9} className="text-white" strokeWidth={3} />}
              </button>
            </td>

            {/* Personel adı */}
            <td className="px-3 py-1.5 text-brand-700 font-medium">
              <div className="pl-16">{p.personelAdi}</div>
            </td>

            {/* Aylık adet */}
            {aylar.map(ay => (
              <td key={ay} className="px-3 py-1.5 text-right text-gray-700 tabular-nums">
                {p.aylikAdet[ay] != null ? fmt(p.aylikAdet[ay]) : ''}
              </td>
            ))}

            {/* Genel toplam */}
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
        {excludedSlots.size > 0 && (
          <span className="ml-2 text-amber-600 normal-case font-normal">
            · {excludedSlots.size} slot bütçe dışı
          </span>
        )}
      </div>
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-700 text-white text-[11px]">
            <th className="w-8 px-2" />
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
