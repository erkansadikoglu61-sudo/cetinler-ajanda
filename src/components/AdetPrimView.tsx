'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom'
import { RefreshCw, Edit2, Save, X, ChevronDown, Plus, Trash2, FileDown } from 'lucide-react'
import clsx from 'clsx'

import * as XLSX from 'xlsx'
import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'
import { generateAdetPrimPdf } from '@/lib/pdf'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// ─── MultiSelectBox ───────────────────────────────────────────────
// value === null  → "Tümü" (all)
// value === []    → nothing selected
// value === [...]  → specific items selected
function MultiSelectBox({
  options, value, onChange, placeholder, loading,
}: {
  options: string[]
  value: string[] | null
  onChange: (v: string[] | null) => void
  placeholder: string
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState('')
  const [pos,  setPos]  = useState({ top: 0, left: 0, width: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const btnRef  = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const inWrap = wrapRef.current?.contains(e.target as Node)
      const inDrop = dropRef.current?.contains(e.target as Node)
      if (!inWrap && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function openDropdown() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 288) })
    }
    setOpen(o => !o)
  }

  const isAll    = value === null
  const filtered = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options
  const label    = isAll ? 'Tümü' : value.length === 0 ? placeholder : `${value.length} seçili`

  function toggle(opt: string) {
    if (isAll) {
      onChange(options.filter(o => o !== opt))
    } else {
      const next = value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt]
      onChange(next.length === options.length ? null : next)
    }
  }

  const dropdown = open && !loading ? (
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col max-h-72"
    >
      {/* Arama */}
      <div className="p-2 border-b border-gray-100 flex-shrink-0">
        <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Ara…"
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400" />
      </div>
      <div className="overflow-y-auto flex-1">
        {/* Tümü */}
        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
          <input type="checkbox" checked={isAll} onChange={() => onChange(isAll ? [] : null)}
            className="w-3.5 h-3.5 rounded accent-brand-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700">Tümü</span>
        </label>
        {/* Seçenekler */}
        {filtered.map(opt => (
          <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox"
              checked={isAll || value.includes(opt)}
              onChange={() => toggle(opt)}
              className="w-3.5 h-3.5 rounded accent-brand-600 flex-shrink-0" />
            <span className="text-xs text-gray-700 truncate">{opt}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-3 text-xs text-gray-300 text-center">Sonuç yok</div>
        )}
      </div>
      {/* Footer: seçili sayı */}
      {!isAll && value.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] text-gray-500">{value.length} seçili</span>
          <button type="button" onClick={() => onChange(null)} className="text-[10px] text-brand-600 hover:underline">Tümünü seç</button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div ref={wrapRef} className="relative w-full">
      <button ref={btnRef} type="button" onClick={openDropdown} disabled={loading}
        className="flex items-center justify-between gap-1 w-full pl-2.5 pr-2 py-1 text-xs border border-gray-200 rounded-lg bg-white hover:border-brand-400 focus:outline-none disabled:opacity-50">
        <span className={clsx('truncate', isAll || (value && value.length > 0) ? 'text-gray-800' : 'text-gray-400')}>
          {loading ? 'Yükleniyor…' : label}
        </span>
        <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && !loading && typeof document !== 'undefined'
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  )
}

// ─── Adet Prim Tablosu ────────────────────────────────────────────
interface PrimRow {
  stokKodu:     string
  kategori:     string | null
  bayiMerch:    number | null
  kosulluDestek: number | null
}

// ─── Özel Prim Satırı ─────────────────────────────────────────────
interface OzelRow {
  id:              string
  stokKodu:        string[] | null   // null = Tümü
  grupKodu:        string[] | null   // null = Tümü
  yil:             number
  ay:              number
  tarihBaslangic:  string | null
  tarihBitis:      string | null
  cariAdi:         string[] | null   // null = Tümü
  subeAdi:         string[] | null   // null = Tümü
  bayiMerch:       number | null
  kosulluDestek:   number | null
  primCarpan:      number | null     // Standart primle çarpılır (ör: 2 = 2 katı prim)
}

const EMPTY_OZEL = (yil: number, ay: number): Omit<OzelRow,'id'> => ({
  stokKodu: null, grupKodu: null, yil, ay, tarihBaslangic: null, tarihBitis: null,
  cariAdi: null, subeAdi: null, bayiMerch: null, kosulluDestek: null, primCarpan: null,
})

// Helper: display an array value in read-only cells
function ArrayBadge({ val }: { val: string[] | null }) {
  if (val === null) return <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Tümü</span>
  if (val.length === 0) return <span className="text-gray-300">—</span>
  if (val.length === 1) return <span className="text-gray-700">{val[0]}</span>
  return (
    <span title={val.join(', ')} className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full cursor-help">
      {val.length} seçili
    </span>
  )
}

