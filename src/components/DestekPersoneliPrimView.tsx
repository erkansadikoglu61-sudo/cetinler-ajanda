'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { GRUP_NORMALIZE } from '@/lib/sellout'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface DestekPersonelRow {
  merch_adi: string
  sube_adi: string
  cari_adi: string
  cetinler_merch: string
  kategori: string
  hedef_gerceklesme: number   // %
  satis_adedi: number
  kosullu_destek_prim: number // ₺/adet
  hak_edis: number            // ₺
}

interface Props {
  currentUserRole: string
  currentUserId: string
  currentUserName: string
  bsyKod: string | null
}

export function DestekPersoneliPrimView({ currentUserRole, currentUserId, currentUserName, bsyKod }: Props) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay, setAy] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DestekPersonelRow[]>([])
  const [cariFilter, setCariFilter]   = useState('')
  const [merchFilter, setMerchFilter] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const donem  = `${yil}-${String(ay).padStart(2, '0')}`
      const params = new URLSearchParams({ yil: String(yil), ay: String(ay) })
      if (currentUserRole === 'bsy' && bsyKod) params.append('bsyKod', bsyKod)
      else if (currentUserRole === 'sup') params.append('supAdi', currentUserName)

      // 4 kaynağı paralel çek
      const [destekRes, selloutRes, primRes, targetsRes] = await Promise.all([
        fetch(`/api/destek-personel-prim?${params}`),
        fetch('/api/sellout'),
        fetch(`/api/adet-prim?yil=${yil}&ay=${ay}`),
        fetch(`/api/sellout-targets?donem=${donem}`),
      ])
      const [destekData, selloutData, primData, targetsData] = await Promise.all([
        destekRes.json(), selloutRes.json(), primRes.json(), targetsRes.json(),
      ])

      // 1. stokPrimMap: stokKodu → koşullu destek prim (₺/adet)
      const stokPrimMap = new Map<string, number>()
      for (const p of (primData.rows ?? [])) {
        if (p.stokKodu && p.kosulluDestek != null) {
          stokPrimMap.set(p.stokKodu as string, p.kosulluDestek as number)
        }
      }

      // 2. Sadece ilgili dönem + Çetinler Merch satışları
      // satisMap: merch_personel.lower → kategori(normalized) → { satis_adedi, kosullu_prim_toplam }
      const satisMap = new Map<string, Map<string, { satis_adedi: number; kosullu_prim_toplam: number }>>()
      for (const r of (selloutData.rows ?? [])) {
        if ((r.donem as string) !== donem) continue
        if ((r.merch_tipi as string) !== 'Çetinler Merch') continue
        const mk   = (r.merch_personel as string).toLowerCase()
        const kat  = GRUP_NORMALIZE[r.grup_aciklama as string] ?? (r.grup_aciklama as string)
        const adet = (r.satilan_adet as number) || 0
        const prim = stokPrimMap.get(r.stok_kodu as string) ?? 0
        if (!satisMap.has(mk)) satisMap.set(mk, new Map())
        const km = satisMap.get(mk)!
        if (!km.has(kat)) km.set(kat, { satis_adedi: 0, kosullu_prim_toplam: 0 })
        const e = km.get(kat)!
        e.satis_adedi        += adet
        e.kosullu_prim_toplam += adet * prim
      }

      // 3. hedefMap: merch_name.lower → grup(normalized) → hedef_adet
      const hedefMap = new Map<string, Map<string, number>>()
      for (const t of (targetsData.merch_targets ?? [])) {
        const k = (t.merch_name as string).toLowerCase()
        if (!hedefMap.has(k)) hedefMap.set(k, new Map())
        hedefMap.get(k)!.set(t.grup as string, (t.hedef as number) ?? 0)
      }

      // 4. Destek personeli × kategori satırları
      const rawRows: DestekPersonelRow[] = destekData.rows ?? []
      const computed: DestekPersonelRow[] = []

      for (const row of rawRows) {
        if (row.cetinler_merch === '-') { computed.push(row); continue }

        const mk         = row.cetinler_merch.toLowerCase()
        const kategoriMap = satisMap.get(mk)
        if (!kategoriMap?.size) { computed.push(row); continue }

        for (const [kategori, { satis_adedi, kosullu_prim_toplam }] of kategoriMap) {
          const hedef              = hedefMap.get(mk)?.get(kategori) ?? 0
          const hedef_gerceklesme  = hedef > 0 ? (satis_adedi / hedef) * 100 : 0
          const hak_edis           = kosullu_prim_toplam * (hedef_gerceklesme / 100)
          computed.push({
            merch_adi:           row.merch_adi,
            sube_adi:            row.sube_adi,
            cari_adi:            row.cari_adi,
            cetinler_merch:      row.cetinler_merch,
            kategori,
            hedef_gerceklesme,
            satis_adedi,
            kosullu_destek_prim: kosullu_prim_toplam,
            hak_edis,
          })
        }
      }

      computed.sort((a, b) => b.hak_edis - a.hak_edis)
      setRows(computed)
    } catch (e) {
      console.error('Destek personeli prim yükleme hatası:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [yil, ay, currentUserRole, bsyKod, currentUserName])

  // Filtre seçenekleri (tüm rows'tan unique değerler)
  const cariOptions   = useMemo(() => [...new Set(rows.map(r => r.cari_adi))].sort((a, b) => a.localeCompare(b, 'tr')), [rows])
  const merchOptions  = useMemo(() => [...new Set(rows.map(r => r.cetinler_merch).filter(m => m !== '-'))].sort((a, b) => a.localeCompare(b, 'tr')), [rows])

  const visibleRows = useMemo(() => rows.filter(r =>
    (!cariFilter   || r.cari_adi        === cariFilter) &&
    (!merchFilter  || r.cetinler_merch  === merchFilter)
  ), [rows, cariFilter, merchFilter])

  const toplamHakEdis = useMemo(() => visibleRows.reduce((sum, r) => sum + r.hak_edis, 0), [visibleRows])

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

        {/* Cari filtresi */}
        {cariOptions.length > 0 && (
          <div className="relative">
            <select
              value={cariFilter}
              onChange={e => setCariFilter(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none max-w-[200px]"
            >
              <option value="">Tüm Cariler</option>
              {cariOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Çetinler Merch filtresi */}
        {merchOptions.length > 0 && (
          <div className="relative">
            <select
              value={merchFilter}
              onChange={e => setMerchFilter(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none max-w-[160px]"
            >
              <option value="">Tüm Merch'ler</option>
              {merchOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        <div className="flex-1" />

        {!loading && rows.length > 0 && (
          <div className="text-xs text-gray-500">
            <span className="font-semibold">{visibleRows.length}</span> kişi
            <span className="mx-1">•</span>
            Toplam: <span className="font-bold text-brand-700">{toplamHakEdis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
          </div>
        )}
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        ) : visibleRows.length === 0 ? (
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
                  <th className="text-left px-4 py-2.5 font-semibold min-w-[120px]">Kategori</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[110px]">Hedef Gerçekleşme</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[100px]">Satış Adedi</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[130px]">Koşullu Destek Prim</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[120px] bg-brand-700">Hak Ediş</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
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
                    <td className="px-4 py-2 text-gray-700 font-medium">{row.kategori}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-blue-700">
                      {row.hedef_gerceklesme.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {row.satis_adedi.toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-800">
                      {row.kosullu_destek_prim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-brand-700 bg-brand-50">
                      {row.hak_edis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={9} className="px-4 py-3 text-right text-gray-700">
                    TOPLAM
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-700 bg-brand-100">
                    {toplamHakEdis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
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
