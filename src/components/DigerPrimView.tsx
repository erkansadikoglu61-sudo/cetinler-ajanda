'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Save, X, ChevronDown, Plus, Trash2, Search } from 'lucide-react'
import clsx from 'clsx'
import { normalizeName } from '@/lib/sellout'

// ─── Primler ▸ Diğer ──────────────────────────────────────────────
// Manuel prim hakediş girişi (yalnızca admin). Dönem bazlı satırlar:
// Kullanıcı Adı · Grubu · Cari Adı · Şube (modal ile seçilir) · Görevi · Şubenin Adeti · Hakediş.
// Kullanıcı adı personel listesinde (/api/merch-detay) varsa grup + cari + şube otomatik dolar.
// Şubenin Adeti otomatik: dönemde o şubenin toplam satış adedi (/api/diger-prim subeAdet).
// Veri: /api/diger-prim (diger_prim tablosu). Cari/şube listesi: /api/bsy-cari-sube.

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const GRUPLAR = ['Bayi Merch', 'Çetinler Merch', 'Destek Personeli', 'Diğer']
const GRUP_RENK: Record<string, string> = {
  'Bayi Merch':       'bg-blue-50 text-blue-700 border-blue-200',
  'Çetinler Merch':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Destek Personeli': 'bg-amber-50 text-amber-700 border-amber-200',
  'Diğer':            'bg-gray-50 text-gray-700 border-gray-200',
}

interface DigerRow {
  id?: string
  key: string            // React key (yeni satırlarda id yok)
  kullanici_adi: string
  grup: string
  cari_adi: string
  sube_adi: string
  gorev: string
  hakedis: string        // input için string tutulur
  dirty: boolean
  saving: boolean
}

interface CariSube { cari_adi: string; sube_adi: string }
interface Personel { merch_adi: string; merch_grubu: string; cari_adi: string; sube_adi: string }

const subeKey = (cari: string, sube: string) => `${normalizeName(cari)}||${normalizeName(sube)}`