function OzelPrimler({ yil, ay }: { yil: number; ay: number }) {
  const [rows,         setRows]        = useState<OzelRow[]>([])
  const [loading,      setLoading]     = useState(false)
  const [adding,       setAdding]      = useState(false)
  const [newRow,       setNewRow]      = useState<Omit<OzelRow,'id'>>(EMPTY_OZEL(yil, ay))
  const [editId,       setEditId]      = useState<string | null>(null)
  const [editBuf,      setEditBuf]     = useState<Partial<OzelRow>>({})
  const [saving,       setSaving]      = useState(false)
  const [msg,          setMsg]         = useState<string | null>(null)
  const [cariOptions,  setCariOptions] = useState<string[]>([])
  const [subeOptions,  setSubeOptions] = useState<string[]>([])
  const [grupOptions,  setGrupOptions] = useState<string[]>([])
  const [grupStokMap,  setGrupStokMap] = useState<Record<string, string[]>>({})
  const [optsLoading,  setOptsLoading] = useState(false)

  const ALL_STOK_OPTIONS = ADET_PRIM_DEFAULTS.map(r => r.stokKodu)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/prim-ozel?yil=${yil}`)  // ay filtresi yok — tarih aralığı kısıtı satırda
      const d = await r.json()
      setRows((d.rows ?? []).map((x: Record<string,unknown>) => ({
        id: x.id, stokKodu: x.stok_kodu ?? null, grupKodu: x.grup_kodu ?? null,
        yil: x.yil, ay: x.ay,
        tarihBaslangic: x.tarih_baslangic, tarihBitis: x.tarih_bitis,
        cariAdi: x.cari_adi ?? null, subeAdi: x.sube_adi ?? null,
        bayiMerch: x.bayi_merch, kosulluDestek: x.kosullu_destek, primCarpan: x.prim_carpan ?? null,
      })))
    } finally { setLoading(false) }
  }, [yil, ay])

  useEffect(() => { load() }, [load])
  useEffect(() => { setNewRow(EMPTY_OZEL(yil, ay)) }, [yil, ay])

  // Load cari/şube options once
  useEffect(() => {
    setOptsLoading(true)
    fetch('/api/merch-options')
      .then(r => r.json())
      .then(d => {
        setCariOptions(d.cariOptions ?? [])
        setSubeOptions(d.subeOptions ?? [])
        setGrupOptions(d.grupOptions ?? [])
        setGrupStokMap(d.grupStokMap ?? {})
      })
      .finally(() => setOptsLoading(false))
  }, [])

  // Compute available stok options based on selected grup kodu
  function stokOptionsFor(grupKodu: string[] | null): string[] {
    if (grupKodu === null || grupKodu.length === 0) return ALL_STOK_OPTIONS
    const merged = new Set<string>()
    for (const g of grupKodu) {
      for (const s of (grupStokMap[g] ?? [])) merged.add(s)
    }
    return merged.size > 0 ? [...merged].sort() : ALL_STOK_OPTIONS
  }

  function numVal(v: number | null | undefined) { return v != null ? String(v) : '' }
  function parseNum(s: string) { const n = parseFloat(s); return isNaN(n) ? null : n }

  async function addRow() {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch('/api/prim-ozel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setRows(prev => [...prev, {
        id: d.row.id, stokKodu: d.row.stok_kodu ?? null, grupKodu: d.row.grup_kodu ?? null,
        yil: d.row.yil, ay: d.row.ay,
        tarihBaslangic: d.row.tarih_baslangic, tarihBitis: d.row.tarih_bitis,
        cariAdi: d.row.cari_adi ?? null, subeAdi: d.row.sube_adi ?? null,
        bayiMerch: d.row.bayi_merch, kosulluDestek: d.row.kosullu_destek, primCarpan: d.row.prim_carpan ?? null,
      }])
      setNewRow(EMPTY_OZEL(yil, ay)); setAdding(false); setMsg('✓ Eklendi')
    } catch (e) { setMsg('✗ ' + String(e)) }
    finally { setSaving(false) }
  }

  async function saveEdit(id: string) {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch(`/api/prim-ozel?id=${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBuf),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setRows(prev => prev.map(x => x.id === id ? { ...x, ...editBuf } as OzelRow : x))
      setEditId(null); setMsg('✓ Kaydedildi')
    } catch (e) { setMsg('✗ ' + String(e)) }
    finally { setSaving(false) }
  }

  async function deleteRow(id: string) {
    if (!confirm('Bu özel primi silmek istiyor musunuz?')) return
    setSaving(true)
    try {
      await fetch(`/api/prim-ozel?id=${id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(x => x.id !== id))
      setMsg('✓ Silindi')
    } finally { setSaving(false) }
  }

  const inputCls = 'px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 w-full'

  // Current values for edit buffer (falls back to row values)
  function eVal<K extends keyof OzelRow>(key: K, row: OzelRow): OzelRow[K] {
    return (key in editBuf ? editBuf[key] : row[key]) as OzelRow[K]
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">{rows.length} özel prim tanımı</span>
        {msg && (
          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border',
            msg.startsWith('✓') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
          )}>{msg}</span>
        )}
        <div className="flex-1" />
        <button onClick={() => { setAdding(true); setMsg(null) }} disabled={adding}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60">
          <Plus size={12} /> Yeni Ekle
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="text-xs border-collapse w-full bg-white">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left px-3 py-2.5 font-semibold min-w-[150px]">Grup Kodu</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[160px]">Stok Kodu</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[110px]">Başlangıç</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[110px]">Bitiş</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[180px]">Cari Adı</th>
              <th className="text-left px-3 py-2.5 font-semibold min-w-[160px]">Şube Adı</th>
              <th className="text-right px-3 py-2.5 font-semibold min-w-[130px]" title="Standart prim üstüne EKLENİR. Örn: 350 yazınca → standart(150) + 350 = 500₺">Ek Bayi Merch (₺)</th>
              <th className="text-right px-3 py-2.5 font-semibold min-w-[140px]">Koşullu Destek (₺)</th>
              <th className="text-center px-3 py-2.5 font-semibold min-w-[110px]" title="Standart prim oranıyla çarpılır. Örn: 2 = 2 katı prim">Prim Çarpanı ×</th>
              <th className="px-3 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {/* Yeni satır formu */}
            {adding && (
              <tr className="bg-brand-50 border-b border-brand-100">
                <td className="px-2 py-1.5">
                  <MultiSelectBox options={grupOptions} value={newRow.grupKodu}
                    onChange={v => setNewRow(p => ({ ...p, grupKodu: v, stokKodu: null }))} placeholder="Grup kodu seçin…" loading={optsLoading} />
                </td>
                <td className="px-2 py-1.5">
                  <MultiSelectBox options={stokOptionsFor(newRow.grupKodu)} value={newRow.stokKodu}
                    onChange={v => setNewRow(p => ({ ...p, stokKodu: v }))} placeholder="Stok kodu seçin…" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="date" value={newRow.tarihBaslangic ?? ''} onChange={e => setNewRow(p => ({ ...p, tarihBaslangic: e.target.value || null }))} className={inputCls} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="date" value={newRow.tarihBitis ?? ''} onChange={e => setNewRow(p => ({ ...p, tarihBitis: e.target.value || null }))} className={inputCls} />
                </td>
                <td className="px-2 py-1.5">
                  <MultiSelectBox options={cariOptions} value={newRow.cariAdi}
                    onChange={v => setNewRow(p => ({ ...p, cariAdi: v }))} placeholder="Cari seçin…" loading={optsLoading} />
                </td>
                <td className="px-2 py-1.5">
                  <MultiSelectBox options={subeOptions} value={newRow.subeAdi}
                    onChange={v => setNewRow(p => ({ ...p, subeAdi: v }))} placeholder="Şube seçin…" loading={optsLoading} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={numVal(newRow.bayiMerch)} onChange={e => setNewRow(p => ({ ...p, bayiMerch: parseNum(e.target.value) }))}
                    placeholder="—" className={inputCls + ' text-right'} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={numVal(newRow.kosulluDestek)} onChange={e => setNewRow(p => ({ ...p, kosulluDestek: parseNum(e.target.value) }))}
                    placeholder="—" className={inputCls + ' text-right'} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" step="0.1" min="0" value={numVal(newRow.primCarpan)} onChange={e => setNewRow(p => ({ ...p, primCarpan: parseNum(e.target.value) }))}
                    placeholder="—" className={inputCls + ' text-center'} title="Standart prim × bu sayı. Örn: 2 = 2 katı prim" />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1 justify-end">
                    <button onClick={addRow} disabled={saving} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"><Save size={11} /></button>
                    <button onClick={() => setAdding(false)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X size={11} /></button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400"><RefreshCw size={14} className="animate-spin inline mr-1" />Yükleniyor…</td></tr>
            ) : rows.length === 0 && !adding ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-300 text-[11px]">Henüz özel prim tanımı yok. "Yeni Ekle" ile başlayın.</td></tr>
            ) : rows.map((row, idx) => {
              const isEdit = editId === row.id
              return (
                <tr key={row.id} className={clsx('border-b border-gray-100 last:border-0', idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-3 py-2">
                    {isEdit
                      ? <MultiSelectBox options={grupOptions} value={eVal('grupKodu', row) as string[] | null}
                          onChange={v => setEditBuf(p => ({ ...p, grupKodu: v, stokKodu: null }))} placeholder="Grup seçin…" loading={optsLoading} />
                      : <ArrayBadge val={row.grupKodu} />}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit
                      ? <MultiSelectBox options={stokOptionsFor(eVal('grupKodu', row) as string[] | null)} value={eVal('stokKodu', row) as string[] | null}
                          onChange={v => setEditBuf(p => ({ ...p, stokKodu: v }))} placeholder="Stok seçin…" />
                      : <ArrayBadge val={row.stokKodu} />}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {isEdit
                      ? <input type="date" value={(eVal('tarihBaslangic', row) as string) ?? ''} onChange={e => setEditBuf(p => ({ ...p, tarihBaslangic: e.target.value || null }))} className={inputCls} />
                      : row.tarihBaslangic ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {isEdit
                      ? <input type="date" value={(eVal('tarihBitis', row) as string) ?? ''} onChange={e => setEditBuf(p => ({ ...p, tarihBitis: e.target.value || null }))} className={inputCls} />
                      : row.tarihBitis ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit
                      ? <MultiSelectBox options={cariOptions} value={eVal('cariAdi', row) as string[] | null}
                          onChange={v => setEditBuf(p => ({ ...p, cariAdi: v }))} placeholder="Cari seçin…" loading={optsLoading} />
                      : <ArrayBadge val={row.cariAdi} />}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit
                      ? <MultiSelectBox options={subeOptions} value={eVal('subeAdi', row) as string[] | null}
                          onChange={v => setEditBuf(p => ({ ...p, subeAdi: v }))} placeholder="Şube seçin…" loading={optsLoading} />
                      : <ArrayBadge val={row.subeAdi} />}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                    {isEdit
                      ? <input type="number" value={numVal(eVal('bayiMerch', row) as number | null)} onChange={e => setEditBuf(p => ({ ...p, bayiMerch: parseNum(e.target.value) }))} className={inputCls + ' text-right'} />
                      : row.bayiMerch != null ? `${row.bayiMerch} ₺` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-800">
                    {isEdit
                      ? <input type="number" value={numVal(eVal('kosulluDestek', row) as number | null)} onChange={e => setEditBuf(p => ({ ...p, kosulluDestek: parseNum(e.target.value) }))} className={inputCls + ' text-right'} />
                      : row.kosulluDestek != null ? `${row.kosulluDestek} ₺` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-800">
                    {isEdit
                      ? <input type="number" step="0.1" min="0" value={numVal(eVal('primCarpan', row) as number | null)} onChange={e => setEditBuf(p => ({ ...p, primCarpan: parseNum(e.target.value) }))} className={inputCls + ' text-center'} />
                      : row.primCarpan != null
                        ? <span className="font-bold text-violet-600">×{row.primCarpan}</span>
                        : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      {isEdit ? (
                        <>
                          <button onClick={() => saveEdit(row.id)} disabled={saving}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"><Save size={11} /></button>
                          <button onClick={() => setEditId(null)}
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X size={11} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => {
                            setEditId(row.id)
                            setEditBuf({ stokKodu: row.stokKodu, grupKodu: row.grupKodu, tarihBaslangic: row.tarihBaslangic, tarihBitis: row.tarihBitis, cariAdi: row.cariAdi, subeAdi: row.subeAdi, bayiMerch: row.bayiMerch, kosulluDestek: row.kosulluDestek, primCarpan: row.primCarpan })
                          }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Edit2 size={11} /></button>
                          <button onClick={() => deleteRow(row.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={11} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdetPrimTablosu({ isAdmin = false }: { isAdmin?: boolean }) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [view, setView] = useState<'genel' | 'ozel'>('genel')
  const [rows,    setRows]    = useState<PrimRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState<PrimRow[]>([])
  const [newRows, setNewRows] = useState<{ stokKodu: string; kategori: string; bayiMerch: string; kosulluDestek: string }[]>([])
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res  = await fetch(`/api/adet-prim?yil=${yil}&ay=${ay}`)
      const data = await res.json()
      setRows(data.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => { load() }, [load])

  function startEdit() {
    setDraft(rows.map(r => ({ ...r })))
    setNewRows([])
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft([])
    setNewRows([])
  }

  function addNewRow() {
    setNewRows(prev => [...prev, { stokKodu: '', kategori: '', bayiMerch: '', kosulluDestek: '' }])
  }

  function updateNewRow(idx: number, field: 'stokKodu' | 'kategori' | 'bayiMerch' | 'kosulluDestek', val: string) {
    setNewRows(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: val }))
  }

  function removeNewRow(idx: number) {
    setNewRows(prev => prev.filter((_, i) => i !== idx))
  }

  function updateDraft(idx: number, field: 'bayiMerch' | 'kosulluDestek', val: string) {
    setDraft(prev => prev.map((r, i) =>
      i !== idx ? r : { ...r, [field]: val === '' ? null : parseInt(val) || null }
    ))
  }

  async function saveEdit() {
    setSaving(true)
    setMsg(null)
    try {
      const validNew = newRows
        .filter(r => r.stokKodu.trim())
        .map(r => ({
          stokKodu:      r.stokKodu.trim().toUpperCase(),
          kategori:      r.kategori.trim() || null,
          bayiMerch:     r.bayiMerch !== '' ? parseInt(r.bayiMerch) || null : null,
          kosulluDestek: r.kosulluDestek !== '' ? parseInt(r.kosulluDestek) || null : null,
        }))
      const allRows = [...draft, ...validNew]
      const res = await fetch('/api/adet-prim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil, ay, rows: allRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Kayıt hatası')
      await load()
      setEditing(false)
      setNewRows([])
      setMsg('✓ Kaydedildi')
    } catch (e) {
      setMsg('✗ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const displayRows = editing ? draft : rows

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-bold text-gray-700">Adet Prim Tablosu</span>

        {/* Yıl */}
        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay */}
        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {view === 'genel' && (
          <>
            <button onClick={load} disabled={loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50" title="Yenile">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => generateAdetPrimPdf(displayRows, yil, ay)}
              disabled={loading || displayRows.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm disabled:opacity-50"
              title="PDF olarak indir"
            >
              <FileDown size={12} /> PDF
            </button>
          </>
        )}

        {/* Sub-tabs — Özel Primler sadece admin */}
        <div className="flex items-center gap-1 ml-2 bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setView('genel')}
            className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-colors',
              view === 'genel' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Genel Primler
          </button>
          {isAdmin && (
            <button onClick={() => setView('ozel')}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-colors',
                view === 'ozel' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              Özel Primler
            </button>
          )}
        </div>

        <div className="flex-1" />

        {view === 'genel' && isAdmin && (
          <>
            {msg && (
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border',
                msg.startsWith('✓') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
              )}>{msg}</span>
            )}
            {editing ? (
              <>
                <button onClick={cancelEdit}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
                  <X size={12} /> İptal
                </button>
                <button onClick={saveEdit} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60">
                  {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  Kaydet
                </button>
              </>
            ) : (
              <button onClick={startEdit} disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-60">
                <Edit2 size={12} /> Düzenle
              </button>
            )}
          </>
        )}
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'ozel' && isAdmin ? (
          <OzelPrimler yil={yil} ay={ay} />
        ) : null}
        {view === 'genel' && <>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs border-collapse w-full bg-white">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="text-left px-4 py-2.5 font-semibold w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Stok Kodu</th>
                  <th className="text-left px-4 py-2.5 font-semibold min-w-[150px]">Kategori</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[160px]">Bayi Merch (₺/adet)</th>
                  <th className="text-right px-4 py-2.5 font-semibold min-w-[200px]">Koşullu Destek Personeli (₺/adet)</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={row.stokKodu} className={clsx(
                    'border-b border-gray-100 last:border-0',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                  )}>
                    <td className="px-4 py-2 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2 font-mono font-semibold text-gray-800">{row.stokKodu}</td>
                    <td className="px-4 py-2 text-gray-700">{row.kategori ?? <span className="text-gray-300">—</span>}</td>

                    {editing ? (
                      <>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={row.bayiMerch ?? ''}
                            onChange={e => updateDraft(idx, 'bayiMerch', e.target.value)}
                            placeholder="—"
                            className="w-full text-right border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={row.kosulluDestek ?? ''}
                            onChange={e => updateDraft(idx, 'kosulluDestek', e.target.value)}
                            placeholder="—"
                            className="w-full text-right border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-800">
                          {row.bayiMerch != null ? `${row.bayiMerch.toLocaleString('tr-TR')} ₺` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-800">
                          {row.kosulluDestek != null ? `${row.kosulluDestek.toLocaleString('tr-TR')} ₺` : <span className="text-gray-300">—</span>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {editing && newRows.map((nr, idx) => (
                  <tr key={`new-${idx}`} className="border-b border-blue-100 bg-blue-50/40">
                    <td className="px-4 py-2 text-blue-300 font-mono">+</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={nr.stokKodu}
                        onChange={e => updateNewRow(idx, 'stokKodu', e.target.value.toUpperCase())}
                        placeholder="Stok Kodu"
                        className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-brand-400"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={nr.kategori}
                        onChange={e => updateNewRow(idx, 'kategori', e.target.value)}
                        className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-400 bg-white"
                      >
                        <option value="">— Seç —</option>
                        {[...new Set(displayRows.map(r => r.kategori).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr')).map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={nr.bayiMerch}
                        onChange={e => updateNewRow(idx, 'bayiMerch', e.target.value)}
                        placeholder="—"
                        className="w-full text-right border border-blue-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={nr.kosulluDestek}
                          onChange={e => updateNewRow(idx, 'kosulluDestek', e.target.value)}
                          placeholder="—"
                          className="flex-1 text-right border border-blue-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400"
                        />
                        <button onClick={() => removeNewRow(idx)} className="p-1 text-red-400 hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editing && (
              <button
                onClick={addNewRow}
                className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-brand-600 hover:text-brand-700 border border-dashed border-brand-300 rounded-xl hover:bg-brand-50 transition-colors"
              >
                <Plus size={13} /> Yeni Satır Ekle
              </button>
            )}
          </div>
        )}
        </>}
      </div>
    </div>
  )
}

// ─── Prim Ödeme Listesi ───────────────────────────────────────────
interface PrimOdemeRow {
  merchTipi: string
  merchAdi:  string
  hakedis:   number
  cariAdi:   string
  subeAdi:   string
  supAdi:    string   // çözümlenmiş supervisor adı (Jr.→parent, SV stripped)
  bsyKod:    string
  iban:      string
}

// "Ad Soyad SV" → "ad soyad" (normalize for comparison)
function normSupName(s: string): string {
  return (s || '').trim().replace(/\s+sv\s*$/i, '').trim().toLowerCase()
}

// Türkçe küçük harf + karakter sadeleştirme (eşleştirme için)
function normOdeme(s: string): string {
  return (s || '').toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ').trim()
}

// ─── Prim ödemesi YAPILMAYAN noktalar ──────────────────────────────
// Ödenecek Tutar hesabında dikkate alınır. Yeni istisna eklemek için
// buraya satır ekleyin.
//   cari  : cari adında geçmesi yeterli (kısmi eşleşme).
//   allow : verilirse YALNIZCA bu merch'lere ödeme yapılır; yoksa hiçbirine.
//   yil   : verilirse yalnızca bu yılda geçerli.
//   aylar : verilirse yalnızca bu aylarda geçerli (1-12).
const ODEME_ISTISNALARI: { cari: string; allow?: string[]; yil?: number; aylar?: number[] }[] = [
  { cari: 'uğurlu perakende' },                                     // tüm merch'ler → ödenmez
  { cari: 'kolay home', allow: ['Gülser Çevik', 'Fazilet Aydın'] }, // yalnızca bu ikisi ödenir
  { cari: 'çınarlar dtm', yil: 2026, aylar: [6, 7, 8] },            // Haz/Tem/Ağu 2026 → ödenmez
]

// IBAN'ı standart formata çevir: TR + 24 hane = 26 karakter, 4'erli gruplar
// "TR05 0006 4000 0017 0001 3382 25". Uzunluk 26 değilse/boşsa geçersiz say.
function formatIban(raw: string): { text: string; valid: boolean } {
  const cleaned = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length !== 26 || !cleaned.startsWith('TR')) {
    return { text: 'Hatalı veya Eksik IBAN', valid: false }
  }
  return { text: cleaned.match(/.{1,4}/g)?.join(' ') ?? cleaned, valid: true }
}

// Bir satır için ödenecek tutarı hesapla (istisna varsa 0, yoksa hakediş).
// yil/ay: dönem bazlı istisnalar için (ör. Çınarlar DTM Haz/Tem/Ağu 2026).
function hesaplaOdenecek(r: PrimOdemeRow, yil: number, ay: number): number {
  const cari = normOdeme(r.cariAdi)
  for (const k of ODEME_ISTISNALARI) {
    if (!cari.includes(normOdeme(k.cari))) continue
    if (k.yil != null && k.yil !== yil) continue
    if (k.aylar && !k.aylar.includes(ay)) continue
    if (!k.allow || k.allow.length === 0) return 0
    const merch = normOdeme(r.merchAdi)
    return k.allow.some(a => normOdeme(a) === merch) ? r.hakedis : 0
  }
  return r.hakedis
}

export function PrimOdemeListesi({
  supervisorFilter = null,
  bsyKodFilter = null,
}: {
  supervisorFilter?: string[] | null
  bsyKodFilter?: string | null
}) {
  const now = new Date()
  const [yil, setYil]         = useState(now.getFullYear())
  const [ay,  setAy]          = useState(now.getMonth() + 1)
  const [allRows, setAllRows] = useState<PrimOdemeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [supFilter,  setSupFilter]  = useState('')
  const [cariFilter, setCariFilter] = useState('')

  // Jr. adı (normalize) → parent Sup adı haritası (SV stripped)
  const jrToSupRef = useRef(new Map<string, string>())

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role, manager_id')
      .in('role', ['sup', 'jr'])
      .then(({ data }) => {
        if (!data) return
        const idToName = new Map<string, string>()
        for (const p of data) idToName.set(p.id as string, p.full_name as string)
        const map = new Map<string, string>()
        for (const p of data) {
          if (p.role === 'jr' && p.manager_id) {
            const parentName = idToName.get(p.manager_id as string) ?? ''
            if (parentName) {
              // key: normalized jr name → value: parent sup name (SV stripped)
              map.set(normSupName(p.full_name as string), parentName.replace(/\s+sv\s*$/i, '').trim())
            }
          }
        }
        jrToSupRef.current = map
      })
  }, [])

  // Jr. adını parent Sup adına çözümle; SV suffix'ini temizle
  function resolveSupName(rawName: string): string {
    const norm = normSupName(rawName)
    const parent = jrToSupRef.current.get(norm)
    if (parent) return parent
    return rawName.replace(/\s+sv\s*$/i, '').trim()
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [bayiRes, destekRes, detayRes] = await Promise.all([
        fetch(`/api/bayi-merch-prim?yil=${yil}&ay=${ay}`),
        fetch(`/api/destek-hakedis?yil=${yil}&ay=${ay}`),
        fetch('/api/merch-detay'),
      ])
      const [bayiData, destekData, detayData] = await Promise.all([bayiRes.json(), destekRes.json(), detayRes.json()])
      if (!bayiRes.ok) throw new Error(bayiData.error ?? 'Bayi Merch yükleme hatası')

      // normalize(merch_adi) → iban. Türkçe-karakter/büyük-küçük/boşluk
      // farklarından bağımsız eşleşme (İ/ı, ç, ş vb.).
      const ibanMap = new Map<string, string>()
      for (const d of (detayData.data ?? [])) {
        if (d.iban) ibanMap.set(normOdeme(d.merch_adi as string), d.iban as string)
      }

      const combined: PrimOdemeRow[] = []

      // Bayi Merch
      for (const r of (bayiData.rows ?? [])) {
        if ((r.primHakdis ?? 0) <= 0) continue
        combined.push({
          merchTipi: 'Bayi Merch',
          merchAdi:  r.bayiMerch,
          hakedis:   r.primHakdis,
          cariAdi:   r.cariAdi,
          subeAdi:   r.subeAdi,
          supAdi:    resolveSupName(r.supervizor ?? ''),
          bsyKod:    r.bsyKod ?? '',
          iban:      ibanMap.get(normOdeme(r.bayiMerch as string)) ?? '',
        })
      }

      // Destek Personeli
      for (const h of (destekData.rows ?? [])) {
        if ((h.hakedis ?? 0) <= 0) continue
        combined.push({
          merchTipi: 'Destek Personeli',
          merchAdi:  h.merch_adi,
          hakedis:   h.hakedis,
          cariAdi:   h.cari_adi,
          subeAdi:   h.sube_adi ?? '',
          supAdi:    resolveSupName(h.sup_adi ?? ''),
          bsyKod:    '',
          iban:      ibanMap.get(normOdeme(h.merch_adi as string)) ?? '',
        })
      }

      setAllRows(combined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yil, ay, bsyKodFilter])

  useEffect(() => { load() }, [load])

  // Dropdown seçenekleri: supAdi zaten çözümlenmiş; dedup by normalized name
  const supOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: string[] = []
    for (const r of allRows) {
      const key = normSupName(r.supAdi)
      if (r.supAdi && !seen.has(key)) {
        seen.add(key)
        opts.push(r.supAdi)
      }
    }
    return opts.sort((a, b) => a.localeCompare(b, 'tr'))
  }, [allRows])

  const filtered = allRows.filter(r => {
    if (bsyKodFilter !== null && r.bsyKod !== bsyKodFilter) return false
    if (supervisorFilter !== null) {
      const match = supervisorFilter.some(sf => normSupName(sf) === normSupName(r.supAdi))
      if (!match) return false
    }
    if (supFilter && normSupName(r.supAdi) !== normSupName(supFilter)) return false
    if (cariFilter && !r.cariAdi.toLowerCase().includes(cariFilter.toLowerCase())) return false
    return true
  })

  const toplamPrim = filtered.reduce((s, r) => s + r.hakedis, 0)
  const toplamOdenecek = filtered.reduce((s, r) => s + hesaplaOdenecek(r, yil, ay), 0)

  // Aynı Merch Adı + Cari İsmi'ne sahip (tekrar eden) satırları işaretle
  const dupKey = (r: PrimOdemeRow) => `${normOdeme(r.merchAdi)}||${normOdeme(r.cariAdi)}`
  const dupKeys = (() => {
    const cnt = new Map<string, number>()
    filtered.forEach(r => cnt.set(dupKey(r), (cnt.get(dupKey(r)) ?? 0) + 1))
    return new Set([...cnt.entries()].filter(([, c]) => c > 1).map(([k]) => k))
  })()

  function exportExcel() {
    const wsData = [
      ['#', 'Merch Tipi', 'Merch Adı', 'Hakediş (₺)', 'Ödenecek Tutar (₺)', 'Cari İsmi', 'Şube Adı', 'Süpervizör', 'IBAN'],
      ...filtered.map((r, i) => [
        i + 1,
        r.merchTipi,
        r.merchAdi,
        r.hakedis,
        hesaplaOdenecek(r, yil, ay),
        r.cariAdi,
        r.subeAdi || '',
        r.supAdi || '',
        formatIban(r.iban).text,
      ]),
      ['', '', 'TOPLAM', toplamPrim, toplamOdenecek, '', '', '', ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Hakediş (D) ve Ödenecek Tutar (E) kolonlarına sayı formatı uygula
    const numFmt = '#,##0.00'
    const dataRowCount = filtered.length + 2  // başlık + veri + toplam
    for (let row = 1; row < dataRowCount; row++) {
      for (const c of [3, 4]) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c })
        if (ws[cellRef]) ws[cellRef].z = numFmt
      }
    }

    ws['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
      { wch: 50 }, { wch: 22 }, { wch: 20 }, { wch: 30 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Prim Ödeme Listesi')
    XLSX.writeFile(wb, `Prim_Odeme_Listesi_${yil}_${String(ay).padStart(2,'0')}.xlsx`)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-700">Prim Ödeme Listesi</span>

        {/* Yıl */}
        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear()].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay */}
        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Süpervizör filtresi — admin ve BSY için dropdown */}
        {supervisorFilter === null && supOptions.length > 0 && (
          <div className="relative">
            <select value={supFilter} onChange={e => setSupFilter(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-700 focus:outline-none max-w-[220px]">
              <option value="">Tüm Süpervizörler</option>
              {supOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Cari İsmi filtresi */}
        <input
          type="text"
          value={cariFilter}
          onChange={e => setCariFilter(e.target.value)}
          placeholder="Cari İsmi ara…"
          className="pl-2.5 pr-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 w-44"
        />
        {cariFilter && (
          <button onClick={() => setCariFilter('')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={12} />
          </button>
        )}

        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50" title="Yenile">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        {!loading && filtered.length > 0 && (
          <>
            <span className="text-[10px] text-gray-400 ml-1">
              {filtered.length} satır · Toplam: {toplamPrim.toLocaleString('tr-TR')} ₺ · Ödenecek: <span className="text-emerald-600 font-semibold">{toplamOdenecek.toLocaleString('tr-TR')} ₺</span>
            </span>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm ml-1">
              <FileDown size={12} /> Excel
            </button>
          </>
        )}
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
            <p className="text-xs">Veriler çekiliyor, bu işlem 10–20 saniye sürebilir…</p>
          </div>
        ) : error ? (
          <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-400">
            {MONTHS_TR[ay - 1]} {yil} için prim ödemesi bulunamadı
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs border-collapse w-full bg-white">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="text-left px-3 py-2.5 font-semibold w-8">#</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[120px]">Merch Tipi</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[150px]">Merch Adı</th>
                  <th className="text-right px-3 py-2.5 font-semibold min-w-[130px]">Hakediş</th>
                  <th className="text-right px-3 py-2.5 font-semibold min-w-[140px]">Ödenecek Tutar</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[200px]">Cari İsmi</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[130px]">Şube Adı</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[140px]">Süpervizör</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[260px]">IBAN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const isDup = dupKeys.has(dupKey(row))
                  return (
                  <tr key={idx} className={clsx(
                    'border-b border-gray-100 last:border-0',
                    isDup
                      ? 'bg-amber-100 border-l-4 border-l-amber-500'
                      : row.merchTipi === 'Destek Personeli'
                        ? (idx % 2 === 0 ? 'bg-violet-50/40' : 'bg-violet-50/70')
                        : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')
                  )}>
                    <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        row.merchTipi === 'Destek Personeli'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-blue-100 text-blue-700'
                      )}>
                        {row.merchTipi}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {row.merchAdi}
                      {isDup && (
                        <span className="ml-2 text-[9px] font-bold text-amber-700 bg-amber-200 rounded px-1.5 py-0.5 align-middle"
                          title="Aynı Merch Adı + Cari İsmi birden fazla satırda">
                          TEKRAR
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">
                      {row.hakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </td>
                    {(() => {
                      const od = hesaplaOdenecek(row, yil, ay)
                      const kesildi = od < row.hakedis
                      return (
                        <td className={clsx(
                          'px-3 py-2 text-right tabular-nums font-bold',
                          kesildi ? 'text-red-500' : 'text-emerald-600'
                        )}
                        title={kesildi ? 'Bu noktaya prim ödemesi yapılmıyor' : undefined}
                        >
                          {od.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                      )
                    })()}
                    <td className="px-3 py-2 text-gray-800">{row.cariAdi}</td>
                    <td className="px-3 py-2 text-gray-700">{row.subeAdi || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.supAdi || '—'}</td>
                    {(() => {
                      const ib = formatIban(row.iban)
                      return (
                        <td className={clsx(
                          'px-3 py-2 text-[11px] tracking-wider whitespace-nowrap',
                          ib.valid ? 'font-mono text-gray-600' : 'font-semibold text-red-500'
                        )}>
                          {ib.text}
                        </td>
                      )
                    })()}
                  </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800 text-white text-[10px] font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Toplam</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">
                    {toplamPrim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-300">
                    {toplamOdenecek.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bayi Merch Prim Hakedişleri ──────────────────────────────────
interface HakdisRow {
  supervizor:  string
  cariAdi:     string
  subeAdi:     string
  bayiMerch:   string
  primHakdis:  number
  satisAdet:   number
  bsyKod:      string
}

export function BayiMerchHakdis({
  supervisorFilter = null,
  bsyKodFilter = null,
}: {
  supervisorFilter?: string[] | null   // null = tümü, dizi = sadece bu süpervizörler (Sup için)
  bsyKodFilter?: string | null          // BSY kodu (BSY rolü için)
}) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [rows,    setRows]    = useState<HakdisRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [cariQ,   setCariQ]   = useState('')
  const [subeQ,   setSubeQ]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/bayi-merch-prim?yil=${yil}&ay=${ay}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Yükleme hatası')
      setRows(data.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    // BSY kodu filtresi (BSY rolü — kendi bağlı carileri)
    if (bsyKodFilter !== null && r.bsyKod !== bsyKodFilter) return false
    // Süpervizör filtresi (Süpervizör rolü)
    if (supervisorFilter !== null && !supervisorFilter.includes(r.supervizor)) return false
    if (cariQ && !r.cariAdi.toLowerCase().includes(cariQ.toLowerCase())) return false
    if (subeQ && !r.subeAdi.toLowerCase().includes(subeQ.toLowerCase())) return false
    return true
  })

  const toplamPrim = filtered.reduce((s, r) => s + r.primHakdis, 0)
  const toplamAdet = filtered.reduce((s, r) => s + r.satisAdet, 0)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-700">Bayi Merch Prim Hakedişleri</span>

        {/* Yıl */}
        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear()].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Ay */}
        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50" title="Yenile">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* Cari Adı filtre */}
        <input
          type="text"
          value={cariQ}
          onChange={e => setCariQ(e.target.value)}
          placeholder="Cari Adı ara…"
          className="pl-2.5 pr-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 w-44"
        />

        {/* Şube Adı filtre */}
        <input
          type="text"
          value={subeQ}
          onChange={e => setSubeQ(e.target.value)}
          placeholder="Şube Adı ara…"
          className="pl-2.5 pr-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 w-36"
        />

        {(cariQ || subeQ) && (
          <button onClick={() => { setCariQ(''); setSubeQ('') }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={13} />
          </button>
        )}

        {!loading && rows.length > 0 && (
          <span className="text-[10px] text-gray-400 ml-1">
            {filtered.length}{filtered.length !== rows.length ? `/${rows.length}` : ''} satır · Toplam: {toplamPrim.toLocaleString('tr-TR')} ₺
          </span>
        )}
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
            <p className="text-xs">Veriler çekiliyor, bu işlem 10–20 saniye sürebilir…</p>
          </div>
        ) : error ? (
          <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-400">
            {MONTHS_TR[ay - 1]} {yil} için veri bulunamadı
          </div>
        ) : (
          <>
            {/* Detay Tablosu */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="text-xs border-collapse w-full bg-white">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left px-3 py-2.5 font-semibold w-6">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold min-w-[130px]">Supervizör</th>
                    <th className="text-left px-3 py-2.5 font-semibold min-w-[200px]">Cari Adı</th>
                    <th className="text-left px-3 py-2.5 font-semibold min-w-[130px]">Şube Adı</th>
                    <th className="text-left px-3 py-2.5 font-semibold min-w-[130px]">Bayi Merch</th>
                    <th className="text-right px-3 py-2.5 font-semibold min-w-[80px]">Satış Adet</th>
                    <th className="text-right px-3 py-2.5 font-semibold min-w-[130px]">Prim Hakedişi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={idx} className={clsx(
                      'border-b border-gray-100 last:border-0',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    )}>
                      <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.supervizor || '—'}</td>
                      <td className="px-3 py-2 text-gray-800 font-medium">{row.cariAdi}</td>
                      <td className="px-3 py-2 text-gray-700">{row.subeAdi || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.bayiMerch}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{row.satisAdet.toLocaleString('tr-TR')}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">
                        {row.primHakdis > 0
                          ? `${row.primHakdis.toLocaleString('tr-TR')} ₺`
                          : <span className="text-gray-300 font-normal">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800 text-white text-[10px] font-semibold">
                    <td className="px-3 py-2" colSpan={5}>Toplam</td>
                    <td className="px-3 py-2 text-right tabular-nums">{toplamAdet.toLocaleString('tr-TR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">
                      {toplamPrim.toLocaleString('tr-TR')} ₺
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Prim Analiz ─────────────────────────────────────────────────────────────

interface PrimAnalizRow {
  stokKodu:   string
  stokAdi:    string
  cariAdi:    string
  subeAdi:    string
  bsyKod:     string
  supervizor: string
  prim:       number
  marka:      'Electrolux' | 'Relux'
}

function fmtTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PrimAnalizView({
  supervisorFilter = null,
  bsyKodFilter = null,
}: {
  supervisorFilter?: string[] | null
  bsyKodFilter?: string | null
}) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<PrimAnalizRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/prim-analiz?yil=${yil}&ay=${ay}`)
      const data = await res.json()
      setRows(data.rows ?? [])
    } catch { setError('Veriler alınamadı') }
    finally  { setLoading(false) }
  }, [yil, ay])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (bsyKodFilter !== null && r.bsyKod !== bsyKodFilter) return false
      if (supervisorFilter !== null) {
        const norm = (s: string) => (s || '').trim().replace(/\s+sv\s*$/i, '').trim().toLowerCase()
        if (!supervisorFilter.some(sf => norm(sf) === norm(r.supervizor))) return false
      }
      return true
    })
  }, [rows, supervisorFilter, bsyKodFilter])

  // Cari bazında grupla
  const cariMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) m.set(r.cariAdi, (m.get(r.cariAdi) ?? 0) + r.prim)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  // BSY bazında grupla
  const bsyMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      const k = r.bsyKod || '—'
      m.set(k, (m.get(k) ?? 0) + r.prim)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  // Stok bazında grupla — Electrolux
  const elxMap = useMemo(() => {
    const m = new Map<string, { stokAdi: string; prim: number }>()
    for (const r of filtered.filter(r => r.marka === 'Electrolux')) {
      const ex = m.get(r.stokKodu)
      if (ex) ex.prim += r.prim
      else m.set(r.stokKodu, { stokAdi: r.stokAdi, prim: r.prim })
    }
    return [...m.entries()].sort((a, b) => b[1].prim - a[1].prim)
  }, [filtered])

  // Stok bazında grupla — Relux
  const reluxMap = useMemo(() => {
    const m = new Map<string, { stokAdi: string; prim: number }>()
    for (const r of filtered.filter(r => r.marka === 'Relux')) {
      const ex = m.get(r.stokKodu)
      if (ex) ex.prim += r.prim
      else m.set(r.stokKodu, { stokAdi: r.stokAdi, prim: r.prim })
    }
    return [...m.entries()].sort((a, b) => b[1].prim - a[1].prim)
  }, [filtered])

  const elxTotal   = elxMap.reduce((s, [, v]) => s + v.prim, 0)
  const reluxTotal = reluxMap.reduce((s, [, v]) => s + v.prim, 0)
  const cariTotal  = cariMap.reduce((s, [, v]) => s + v, 0)
  const bsyTotal   = bsyMap.reduce((s, [, v]) => s + v, 0)

  const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={yil}
          onChange={e => setYil(Number(e.target.value))}
          className="border rounded-lg px-2 py-1.5 text-sm"
        >
          {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={ay}
          onChange={e => setAy(Number(e.target.value))}
          className="border rounded-lg px-2 py-1.5 text-sm"
        >
          {MONTHS_TR.map((m, i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>
        {loading && <span className="text-xs text-gray-400">Yükleniyor…</span>}
        {error   && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {/* Row 1: Cari + BSY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cari bazında */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Cari Bazında Prim</h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Cari İsmi</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Hakediş (₺)</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Oran</th>
                </tr>
              </thead>
              <tbody>
                {cariMap.map(([cari, prim], i) => (
                  <tr key={cari} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-700">{cari}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtTL(prim)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {cariTotal > 0 ? `%${((prim / cariTotal) * 100).toFixed(1)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-100 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-gray-700">Toplam</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{fmtTL(cariTotal)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">%100</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* BSY bazında */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">BSY Bazında Prim</h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">BSY Kodu</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Hakediş (₺)</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Oran</th>
                </tr>
              </thead>
              <tbody>
                {bsyMap.map(([bsy, prim], i) => (
                  <tr key={bsy} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-700">{bsy}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtTL(prim)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {bsyTotal > 0 ? `%${((prim / bsyTotal) * 100).toFixed(1)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-100 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-gray-700">Toplam</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{fmtTL(bsyTotal)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">%100</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Electrolux + Relux stok bazında */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Electrolux */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Electrolux — Stok Bazında Prim</h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Stok Kodu</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Hakediş (₺)</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Oran</th>
                </tr>
              </thead>
              <tbody>
                {elxMap.map(([kod, { stokAdi, prim }], i) => (
                  <tr key={kod} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-700">
                      <span className="font-mono font-medium">{kod}</span>
                      {stokAdi && <span className="text-gray-400 block text-[10px] leading-tight">{stokAdi}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtTL(prim)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {elxTotal > 0 ? `%${((prim / elxTotal) * 100).toFixed(1)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-gray-700">Toplam</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{fmtTL(elxTotal)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">%100</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Relux */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Relux — Stok Bazında Prim</h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Stok Kodu</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Hakediş (₺)</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Oran</th>
                </tr>
              </thead>
              <tbody>
                {reluxMap.map(([kod, { stokAdi, prim }], i) => (
                  <tr key={kod} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-700">
                      <span className="font-mono font-medium">{kod}</span>
                      {stokAdi && <span className="text-gray-400 block text-[10px] leading-tight">{stokAdi}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtTL(prim)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {reluxTotal > 0 ? `%${((prim / reluxTotal) * 100).toFixed(1)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-gray-700">Toplam</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{fmtTL(reluxTotal)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">%100</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
