'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw, ChevronDown, Settings2, X, Save, Upload, SlidersHorizontal, ImagePlus } from 'lucide-react'
// Save intentionally kept for HedefModal
import clsx from 'clsx'
import { useBsyCiro, BRAND_KEYS, BrandKey } from '@/hooks/useBsyCiro'
import { useBsyHedef } from '@/hooks/useBsyHedef'
import { useBsyKisiHedef } from '@/hooks/useBsyKisiHedef'
import { BRAND_LABEL, calcBsyPrims, PRIM_EXCLUDED_BSYS, NEW_LAYOUT_BRANDS } from '@/lib/bsy'
import type { BsyBrandRow } from '@/hooks/useBsyCiro'
import { supabase } from '@/lib/supabase'

// ─── Sabitler ─────────────────────────────────────────────────
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const PRIM_BARAJI_PCT = 80

// ─── Format yardımcıları ───────────────────────────────────────
function fmtCur(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}
function parseCur(s: string): number {
  // "1.234.567,89" → 1234567.89
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

// ─── Parametreler Modalı ──────────────────────────────────────
function ParametrelerModal({ isAdmin, onClose }: { isAdmin: boolean; onClose: () => void }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('bsy_param_img')
    if (saved) setImgSrc(saved)
  }, [])

  function handleImgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const b64 = ev.target?.result as string
      setImgSrc(b64)
      localStorage.setItem('bsy_param_img', b64)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-brand-600" />
            <h2 className="text-sm font-bold text-gray-800">BSY Parametreleri</h2>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => imgRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium"
                >
                  <ImagePlus size={12} />
                  {imgSrc ? 'Görseli Değiştir' : 'PNG Ekle'}
                </button>
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* İçerik — tam genişlik görsel */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-50/40">
          {imgSrc ? (
            <img src={imgSrc} alt="BSY Parametreleri" className="max-w-full rounded-lg shadow-sm border border-gray-200" />
          ) : (
            <div className="flex flex-col items-center gap-3 mt-24 text-gray-300">
              <ImagePlus size={56} />
              <span className="text-sm font-medium text-gray-400">
                {isAdmin ? 'Henüz görsel eklenmemiş — "PNG Ekle" butonunu kullanın' : 'Henüz görsel eklenmemiş'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Hedef Giriş Modalı ────────────────────────────────────────
interface HedefModalProps {
  yil: number
  ay:  number
  initial: Record<BrandKey, { hedefCiro: number; toplamPrim: number }>
  saving: boolean
  onSave: (records: { brand: BrandKey; hedefCiro: number; toplamPrim: number }[]) => Promise<void>
  onClose: () => void
}

function HedefModal({ yil, ay, initial, saving, onSave, onClose }: HedefModalProps) {
  const [vals, setVals] = useState<Record<BrandKey, { hedefCiro: string; toplamPrim: string }>>(
    () => Object.fromEntries(
      BRAND_KEYS.map(b => [b, {
        hedefCiro:  initial[b].hedefCiro  > 0 ? initial[b].hedefCiro.toLocaleString('tr-TR')  : '',
        toplamPrim: initial[b].toplamPrim > 0 ? initial[b].toplamPrim.toLocaleString('tr-TR') : '',
      }])
    ) as Record<BrandKey, { hedefCiro: string; toplamPrim: string }>
  )

  function set(brand: BrandKey, field: 'hedefCiro' | 'toplamPrim', value: string) {
    setVals(v => ({ ...v, [brand]: { ...v[brand], [field]: value } }))
  }

  async function handleSave() {
    const records = BRAND_KEYS.map(b => ({
      brand:      b,
      hedefCiro:  parseCur(vals[b].hedefCiro),
      toplamPrim: parseCur(vals[b].toplamPrim),
    }))
    await onSave(records)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium">{MONTHS_TR[ay - 1]} {yil}</p>
            <h2 className="text-sm font-bold text-gray-800">BSY Hedef Girişi</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 space-y-4">
          {BRAND_KEYS.map(brand => (
            <div key={brand} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2">
                {BRAND_LABEL[brand]}
              </div>
              <div className="grid grid-cols-2 gap-3 p-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium block mb-1">Hedef Ciro (TL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vals[brand].hedefCiro}
                    onChange={e => set(brand, 'hedefCiro', e.target.value)}
                    placeholder="0"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 text-right"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium block mb-1">Toplam Prim (TL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vals[brand].toplamPrim}
                    onChange={e => set(brand, 'toplamPrim', e.target.value)}
                    placeholder="0"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 text-right"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60"
          >
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Yeni Layout (ay ≥ 5): Kişi Bazlı Hedef Giriş Modalı ─────
function KisiHedefModal({
  yil, ay, bsyAdlar, getKisiHedef, saving, onSave, onClose,
}: {
  yil:          number
  ay:           number
  bsyAdlar:     string[]
  getKisiHedef: (bsyAdi: string, brand: BrandKey) => { hedefCiro: number; hakedilenPrim: number | null }
  saving:       boolean
  onSave:       (
    hedefRows: { bsyAdi: string; brand: BrandKey; hedefCiro: number; hakedilenPrim: number | null }[],
    extraRows: { bsyAdi: string; markaCarp: number | null; tahsiatCarp: number | null }[]
  ) => Promise<void>
  onClose:      () => void
}) {
  const [vals, setVals] = useState<Record<string, { elxHedef: string; reluxHedef: string }>>(() => {
    const init: Record<string, { elxHedef: string; reluxHedef: string }> = {}
    bsyAdlar.forEach(bsy => {
      const elx   = getKisiHedef(bsy, 'ELECTROLUX')
      const relux = getKisiHedef(bsy, 'RELUX')
      init[bsy] = {
        elxHedef:   elx.hedefCiro   > 0 ? elx.hedefCiro.toLocaleString('tr-TR')   : '',
        reluxHedef: relux.hedefCiro > 0 ? relux.hedefCiro.toLocaleString('tr-TR') : '',
      }
    })
    return init
  })

  const set = (bsy: string, field: 'elxHedef' | 'reluxHedef', val: string) =>
    setVals(v => ({ ...v, [bsy]: { ...v[bsy], [field]: val } }))

  async function handleSave() {
    const hedefRows = bsyAdlar.flatMap(bsy => [
      { bsyAdi: bsy, brand: 'ELECTROLUX' as BrandKey, hedefCiro: parseCur(vals[bsy].elxHedef),   hakedilenPrim: null },
      { bsyAdi: bsy, brand: 'RELUX'       as BrandKey, hedefCiro: parseCur(vals[bsy].reluxHedef), hakedilenPrim: null },
    ])
    await onSave(hedefRows, [])
    onClose()
  }

  const inputCls = 'w-full text-right border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-400 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-medium">{MONTHS_TR[ay - 1]} {yil}</p>
            <h2 className="text-sm font-bold text-gray-800">BSY Hedef Girişi</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable table */}
        <div className="overflow-auto flex-1 p-3">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-600 px-3 py-2 text-left min-w-[155px]">BSY Adı</th>
                <th className="border border-gray-600 px-3 py-1.5 text-center min-w-[140px]">Electrolux Hedef Ciro</th>
                <th className="border border-gray-600 px-3 py-1.5 text-center min-w-[140px]">Relux Hedef Ciro</th>
              </tr>
            </thead>
            <tbody>
              {bsyAdlar.map((bsy, i) => (
                <tr key={bsy} className={clsx('border-b border-gray-100', i % 2 === 1 && 'bg-gray-50/50')}>
                  <td className="border border-gray-100 px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">
                    {bsy}
                  </td>
                  <td className="border border-gray-100 p-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={vals[bsy].elxHedef}
                      onChange={e => set(bsy, 'elxHedef', e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </td>
                  <td className="border border-gray-100 p-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={vals[bsy].reluxHedef}
                      onChange={e => set(bsy, 'reluxHedef', e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Yeni Layout (ay ≥ 5): Ana Tablo ──────────────────────────
const EMPTY_BRANDS = Object.fromEntries(
  BRAND_KEYS.map(b => [b, { gercCiro: 0 }])
) as Record<BrandKey, { gercCiro: number }>

function BsyKisiTable({
  yil, ay, bsyRows, allBsyNames, getKisiHedef, getKisiExtra,
}: {
  yil:          number
  ay:           number
  bsyRows:      BsyBrandRow[]
  allBsyNames:  string[]
  getKisiHedef: (bsyAdi: string, brand: BrandKey) => { hedefCiro: number; hakedilenPrim: number | null }
  getKisiExtra: (bsyAdi: string) => { markaCarp: number | null; tahsiatCarp: number | null }
}) {
  // Tüm BSY'leri birleştir: profiles listesi öncelikli, ciro verisi olmayanlar da görünür
  const ciroMap = new Map(bsyRows.map(r => [r.bsyAdi.toLocaleLowerCase('tr'), r]))
  const mergedRows: BsyBrandRow[] = (allBsyNames.length > 0 ? allBsyNames : bsyRows.map(r => r.bsyAdi))
    .map(name => ciroMap.get(name.toLocaleLowerCase('tr')) ?? {
      bsyAdi:         name,
      brands:         { ...EMPTY_BRANDS },
      toplamGercCiro: 0,
    })

  if (mergedRows.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">Bu döneme ait veri bulunamadı.</p>
  }

  // Alt toplam hesapları
  const totals = {
    elxHedef:    0, elxGerc: 0, elxPrim: 0,
    reluxHedef:  0, reluxGerc: 0, reluxPrim: 0,
    toplamHedef: 0, toplamGerc: 0, toplamPrim: 0,
  }
  mergedRows.forEach(row => {
    const elx   = getKisiHedef(row.bsyAdi, 'ELECTROLUX')
    const relux = getKisiHedef(row.bsyAdi, 'RELUX')
    totals.elxHedef    += elx.hedefCiro
    totals.elxGerc     += row.brands['ELECTROLUX'].gercCiro
    totals.elxPrim     += elx.hakedilenPrim ?? 0
    totals.reluxHedef  += relux.hedefCiro
    totals.reluxGerc   += row.brands['RELUX'].gercCiro
    totals.reluxPrim   += relux.hakedilenPrim ?? 0
    totals.toplamHedef += elx.hedefCiro + relux.hedefCiro
    totals.toplamGerc  += row.toplamGercCiro
    totals.toplamPrim  += (elx.hakedilenPrim ?? 0) + (relux.hakedilenPrim ?? 0)
  })

  const cellCls  = 'border-r border-gray-100 px-3 py-1.5 text-right tabular-nums'
  const pctCls   = 'border-r border-gray-100 px-3 py-1.5 text-center tabular-nums'
  const ftCellCls = 'border-r border-red-100 px-3 py-2 text-right tabular-nums text-[11px]'
  const ftPctCls  = 'border-r border-red-100 px-3 py-2 text-center tabular-nums text-[11px]'

  function OranCell({ gerc, hedef, className }: { gerc: number; hedef: number; className: string }) {
    const pct = hedef > 0 ? (gerc / hedef) * 100 : 0
    const ok  = pct >= 80
    return (
      <td className={clsx(className, hedef > 0 ? (ok ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold') : 'text-gray-300')}>
        {hedef > 0 ? fmtPct(pct) : '—'}
      </td>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="text-xs border-collapse min-w-max bg-white w-full">
        <thead className="sticky top-0 z-20">
          {/* Dönem başlığı */}
          <tr>
            <th colSpan={13} className="bg-red-600 text-white font-bold px-4 py-2 text-left text-sm">
              {yil}/{String(ay).padStart(2, '0')}
            </th>
          </tr>
          {/* Marka başlıkları */}
          <tr className="bg-gray-800 text-white">
            <th rowSpan={2} className="sticky left-0 z-30 bg-gray-800 border-r border-gray-600 px-4 py-2 text-left min-w-[155px]">
              Bsy Adı
            </th>
            {(['Electrolux', 'Relux', 'Toplam'] as const).map(label => (
              <th key={label} colSpan={4} className="border-r border-gray-600 px-3 py-2 text-center font-bold">
                {label}
              </th>
            ))}
          </tr>
          {/* Kolon etiketleri */}
          <tr className="bg-gray-700 text-white text-[10px]">
            {['Hedef', 'Gerç. Ciro', 'Gerç. Oranı', 'Hakedilen Prim',
              'Hedef', 'Gerç. Ciro', 'Gerç. Oranı', 'Hakedilen Prim',
              'Hedef', 'Gerç. Ciro', 'Gerç. Oranı', 'Hakedilen Prim'].map((col, i) => (
              <th key={i} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[100px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {mergedRows.map((row, idx) => {
            const elx       = getKisiHedef(row.bsyAdi, 'ELECTROLUX')
            const relux     = getKisiHedef(row.bsyAdi, 'RELUX')
            const extra     = getKisiExtra(row.bsyAdi)
            const elxGerc   = row.brands['ELECTROLUX'].gercCiro
            const reluxGerc = row.brands['RELUX'].gercCiro
            const topHedef  = elx.hedefCiro + relux.hedefCiro
            const topGerc   = row.toplamGercCiro
            const topPrim   = (elx.hakedilenPrim ?? 0) + (relux.hakedilenPrim ?? 0)

            return (
              <tr key={row.bsyAdi} className={clsx(
                'border-b border-gray-100 hover:bg-blue-50/20',
                idx % 2 === 1 && 'bg-gray-50/40'
              )}>
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                  {row.bsyAdi}
                </td>
                {/* ELECTROLUX */}
                <td className={cellCls + ' text-gray-700'}>{elx.hedefCiro > 0 ? fmtCur(elx.hedefCiro) : '—'}</td>
                <td className={cellCls + ' text-gray-800'}>{elxGerc !== 0 ? fmtCur(elxGerc) : '—'}</td>
                <OranCell gerc={elxGerc} hedef={elx.hedefCiro} className={pctCls} />
                <td className={cellCls + (elx.hakedilenPrim != null && elx.hakedilenPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                  {elx.hakedilenPrim != null ? fmtCur(elx.hakedilenPrim) : '—'}
                </td>
                {/* RELUX */}
                <td className={cellCls + ' text-gray-700'}>{relux.hedefCiro > 0 ? fmtCur(relux.hedefCiro) : '—'}</td>
                <td className={cellCls + ' text-gray-800'}>{reluxGerc !== 0 ? fmtCur(reluxGerc) : '—'}</td>
                <OranCell gerc={reluxGerc} hedef={relux.hedefCiro} className={pctCls} />
                <td className={cellCls + (relux.hakedilenPrim != null && relux.hakedilenPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                  {relux.hakedilenPrim != null ? fmtCur(relux.hakedilenPrim) : '—'}
                </td>
                {/* TOPLAM */}
                <td className={cellCls + ' font-semibold text-gray-700'}>{topHedef > 0 ? fmtCur(topHedef) : '—'}</td>
                <td className={cellCls + ' font-semibold text-gray-800'}>{topGerc !== 0 ? fmtCur(topGerc) : '—'}</td>
                <OranCell gerc={topGerc} hedef={topHedef} className={pctCls + ' font-semibold'} />
                <td className={cellCls + (topPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                  {topPrim > 0 ? fmtCur(topPrim) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* Genel Toplam */}
        <tfoot>
          <tr className="bg-red-50 border-t-2 border-red-300 font-semibold text-[11px]">
            <td className="sticky left-0 z-10 bg-red-50 border-r border-red-200 px-4 py-2 text-red-700">Genel Toplam</td>
            {/* ELECTROLUX */}
            <td className={ftCellCls + ' text-gray-700'}>{totals.elxHedef > 0 ? fmtCur(totals.elxHedef) : '—'}</td>
            <td className={ftCellCls + ' text-red-700'}>{fmtCur(totals.elxGerc)}</td>
            <td className={clsx(ftPctCls, totals.elxHedef > 0 ? ((totals.elxGerc / totals.elxHedef) * 100 >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
              {totals.elxHedef > 0 ? fmtPct((totals.elxGerc / totals.elxHedef) * 100) : '—'}
            </td>
            <td className={ftCellCls + (totals.elxPrim > 0 ? ' text-green-700' : ' text-gray-300')}>
              {totals.elxPrim > 0 ? fmtCur(totals.elxPrim) : '—'}
            </td>
            {/* RELUX */}
            <td className={ftCellCls + ' text-gray-700'}>{totals.reluxHedef > 0 ? fmtCur(totals.reluxHedef) : '—'}</td>
            <td className={ftCellCls + ' text-red-700'}>{fmtCur(totals.reluxGerc)}</td>
            <td className={clsx(ftPctCls, totals.reluxHedef > 0 ? ((totals.reluxGerc / totals.reluxHedef) * 100 >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
              {totals.reluxHedef > 0 ? fmtPct((totals.reluxGerc / totals.reluxHedef) * 100) : '—'}
            </td>
            <td className={ftCellCls + (totals.reluxPrim > 0 ? ' text-green-700' : ' text-gray-300')}>
              {totals.reluxPrim > 0 ? fmtCur(totals.reluxPrim) : '—'}
            </td>
            {/* TOPLAM */}
            <td className={ftCellCls + ' text-gray-700'}>{totals.toplamHedef > 0 ? fmtCur(totals.toplamHedef) : '—'}</td>
            <td className={ftCellCls + ' text-red-700 font-bold'}>{fmtCur(totals.toplamGerc)}</td>
            <td className={clsx(ftPctCls, totals.toplamHedef > 0 ? ((totals.toplamGerc / totals.toplamHedef) * 100 >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
              {totals.toplamHedef > 0 ? fmtPct((totals.toplamGerc / totals.toplamHedef) * 100) : '—'}
            </td>
            <td className={ftCellCls + (totals.toplamPrim > 0 ? ' text-green-700' : ' text-gray-300')}>
              {totals.toplamPrim > 0 ? fmtCur(totals.toplamPrim) : '—'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── BsyView Bileşeni ─────────────────────────────────────────
export function BsyView({ isAdmin = false, isBsy = false }: { isAdmin?: boolean; isBsy?: boolean }) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [showModal,       setShowModal]       = useState(false)
  const [showKisiModal,   setShowKisiModal]   = useState(false)
  const [showParamModal,  setShowParamModal]  = useState(false)
  const [uploading,       setUploading]       = useState(false)
  const [uploadMsg,     setUploadMsg]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Supabase'den tüm BSY profillerini çek (modal için tam liste)
  const [allBsyNames, setAllBsyNames] = useState<string[]>([])
  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name')
      .eq('role', 'bsy')
      .order('full_name')
      .then(({ data }) => {
        if (data) setAllBsyNames(data.map((p: { full_name: string }) => p.full_name))
      })
  }, [])

  const isYeniLayout = ay >= 5

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/bsy-excel-upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Yükleme hatası')
      setUploadMsg('✓ Yüklendi, veriler güncellendi')
      reload()
    } catch (err) {
      setUploadMsg('✗ ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const {
    bsyRows, brandTotals, genelToplamGercCiro,
    yillar, loading, error, source, reload,
  } = useBsyCiro(yil, ay)

  const {
    hedefMap, loading: hedefLoading, saving, reload: reloadHedef, save,
  } = useBsyHedef(yil, ay)

  const {
    loading:      kisiLoading,
    saving:       kisiSaving,
    reload:       reloadKisi,
    getKisiHedef,
    getKisiExtra,
    save:         saveKisi,
    error:        kisiError,
  } = useBsyKisiHedef(yil, ay)

  // Özet satırları
  const summary = useMemo(() => BRAND_KEYS.map(brand => {
    const h = hedefMap[brand]
    const gercCiro  = brandTotals[brand]
    const hedefCiro = h.hedefCiro
    const brandRate = hedefCiro > 0 ? gercCiro / hedefCiro : 0
    // Havuzdaki prim = gerçOranı × toplamPrim (%100'de sınırlanır)
    const havuzdakiPrim = brandRate >= 0.80 ? Math.min(brandRate, 1.0) * h.toplamPrim : 0
    return {
      brand,
      hedefCiro,
      gercCiro,
      toplamPrim:    h.toplamPrim,
      havuzdakiPrim,
      brandRate,
    }
  }), [hedefMap, brandTotals])

  const toplamHedef       = summary.reduce((s, r) => s + r.hedefCiro, 0)
  const toplamGercCiro    = genelToplamGercCiro
  const toplamGercPct     = toplamHedef > 0 ? (toplamGercCiro / toplamHedef) * 100 : 0
  const toplamHavuzdaki   = summary.reduce((s, r) => s + r.havuzdakiPrim, 0)

  // Prim hesapla
  const hedeflerArr = BRAND_KEYS.map(b => hedefMap[b])
  const primResults = useMemo(
    () => calcBsyPrims(bsyRows, brandTotals, hedeflerArr, genelToplamGercCiro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bsyRows, brandTotals, genelToplamGercCiro, hedefMap]
  )

  // BSY detay satırları
  const bsyTableRows = useMemo(() =>
    bsyRows.map(r => {
      const prim = primResults[r.bsyAdi] ?? { brands: {} as Record<BrandKey, number>, specialPrim: 0, toplam: 0 }
      const cols = BRAND_KEYS.map(b => {
        const gt  = brandTotals[b]
        const gc  = r.brands[b].gercCiro
        const pay = gt > 0 ? (gc / gt) * 100 : 0
        return { gercCiro: gc, pay, hakedilen: prim.brands[b] ?? 0 }
      })
      const toplamPay = toplamGercCiro > 0 ? (r.toplamGercCiro / toplamGercCiro) * 100 : 0
      return {
        bsyAdi: r.bsyAdi,
        cols,
        toplamGercCiro:  r.toplamGercCiro,
        toplamPay,
        specialPrim:     prim.specialPrim,
        toplamHakedilen: prim.toplam,
      }
    }),
    [bsyRows, brandTotals, toplamGercCiro, primResults]
  )

  const yilOptions = yillar.length
    ? yillar
    : [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Üst Bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">BSY Hedef Takip</span>

        {/* Yıl */}
        <div className="relative">
          <select
            value={yil}
            onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
          >
            {yilOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay */}
        <div className="relative">
          <select
            value={ay}
            onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
          >
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => { reload(); reloadHedef(); reloadKisi() }}
          disabled={loading || hedefLoading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw size={14} className={(loading || hedefLoading) ? 'animate-spin' : ''} />
        </button>

        {source === 'empty' && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Excel bağlantısı yok
          </span>
        )}

        <div className="flex-1" />

        {/* Admin butonları */}
        {isAdmin && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-60"
            >
              {uploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Yükleniyor…' : 'Excel Güncelle'}
            </button>

            <button
              onClick={() => isYeniLayout ? setShowKisiModal(true) : setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              <Settings2 size={12} />
              Hedef Gir
            </button>

          </>
        )}

        {/* Parametreler — admin ve BSY görebilir */}
        {(isAdmin || isBsy) && (
          <button
            onClick={() => setShowParamModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm"
          >
            <SlidersHorizontal size={12} />
            Parametreler
          </button>
        )}

        {uploadMsg && (
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full border',
            uploadMsg.startsWith('✓')
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-red-700 bg-red-50 border-red-200'
          )}>
            {uploadMsg}
          </span>
        )}

        {!loading && bsyRows.length > 0 && (
          <span className="text-[10px] text-gray-400">
            {bsyRows.length} BSY · {MONTHS_TR[ay - 1]} {yil}
          </span>
        )}
      </div>

      {/* Yükleniyor */}
      {(loading || hedefLoading || kisiLoading) && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin mr-2" /> Veriler yükleniyor…
        </div>
      )}

      {/* Hata */}
      {!loading && !hedefLoading && !kisiLoading && (error || kisiError) && (
        <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
          {error && <div>{error}</div>}
          {kisiError && <div>Kişi hedef hatası: {kisiError}</div>}
        </div>
      )}

      {!loading && !hedefLoading && !kisiLoading && !error && !kisiError && (
        <div className="flex-1 overflow-auto p-4 space-y-4">

          {/* ══════════════════════════════════════════════════
               YENİ LAYOUT (ay ≥ 5) — Kişi Bazlı Tablo
          ══════════════════════════════════════════════════ */}
          {isYeniLayout && (
            <BsyKisiTable
              yil={yil}
              ay={ay}
              bsyRows={bsyRows}
              allBsyNames={allBsyNames}
              getKisiHedef={getKisiHedef}
              getKisiExtra={getKisiExtra}
            />
          )}

          {/* ══════════════════════════════════════════════════
               ESKİ LAYOUT (ay < 5) — Özet + BSY Detay
          ══════════════════════════════════════════════════ */}
          {!isYeniLayout && (
          <>

          {/* ── 1. Özet Tablo ───────────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[640px] bg-white rounded-xl shadow-sm overflow-hidden">
              <thead>
                <tr>
                  <th className="w-[148px] border border-gray-200 bg-gray-100" />
                  {BRAND_KEYS.map(b => (
                    <th key={b} className="border border-gray-300 bg-gray-800 text-white font-bold py-2 px-4 text-center">
                      {BRAND_LABEL[b]}
                    </th>
                  ))}
                  <th className="border border-gray-300 bg-gray-800 text-white font-bold py-2 px-4 text-center">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Hedef Ciro */}
                <SummaryRow label="Hedef Ciro">
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">
                      {fmtCur(s.hedefCiro)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">
                    {fmtCur(toplamHedef)}
                  </td>
                </SummaryRow>

                {/* Gerç. Ciro */}
                <SummaryRow label="Gerç. Ciro" shaded>
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center text-gray-800">
                      {fmtCur(s.gercCiro)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center text-gray-800">
                    {fmtCur(toplamGercCiro)}
                  </td>
                </SummaryRow>

                {/* Gerç. Oranı */}
                <SummaryRow label="Gerç. Oranı">
                  {summary.map(s => {
                    const pct = s.hedefCiro > 0 ? (s.gercCiro / s.hedefCiro) * 100 : 0
                    const ok  = pct >= PRIM_BARAJI_PCT
                    return (
                      <td key={s.brand} className={clsx(
                        'border border-gray-200 px-3 py-2 text-center font-semibold',
                        ok ? 'text-green-600' : 'text-red-500'
                      )}>
                        {fmtPct(pct)}
                      </td>
                    )
                  })}
                  <td className={clsx(
                    'border border-gray-200 px-3 py-2 text-center font-semibold',
                    toplamGercPct >= PRIM_BARAJI_PCT ? 'text-green-600' : 'text-red-500'
                  )}>
                    {fmtPct(toplamGercPct)}
                  </td>
                </SummaryRow>

                {/* Toplam Prim */}
                <SummaryRow label="Toplam Prim" shaded>
                  {summary.map(s => (
                    <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center font-bold text-gray-800">
                      {fmtCur(s.toplamPrim)}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-3 py-2 text-center font-bold text-gray-800">
                    {fmtCur(summary.reduce((a, s) => a + s.toplamPrim, 0))}
                  </td>
                </SummaryRow>

                {/* Havuzdaki Prim */}
                <SummaryRow label="Havuzdaki Prim">
                  {summary.map(s => (
                    <td key={s.brand} className={clsx(
                      'border border-gray-200 px-3 py-2 text-center font-medium',
                      s.havuzdakiPrim > 0 ? 'text-green-600' : 'text-gray-400'
                    )}>
                      {fmtCur(s.havuzdakiPrim)}
                    </td>
                  ))}
                  <td className={clsx(
                    'border border-gray-200 px-3 py-2 text-center font-medium',
                    toplamHavuzdaki > 0 ? 'text-green-600' : 'text-gray-400'
                  )}>
                    {fmtCur(toplamHavuzdaki)}
                  </td>
                </SummaryRow>

                {/* Prim Barajı */}
                <tr className="bg-green-50">
                  <td className="border border-green-200 bg-green-100 px-3 py-2 font-semibold text-green-800">Prim Barajı</td>
                  {BRAND_KEYS.map(b => (
                    <td key={b} className="border border-green-200 px-3 py-2 text-center font-semibold text-green-700">
                      %{PRIM_BARAJI_PCT},00
                    </td>
                  ))}
                  <td className="border border-green-200 px-3 py-2 text-center font-semibold text-green-700">
                    {fmtPct(toplamGercPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── 2. Dönem Banner ─────────────────────────────── */}
          <div className="overflow-x-auto">
            <div className="min-w-[640px] bg-red-600 text-white rounded-lg px-4 py-2 flex items-center gap-4 text-sm font-bold">
              <span className="bg-white/20 rounded px-2 py-0.5">{yil}</span>
              <span className="bg-white/20 rounded px-2 py-0.5">{ay}</span>
              <span>{MONTHS_TR[ay - 1]}</span>
              <span className="flex-1 text-center">Prim Ciro Barajı</span>
              <span>%{PRIM_BARAJI_PCT}</span>
              <span className="ml-auto">{fmtCur(toplamHedef)}</span>
            </div>
          </div>

          {/* ── 3. BSY Detay Tablosu ────────────────────────── */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs border-collapse min-w-max bg-white w-full">
              <thead className="sticky top-0 z-20">
                {/* Marka başlıkları */}
                <tr className="bg-gray-800 text-white">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 bg-gray-800 border-r border-gray-600 px-4 py-2 text-left min-w-[150px]"
                  >
                    Bsy Adı
                  </th>
                  {BRAND_KEYS.map(b => (
                    <th key={b} colSpan={3} className="border-r border-gray-600 px-3 py-2 text-center font-bold">
                      {BRAND_LABEL[b]}
                    </th>
                  ))}
                  <th colSpan={3} className="px-3 py-2 text-center font-bold">Toplam</th>
                </tr>
                {/* Kolon etiketleri */}
                <tr className="bg-gray-700 text-white text-[10px]">
                  {([...BRAND_KEYS, 'TOPLAM'] as const).map(b => (
                    <>
                      <th key={`${b}-gc`}  className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[110px]">Gerç. Ciro</th>
                      <th key={`${b}-pay`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[90px]">Gerç. Cirodaki Payı</th>
                      <th key={`${b}-hak`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[100px]">Hakedilen Prim</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bsyTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={1 + (BRAND_KEYS.length + 1) * 3} className="py-12 text-center text-gray-400">
                      {source === 'empty'
                        ? 'Excel dosyasına erişilemiyor. BSY_EXCEL_PATH env veya lokal geliştirme ortamında çalışır.'
                        : 'Bu döneme ait veri bulunamadı.'}
                    </td>
                  </tr>
                ) : (
                  bsyTableRows.map((r, i) => {
                    const excluded = PRIM_EXCLUDED_BSYS.some(
                      name => r.bsyAdi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')
                    )
                    return (
                    <tr key={r.bsyAdi} className={clsx(
                      'border-b border-gray-100 hover:bg-blue-50/20',
                      i % 2 === 1 && 'bg-gray-50/40',
                      excluded && 'opacity-60'
                    )}>
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                        <span className={excluded ? 'italic text-gray-500' : ''}>{r.bsyAdi}</span>
                        {excluded && (
                          <span className="ml-1.5 text-[9px] bg-gray-200 text-gray-500 rounded px-1 py-0.5 font-normal not-italic">prim yok</span>
                        )}
                      </td>
                      {r.cols.map((c, ci) => (
                        <>
                          <td key={`${r.bsyAdi}-${ci}-gc`} className="border-r border-gray-100 px-3 py-1.5 text-right text-gray-800">
                            {c.gercCiro !== 0 ? fmtCur(c.gercCiro) : '—'}
                          </td>
                          <td key={`${r.bsyAdi}-${ci}-p`} className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-600">
                            {fmtPct(c.pay)}
                          </td>
                          <td key={`${r.bsyAdi}-${ci}-h`} className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-300">
                            {excluded ? '—' : c.hakedilen > 0 ? <span className="text-green-600 font-medium">{fmtCur(c.hakedilen)}</span> : '—'}
                          </td>
                        </>
                      ))}
                      {/* Toplam sütunlar */}
                      <td className="border-r border-gray-100 px-3 py-1.5 text-right font-semibold text-gray-800">
                        {fmtCur(r.toplamGercCiro)}
                      </td>
                      <td className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-600">
                        {fmtPct(r.toplamPay)}
                      </td>
                      <td className={clsx(
                        'px-3 py-1.5 text-right font-semibold',
                        excluded ? 'text-gray-300' :
                        r.toplamHakedilen > 0 ? 'text-green-600' : r.specialPrim > 0 ? 'text-amber-600' : 'text-gray-300'
                      )}>
                        {excluded ? '—' : r.toplamHakedilen > 0
                          ? fmtCur(r.toplamHakedilen)
                          : r.specialPrim > 0
                            ? fmtCur(r.specialPrim)
                            : '—'}
                      </td>
                    </tr>
                  )})
                )}

                {/* Genel Toplam */}
                {bsyTableRows.length > 0 && (
                  <tr className="bg-red-50 border-t-2 border-red-300 font-semibold text-[11px]">
                    <td className="sticky left-0 z-10 bg-red-50 border-r border-red-200 px-4 py-2 text-red-700">
                      Genel Toplam
                    </td>
                    {BRAND_KEYS.map(b => {
                      const gc  = brandTotals[b]
                      // Oranların toplamı: bireysel BSY paylarının aritmetik toplamı
                      const pct = bsyTableRows.reduce((s, r) => s + r.cols[BRAND_KEYS.indexOf(b)].pay, 0)
                      const totalHak = bsyTableRows
                        .filter(r => !PRIM_EXCLUDED_BSYS.some(
                          name => r.bsyAdi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')
                        ))
                        .reduce((s, r) => s + (r.cols[BRAND_KEYS.indexOf(b)]?.hakedilen ?? 0), 0)
                      return (
                        <>
                          <td key={`gt-${b}-gc`} className="border-r border-red-100 px-3 py-2 text-right text-gray-800">{fmtCur(gc)}</td>
                          <td key={`gt-${b}-p`}  className="border-r border-red-100 px-3 py-2 text-center text-gray-700">{fmtPct(pct)}</td>
                          <td key={`gt-${b}-h`}  className="border-r border-red-100 px-3 py-2 text-right text-green-700 font-bold">
                            {totalHak > 0 ? fmtCur(totalHak) : '—'}
                          </td>
                        </>
                      )
                    })}
                    <td className="border-r border-red-100 px-3 py-2 text-right text-red-700 font-bold">{fmtCur(toplamGercCiro)}</td>
                    <td className="border-r border-red-100 px-3 py-2 text-center text-red-700">{fmtPct(100)}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-bold">
                      {(() => {
                        const total = bsyTableRows
                          .filter(r => !PRIM_EXCLUDED_BSYS.some(
                            name => r.bsyAdi.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')
                          ))
                          .reduce((s, r) => s + r.toplamHakedilen, 0)
                        return total > 0 ? fmtCur(total) : '—'
                      })()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          </> /* /isYeniLayout === false */
          )}

        </div>
      )}

      {/* ── Eski Hedef Giriş Modalı (ay < 5) ───────────────────── */}
      {showModal && !isYeniLayout && (
        <HedefModal
          yil={yil}
          ay={ay}
          initial={Object.fromEntries(
            BRAND_KEYS.map(b => [b, { hedefCiro: hedefMap[b].hedefCiro, toplamPrim: hedefMap[b].toplamPrim }])
          ) as Record<BrandKey, { hedefCiro: number; toplamPrim: number }>}
          saving={saving}
          onSave={save}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Yeni Kişi Bazlı Hedef Modalı (ay ≥ 5) ─────────────── */}
      {showKisiModal && isYeniLayout && (
        <KisiHedefModal
          yil={yil}
          ay={ay}
          bsyAdlar={allBsyNames.length > 0 ? allBsyNames : bsyRows.map(r => r.bsyAdi)}
          getKisiHedef={getKisiHedef}
          saving={kisiSaving}
          onSave={saveKisi}
          onClose={() => setShowKisiModal(false)}
        />
      )}

      {/* ── Parametreler Modalı ─────────────────────────────────── */}
      {showParamModal && (
        <ParametrelerModal isAdmin={isAdmin} onClose={() => setShowParamModal(false)} />
      )}
    </div>
  )
}

// ─── Yardımcı bileşen: Özet tablo satırı ──────────────────────
function SummaryRow({
  label, shaded = false, children,
}: {
  label:    string
  shaded?:  boolean
  children: React.ReactNode
}) {
  return (
    <tr className={shaded ? 'bg-gray-50/50' : ''}>
      <td className="border border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
        {label}
      </td>
      {children}
    </tr>
  )
}
