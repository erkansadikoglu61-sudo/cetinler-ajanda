'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'
import clsx from 'clsx'

export interface ParamItem {
  /** Parametre adı (ör. "Dönem") */
  label: string
  /** Açıklama / değer */
  value: string
}

/**
 * Sadece admin'in görebileceği, fareyle üzerine gelince açılan
 * "Sayfa / Tablo Parametreleri" kutucuğu.
 *
 * Bir sayfanın hangi veri kaynağı, filtre ve hesaplama parametreleriyle
 * oluştuğunu hatırlatmak için kullanılır.
 */
export function SayfaParametreleri({
  visible = true,
  baslik = 'Sayfa / Tablo Parametreleri',
  aciklama,
  parametreler,
}: {
  /** false ise hiç render edilmez (admin dışı roller için) */
  visible?: boolean
  baslik?: string
  /** Panelin en üstünde kısa bir özet (opsiyonel) */
  aciklama?: string
  parametreler: ParamItem[]
}) {
  const [pinned, setPinned] = useState(false)

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-4 z-40 group print:hidden select-none">
      {/* Tetikleyici rozet */}
      <button
        type="button"
        onClick={() => setPinned(p => !p)}
        className="flex items-center gap-1.5 rounded-full bg-gray-800/90 text-white text-[11px] font-medium px-3 py-1.5 shadow-lg hover:bg-gray-900 transition-colors"
        title="Fareyle yaklaşınca sayfa parametreleri görünür"
      >
        <Info size={13} /> Sayfa Parametreleri
      </button>

      {/* Panel — hover veya sabitlendiğinde görünür */}
      <div
        className={clsx(
          'absolute bottom-full left-0 mb-2 w-[22rem] max-w-[90vw] max-h-[70vh] overflow-auto',
          'rounded-xl bg-white shadow-2xl border border-gray-200 transition-all duration-150',
          pinned ? 'block' : 'hidden group-hover:block'
        )}
      >
        {/* Başlık */}
        <div className="sticky top-0 flex items-center justify-between gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-t-xl">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Info size={13} /> {baslik}
          </span>
          {pinned && (
            <button
              type="button"
              onClick={() => setPinned(false)}
              className="p-0.5 hover:bg-white/20 rounded"
              title="Kapat"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {aciklama && (
            <p className="text-[11px] text-gray-500 leading-relaxed border-b border-gray-100 pb-2">
              {aciklama}
            </p>
          )}
          <dl className="space-y-2.5">
            {parametreler.map((p, i) => (
              <div key={i} className="grid grid-cols-[7rem_1fr] gap-2 items-start">
                <dt className="text-[11px] font-semibold text-gray-700">{p.label}</dt>
                <dd className="text-[11px] text-gray-500 leading-snug">{p.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[9px] text-gray-300 pt-1 border-t border-gray-100">
            Yalnızca yönetici görür · sabitlemek için tıklayın
          </p>
        </div>
      </div>
    </div>
  )
}