const toNum = (s: string) => {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const fmtTl = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`

export function DigerPrimView({ userId }: { userId: string }) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const donem = `${yil}-${String(ay).padStart(2, '0')}`

  const [rows,    setRows]    = useState<DigerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [subeAdet, setSubeAdet] = useState<Record<string, number>>({})
  const [grupFilter, setGrupFilter] = useState('')
  const [personel, setPersonel] = useState<Personel[]>([])
  // Cari/şube modalı: açık olan satır + (kişinin birden çok şubesi varsa) yalnızca o seçenekler
  const [pick, setPick] = useState<{ key: string; only?: CariSube[] } | null>(null)

  // Personel listesi (otomatik doldurma için) — bir kez
  useEffect(() => {
    fetch('/api/merch-detay').then(r => r.json()).then(d => setPersonel(d.data ?? [])).catch(() => {})
  }, [])

  // normalize(ad) → kişinin kayıtları
  const personelByName = useMemo(() => {
    const m = new Map<string, Personel[]>()
    personel.forEach(p => {
      if (!p.merch_adi) return
      const k = normalizeName(p.merch_adi)
      m.set(k, [...(m.get(k) ?? []), p])
    })
    return m
  }, [personel])
  const personelNames = useMemo(
    () => [...new Set(personel.map(p => p.merch_adi).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    [personel]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/diger-prim?donem=${donem}&user=${userId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Yükleme hatası')
      setSubeAdet(data.subeAdet ?? {})
      setRows((data.rows ?? []).map((r: { id: string; kullanici_adi: string; grup: string; cari_adi: string; sube_adi: string; gorev: string; hakedis: number }) => ({
        id: r.id, key: r.id,
        kullanici_adi: r.kullanici_adi, grup: r.grup ?? '', cari_adi: r.cari_adi, sube_adi: r.sube_adi, gorev: r.gorev,
        hakedis:   r.hakedis   ? String(r.hakedis).replace('.', ',') : '',
        dirty: false, saving: false,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [donem, userId])

  useEffect(() => { load() }, [load])

  const patch = (key: string, p: Partial<DigerRow>) =>
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...p } : r))

  const edit = (key: string, p: Partial<DigerRow>) => patch(key, { ...p, dirty: true })

  const adetOf = (r: { cari_adi: string; sube_adi: string }) =>
    r.cari_adi ? (subeAdet[subeKey(r.cari_adi, r.sube_adi)] ?? 0) : 0

  // Kullanıcı adı yazıldığında: personel listesinde varsa grup + cari + şube otomatik
  const onKullanici = (key: string, value: string) => {
    const kayitlar = personelByName.get(normalizeName(value))
    if (!kayitlar?.length) { edit(key, { kullanici_adi: value }); return }
    const grup = GRUPLAR.includes(kayitlar[0].merch_grubu) ? kayitlar[0].merch_grubu : ''
    const subeler = [...new Map(kayitlar.filter(k => k.cari_adi)
      .map(k => [subeKey(k.cari_adi, k.sube_adi), { cari_adi: k.cari_adi, sube_adi: k.sube_adi }])).values()]
    if (subeler.length === 1) {
      edit(key, { kullanici_adi: value, ...(grup && { grup }), ...subeler[0] })
    } else {
      edit(key, { kullanici_adi: value, ...(grup && { grup }) })
      if (subeler.length > 1) setPick({ key, only: subeler })   // birden çok şube → seçtir
    }
  }

  const addRow = () => setRows(rs => [...rs, {
    key: `new-${Date.now()}`, kullanici_adi: '', grup: grupFilter, cari_adi: '', sube_adi: '', gorev: '',
    hakedis: '', dirty: true, saving: false,
  }])

  const saveRow = async (r: DigerRow) => {
    patch(r.key, { saving: true })
    setError(null)
    try {
      const res = await fetch('/api/diger-prim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updated_by: userId,
          row: {
            id: r.id, donem,
            kullanici_adi: r.kullanici_adi, grup: r.grup, cari_adi: r.cari_adi, sube_adi: r.sube_adi, gorev: r.gorev,
            sube_adet: adetOf(r), hakedis: toNum(r.hakedis),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Kaydetme hatası')
      patch(r.key, { id: data.row.id, dirty: false, saving: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      patch(r.key, { saving: false })
    }
  }

  const deleteRow = async (r: DigerRow) => {
    if (r.id) {
      if (!confirm(`${r.kullanici_adi || 'Bu satır'} silinsin mi?`)) return
      const res = await fetch(`/api/diger-prim?id=${r.id}&user=${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Silme hatası')
        return
      }
    }
    setRows(rs => rs.filter(x => x.key !== r.key))
  }

  const visible       = rows.filter(r => !grupFilter || r.grup === grupFilter)
  const toplamAdet    = visible.reduce((s, r) => s + adetOf(r), 0)
  const toplamHakedis = visible.reduce((s, r) => s + toNum(r.hakedis), 0)
  const dirtyCount    = rows.filter(r => r.dirty).length

  const inputCls = 'w-full px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:border-brand-400'

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-700">Diğer</span>

        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
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

        {/* Grup filtresi */}
        <div className="relative">
          <select value={grupFilter} onChange={e => setGrupFilter(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none">
            <option value="">Tüm Gruplar</option>
            {GRUPLAR.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={addRow}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600">
          <Plus size={12} /> Satır Ekle
        </button>

        {dirtyCount > 0 && (
          <span className="text-[10px] text-amber-600 font-medium">{dirtyCount} kaydedilmemiş satır</span>
        )}
        {rows.length > 0 && (
          <span className="text-[10px] text-gray-400 ml-1">
            {visible.length}{visible.length !== rows.length ? `/${rows.length}` : ''} satır · Toplam: {fmtTl(toplamHakedis)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {error && <div className="mb-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw size={20} className="animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs border-collapse w-full bg-white">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="text-left px-3 py-2.5 font-semibold w-6">#</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[160px]">Kullanıcı Adı</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[140px]">Grubu</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[220px]">Cari Adı</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[130px]">Şube</th>
                  <th className="text-left px-3 py-2.5 font-semibold min-w-[140px]">Görevi</th>
                  <th className="text-right px-3 py-2.5 font-semibold min-w-[100px]">Şubenin Adeti</th>
                  <th className="text-right px-3 py-2.5 font-semibold min-w-[120px]">Hakediş (₺)</th>
                  <th className="px-3 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400">
                      {MONTHS_TR[ay - 1]} {yil}{grupFilter && ` · ${grupFilter}`} için kayıt yok. &quot;Satır Ekle&quot; ile başlayın.
                    </td>
                  </tr>
                ) : visible.map((r, idx) => (
                  <tr key={r.key} className={clsx('border-b border-gray-100 last:border-0', r.dirty && 'bg-amber-50/40')}>
                    <td className="px-3 py-1.5 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <input className={inputCls} value={r.kullanici_adi} placeholder="Ad Soyad" list="diger-personel"
                        onChange={e => onKullanici(r.key, e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.grup} onChange={e => edit(r.key, { grup: e.target.value })}
                        className={clsx(inputCls, 'font-medium', r.grup ? GRUP_RENK[r.grup] : 'text-gray-400')}>
                        <option value="">Seçin…</option>
                        {GRUPLAR.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => setPick({ key: r.key })} title={r.cari_adi}
                        className={clsx(inputCls, 'text-left truncate hover:border-brand-400', r.cari_adi ? 'font-medium text-gray-800' : 'text-gray-400')}>
                        {r.cari_adi || 'Cari seçin…'}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => setPick({ key: r.key })} title={r.sube_adi}
                        className={clsx(inputCls, 'text-left truncate hover:border-brand-400', r.sube_adi ? 'text-gray-700' : 'text-gray-400')}>
                        {r.sube_adi || 'Şube seçin…'}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={inputCls} value={r.gorev} placeholder="Görevi"
                        onChange={e => edit(r.key, { gorev: e.target.value })} />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-700" title="Dönemde şubenin toplam satış adedi (otomatik)">
                      {r.cari_adi ? adetOf(r).toLocaleString('tr-TR') : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={clsx(inputCls, 'text-right tabular-nums')} inputMode="decimal" value={r.hakedis} placeholder="0"
                        onChange={e => edit(r.key, { hakedis: e.target.value.replace(/[^\d,]/g, '') })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        {r.dirty && (
                          <button onClick={() => saveRow(r)} disabled={r.saving} title="Kaydet"
                            className="p-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
                            {r.saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                          </button>
                        )}
                        <button onClick={() => deleteRow(r)} title="Sil"
                          className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {visible.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-800 text-white text-[10px] font-semibold">
                    <td className="px-3 py-2" colSpan={6}>Toplam</td>
                    <td className="px-3 py-2 text-right tabular-nums">{toplamAdet.toLocaleString('tr-TR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtTl(toplamHakedis)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <datalist id="diger-personel">
        {personelNames.map(n => <option key={n} value={n} />)}
      </datalist>

      {pick && (
        <CariSubeModal
          only={pick.only}
          onClose={() => setPick(null)}
          onSelect={cs => { edit(pick.key, { cari_adi: cs.cari_adi, sube_adi: cs.sube_adi }); setPick(null) }}
        />
      )}
    </div>
  )
}

// ─── Cari / Şube seçim modalı ─────────────────────────────────────
let cariSubeCache: CariSube[] | null = null

function CariSubeModal({ only, onClose, onSelect }: { only?: CariSube[]; onClose: () => void; onSelect: (cs: CariSube) => void }) {
  // only: kullanıcının kayıtlı şubeleri (birden çoksa) — yalnızca bunlar listelenir
  const [all,     setAll]     = useState<CariSube[]>(cariSubeCache ?? [])
  const [loading, setLoading] = useState(!only && !cariSubeCache)
  const list = only ?? all
  const [error,   setError]   = useState<string | null>(null)
  const [q,       setQ]       = useState('')

  useEffect(() => {
    if (only || cariSubeCache) return
    fetch('/api/bsy-cari-sube')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        const data = ((d.data ?? []) as CariSube[])
          .map(x => ({ cari_adi: x.cari_adi, sube_adi: x.sube_adi }))
          .sort((a, b) => a.cari_adi.localeCompare(b.cari_adi, 'tr') || a.sube_adi.localeCompare(b.sube_adi, 'tr'))
        cariSubeCache = data
        setAll(data)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [only])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const terms = normalizeName(q).split(' ').filter(Boolean)
    if (!terms.length) return list.slice(0, 300)
    return list.filter(x => {
      const hay = normalizeName(`${x.cari_adi} ${x.sube_adi}`)
      return terms.every(t => hay.includes(t))
    }).slice(0, 300)
  }, [list, q])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">{only ? 'Kullanıcının şubelerinden seçin' : 'Cari / Şube Seç'}</span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Cari veya şube adı ara…"
              className="w-full pl-8 pr-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400"><RefreshCw size={18} className="animate-spin" /></div>
          ) : error ? (
            <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400">Sonuç yok</div>
          ) : (
            <ul>
              {filtered.map(x => (
                <li key={`${x.cari_adi}||${x.sube_adi}`}>
                  <button onClick={() => onSelect(x)}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-brand-50 border-b border-gray-50">
                    <span className="font-medium text-gray-800">{x.cari_adi}</span>
                    {x.sube_adi && <span className="text-gray-500"> / {x.sube_adi}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!loading && list.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
            {filtered.length >= 300 ? 'İlk 300 sonuç gösteriliyor — aramayı daraltın' : `${filtered.length} sonuç`}
          </div>
        )}
      </div>
    </div>
  )
}
