'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Edit2, Save, X, ChevronDown, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'

import { ADET_PRIM_DEFAULTS } from '@/lib/adet-prim-defaults'

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
      const r = await fetch(`/api/prim-ozel?yil=${yil}&ay=${ay}`)
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
              <th className="text-right px-3 py-2.5 font-semibold min-w-[120px]">Bayi Merch (₺)</th>
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

export function AdetPrimTablosu() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [view, setView] = useState<'genel' | 'ozel'>('genel')
  const [rows,    setRows]    = useState<PrimRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState<PrimRow[]>([])
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
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft([])
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
      const res = await fetch('/api/adet-prim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil, ay, rows: draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Kayıt hatası')
      setRows(draft)
      setEditing(false)
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
          <button onClick={load} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 ml-2 bg-gray-100 rounded-lg p-0.5">
          {(['genel','ozel'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-colors',
                view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              {v === 'genel' ? 'Genel Primler' : 'Özel Primler'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {view === 'genel' && (
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
        {view === 'ozel' ? (
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
              </tbody>
            </table>
          </div>
        )}
        </>}
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
}

export function BayiMerchHakdis() {
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
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50">
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
