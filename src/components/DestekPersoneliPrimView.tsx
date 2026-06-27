'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface DestekPersonelRow {
  merch_adi: string
  sube_adi: string
  cari_adi: string
  cetinler_merch: string
  kategori_performans: number // Çetinler merch'ün kategori performansı (%)
  kosullu_destek_prim: number // Adet prim tablosundan
  hak_edis: number // kategori_performans × kosullu_destek_prim
}

interface Props {
  currentUserRole: string
  currentUserId: string
}

export function DestekPersoneliPrimView({ currentUserRole, currentUserId }: Props) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay, setAy] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DestekPersonelRow[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      // TODO: API endpoint oluştur
      // const res = await fetch(`/api/destek-personel-prim?yil=${yil}&ay=${ay}`)
      // const data = await res.json()
      // setRows(data.rows || [])

      // Placeholder
      setRows([])
    } catch (e) {
      console.error('Destek personeli prim yükleme hatası:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [yil, ay])

  const toplamHakEdis = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.hak_edis, 0)
  }, [rows])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-700">Destek Personeli Prim Dağıtım</span>

        {/* Yıl */}
        <div className="relative">
          <select
            value={yil}
            onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none"
          >
            {[now.getFullYear() - 1, now.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay */}
        <div className="relative">
          <select
            value={ay}
            onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none"
          >
            {MONTHS_TR.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="flex-1" />

        {!loading && rows.length > 0 && (
          <div className="text-xs text-gray-500">
            <span className="font-semibold">{rows.length}</span> kişi
            <span className="mx-1">•</span>
            Toplam: <span className="font-bold text-brand-700">{toplamHakEdis.toLocaleString('tr-TR')} ₺</span>
          </div>
        )}
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-2">Veri bulunamadı</p>
            <p className="text-xs text-gray-400">
              {yil} / {MONTHS_TR[ay - 1]} dönemi için destek personeli prim verisi yok
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs border-collapse w-full bg-white">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="text-left px-4 py-2.5 font-semibold w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold min-w-[150px]">Destek Personeli</th>
                  <th className="text-left px-4 py-2.5 font-semibold min-w-[120px]">Şube</th>
                  <th className="text-left px-4 py-2.5 font-semibold min-w-[200px]">Cari</th>
                  <th className="text-left px-4 py-2.5 font-semibold min-w-[150px]">Çetinler Merch</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[100px]">Kategori Performans</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[120px]">Koşullu Destek Prim</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[120px] bg-brand-700">Hak Ediş</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={clsx(
                      'border-b border-gray-100 last:border-0',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    )}
                  >
                    <td className="px-4 py-2 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{row.merch_adi}</td>
                    <td className="px-4 py-2 text-gray-600">{row.sube_adi}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{row.cari_adi}</td>
                    <td className="px-4 py-2 text-gray-800">{row.cetinler_merch}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-blue-700">
                      {row.kategori_performans.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-800">
                      {row.kosullu_destek_prim.toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-brand-700 bg-brand-50">
                      {row.hak_edis.toLocaleString('tr-TR')} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={7} className="px-4 py-3 text-right text-gray-700">
                    TOPLAM
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-700 bg-brand-100">
                    {toplamHakEdis.toLocaleString('tr-TR')} ₺
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
