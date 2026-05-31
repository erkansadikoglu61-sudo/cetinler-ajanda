'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Edit2, Save, X, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// ─── Adet Prim Tablosu ────────────────────────────────────────────
interface PrimRow {
  stokKodu:     string
  bayiMerch:    number | null
  kosulluDestek: number | null
}

export function AdetPrimTablosu() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
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

        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="flex-1" />

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
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto p-4">
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

  const toplamPrim  = rows.reduce((s, r) => s + r.primHakdis, 0)
  const toplamAdet  = rows.reduce((s, r) => s + r.satisAdet, 0)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
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

        {!loading && rows.length > 0 && (
          <span className="text-[10px] text-gray-400 ml-2">
            {rows.length} satır · Toplam: {toplamPrim.toLocaleString('tr-TR')} ₺
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
                  {rows.map((row, idx) => (
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
