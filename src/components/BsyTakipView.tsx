'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, Settings2, X, Save, Upload, SlidersHorizontal, ImagePlus } from 'lucide-react'
import clsx from 'clsx'
import { useBsyCiro, BRAND_KEYS, BrandKey } from '@/hooks/useBsyCiro'
import { useBsyHedef } from '@/hooks/useBsyHedef'
import { useBsyKisiHedef } from '@/hooks/useBsyKisiHedef'
import { BRAND_LABEL, calcBsyPrims, PRIM_EXCLUDED_BSYS } from '@/lib/bsy'
import type { BsyBrandRow } from '@/hooks/useBsyCiro'
import { supabase } from '@/lib/supabase'

// ─── Sabitler ─────────────────────────────────────────────────
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const PRIM_BARAJI_PCT = 80

// ─── Prim parametreleri ────────────────────────────────────────
type Params = Record<string, number>

const DEFAULT_PARAMS: Params = {
  elx_t1_thr: 80,   elx_t1_rate: 0.40,
  elx_t2_thr: 100,  elx_t2_rate: 0.70,
  elx_t3_thr: 130,  elx_t3_rate: 1.00,
  elx_t4_thr: 150,  elx_t4_rate: 1.20,
  relux_t1_thr: 80,  relux_t1_rate: 0.60,
  relux_t2_thr: 100, relux_t2_rate: 0.85,
  relux_t3_thr: 130, relux_t3_rate: 1.15,
  relux_t4_thr: 150, relux_t4_rate: 1.40,
  carp1_thr: 50,  carp1_val: 0.70,
  carp2_thr: 80,  carp2_val: 0.50,
  carp3_thr: 100, carp3_val: 1.50,
}

// ─── Kademeli prim motoru ──────────────────────────────────────
function calcTieredPrim(
  gercElx: number, hedefElx: number,
  gercRelux: number, hedefRelux: number,
  compGerc: number, compHedef: number,
  tahsilatOran: number,
  params: Params,
  excluded: boolean,
): { elxPrim: number; reluxPrim: number; topPrim: number } {
  if (excluded) return { elxPrim: 0, reluxPrim: 0, topPrim: 0 }

  const achElxPct   = hedefElx   > 0 ? (gercElx   / hedefElx)   * 100 : 0
  const achReluxPct = hedefRelux > 0 ? (gercRelux / hedefRelux) * 100 : 0

  function tierRate(achPct: number, prefix: string): number {
    const tiers: [number, number][] = [4, 3, 2, 1].map(i => [
      params[`${prefix}_t${i}_thr`]  ?? 0,
      params[`${prefix}_t${i}_rate`] ?? 0,
    ] as [number, number]).sort((a, b) => b[0] - a[0])
    for (const [thr, rate] of tiers) {
      if (thr > 0 && achPct >= thr) return rate
    }
    return 0
  }

  let elxPrim   = gercElx   * tierRate(achElxPct,   'elx')   / 100
  let reluxPrim = gercRelux * tierRate(achReluxPct, 'relux') / 100

  // ① Düşük marka çarpanı
  const c1thr = params['carp1_thr'] ?? 50
  const c1val = params['carp1_val'] ?? 0.30
  if ((hedefElx > 0 && achElxPct < c1thr) || (hedefRelux > 0 && achReluxPct < c1thr)) {
    elxPrim   *= c1val
    reluxPrim *= c1val
  }

  // ② Şirket toplam çarpanı
  const c2thr = params['carp2_thr'] ?? 80
  const c2val = params['carp2_val'] ?? 0.50
  const compAchPct = compHedef > 0 ? (compGerc / compHedef) * 100 : 0
  if (compAchPct < c2thr) {
    elxPrim   *= c2val
    reluxPrim *= c2val
  }

  // ③ Tahsilat çarpanı — sadece TOPLAM sütununa uygulanır
  const c3thr = params['carp3_thr'] ?? 100
  const c3val = params['carp3_val'] ?? 1.50
  const topPrim = (elxPrim + reluxPrim) * (tahsilatOran >= c3thr ? c3val : 1)

  return {
    elxPrim:  Math.round(elxPrim),
    reluxPrim: Math.round(reluxPrim),
    topPrim:  Math.round(topPrim),
  }
}

// ─── useBsyParametreler hook ──────────────────────────────────
function useBsyParametreler() {
  const [params,  setParams]  = useState<Params>({ ...DEFAULT_PARAMS })
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/bsy-parametreler')
      const json = await res.json()
      const map: Params = { ...DEFAULT_PARAMS }
      ;(json.rows ?? []).forEach((r: { key: string; value: number }) => { map[r.key] = r.value })
      setParams(map)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (newParams: Params) => {
    setSaving(true)
    try {
      const rows = Object.entries(newParams).map(([key, value]) => ({ key, label: key, value }))
      await fetch('/api/bsy-parametreler', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      setParams({ ...DEFAULT_PARAMS, ...newParams })
    } finally { setSaving(false) }
  }, [])

  return { params, saving, save }
}

// ─── Format yardımcıları ───────────────────────────────────────
function fmtCur(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}
function parseCur(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

// ─── Parametreler Modalı (sadece görsel) ──────────────────────
function ParametrelerModal({ onClose }: { onClose: () => void }) {
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-brand-600" />
            <h2 className="text-sm font-bold text-gray-800">BSY Parametreleri</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => imgRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium">
              <ImagePlus size={12} />
              {imgSrc ? 'Görseli Değiştir' : 'PNG Ekle'}
            </button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-50/40">
          {imgSrc ? (
            <img src={imgSrc} alt="BSY Parametreleri" className="max-w-full rounded-lg shadow-sm border border-gray-200" />
          ) : (
            <div className="flex flex-col items-center gap-3 mt-24 text-gray-300">
              <ImagePlus size={56} />
              <span className="text-sm font-medium text-gray-400">
                Henüz görsel eklenmemiş — &quot;PNG Ekle&quot; butonunu kullanın
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Parametre Giriş Modalı ───────────────────────────────────
function ParametreGirModal({
  params, saving, onSave, onClose,
}: {
  params: Params; saving: boolean
  onSave: (p: Params) => Promise<void>; onClose: () => void
}) {
  const [vals, setVals] = useState<Params>({ ...params })
  useEffect(() => { setVals({ ...params }) }, [params])

  function set(key: string, val: string) {
    setVals(v => ({ ...v, [key]: parseFloat(val) || 0 }))
  }

  const thrCls  = 'w-16 text-right text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-brand-400 tabular-nums bg-white'
  const rateCls = 'w-20 text-right text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-brand-400 tabular-nums bg-white'

  function TierTable({ prefix, headerColor, headerBg }: { prefix: string; headerColor: string; headerBg: string }) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: headerColor + '40' }}>
        <div className="text-white text-xs font-bold px-4 py-2.5 text-center" style={{ backgroundColor: headerBg }}>
          {prefix === 'elx' ? 'Electrolux' : 'Relux'}
        </div>
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: headerColor + '15' }}>
              <th className="px-3 py-2 text-left font-semibold border-b" style={{ color: headerBg, borderColor: headerColor + '30' }}>Gerçekleşme</th>
              <th className="px-3 py-2 text-center font-semibold border-b" style={{ color: headerBg, borderColor: headerColor + '30' }}>Prim Oranı (%)</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map(i => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 text-gray-500">
                    <span>≥</span>
                    <input type="number" step="1" min="0" max="999"
                      value={vals[`${prefix}_t${i}_thr`] ?? ''}
                      onChange={e => set(`${prefix}_t${i}_thr`, e.target.value)}
                      className={thrCls} />
                    <span>%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="number" step="0.01" min="0" max="100"
                    value={vals[`${prefix}_t${i}_rate`] ?? ''}
                    onChange={e => set(`${prefix}_t${i}_rate`, e.target.value)}
                    className={rateCls} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-800">BSY Parametre Girişi</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => onSave(vals)} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60">
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-auto flex-1 p-5 space-y-5">
          {/* Marka kademeleri */}
          <div className="grid grid-cols-2 gap-4">
            <TierTable prefix="elx"   headerColor="#003087" headerBg="#003087" />
            <TierTable prefix="relux" headerColor="#6b21a8" headerBg="#6b21a8" />
          </div>

          {/* Çarpanlar */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2.5">Çarpanlar</div>
            <div className="divide-y divide-gray-100 text-xs">
              {[
                { key: 'carp1', label: 'Markalardan biri', op: '<', suffix: '% ise prim ×', badge: '①', color: 'orange' },
                { key: 'carp2', label: 'Şirket toplam gerc.', op: '<', suffix: '% ise prim ×', badge: '②', color: 'red' },
                { key: 'carp3', label: 'Tahsilat gerçekleşmesi ≥', op: '', suffix: '% ise prim ×', badge: '③', color: 'green' },
              ].map(({ key, label, op, suffix, badge, color }) => (
                <div key={key} className="px-4 py-3 flex items-center gap-2 text-gray-700 flex-wrap">
                  <span className={clsx(
                    'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0',
                    color === 'orange' ? 'bg-orange-100 text-orange-700' :
                    color === 'red'    ? 'bg-red-100 text-red-700' :
                                         'bg-green-100 text-green-700'
                  )}>{badge}</span>
                  <span className="flex-1 min-w-[120px]">{label}</span>
                  {op && <span className="text-gray-400">{op}</span>}
                  <input type="number" step="1" min="0" max="999"
                    value={vals[`${key}_thr`] ?? ''} onChange={e => set(`${key}_thr`, e.target.value)}
                    className={thrCls} />
                  <span className="text-gray-400">{suffix}</span>
                  <input type="number" step="0.01" min="0" max="100"
                    value={vals[`${key}_val`] ?? ''} onChange={e => set(`${key}_val`, e.target.value)}
                    className={rateCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Formül özeti */}
          <div className="bg-gray-50 rounded-xl p-3 text-[10px] text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-600 text-xs mb-1">Hesaplama Sırası</p>
            <p>1. Prim = Gerçekleşen Ciro × Kademeli Prim Oranı</p>
            <p>2. ① Çarpanı: markalardan biri düşükse tüm prim × çarpan</p>
            <p>3. ② Çarpanı: şirket toplamı düşükse tüm prim × çarpan</p>
            <p>4. ③ Çarpanı: tahsilat hedefi aşıldıysa prim × çarpan</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hedef Giriş Modalı (ay < 5) ──────────────────────────────
interface HedefModalProps {
  yil: number; ay: number
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
      brand: b, hedefCiro: parseCur(vals[b].hedefCiro), toplamPrim: parseCur(vals[b].toplamPrim),
    }))
    await onSave(records); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium">{MONTHS_TR[ay - 1]} {yil}</p>
            <h2 className="text-sm font-bold text-gray-800">BSY Hedef Girişi</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {BRAND_KEYS.map(brand => (
            <div key={brand} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2">{BRAND_LABEL[brand]}</div>
              <div className="grid grid-cols-2 gap-3 p-3">
                {(['hedefCiro', 'toplamPrim'] as const).map(f => (
                  <div key={f}>
                    <label className="text-[10px] text-gray-500 font-medium block mb-1">
                      {f === 'hedefCiro' ? 'Hedef Ciro (TL)' : 'Toplam Prim (TL)'}
                    </label>
                    <input type="text" inputMode="decimal" value={vals[brand][f]}
                      onChange={e => set(brand, f, e.target.value)} placeholder="0"
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 text-right" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">İptal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Kişi Bazlı Hedef Giriş Modalı (ay ≥ 5) ──────────────────
function KisiHedefModal({
  yil, ay, bsyAdlar, getKisiHedef, saving, onSave, onClose,
}: {
  yil: number; ay: number; bsyAdlar: string[]
  getKisiHedef: (bsyAdi: string, brand: BrandKey) => { hedefCiro: number; hakedilenPrim: number | null }
  saving: boolean
  onSave: (
    hedefRows: { bsyAdi: string; brand: BrandKey; hedefCiro: number; hakedilenPrim: number | null }[],
    extraRows: { bsyAdi: string; markaCarp: number | null; tahsiatCarp: number | null }[]
  ) => Promise<void>
  onClose: () => void
}) {
  // Sadece rakamlar sakla ("1750000"), gösterimde bin ayraçlı format
  const [vals, setVals] = useState<Record<string, { elx: string; relux: string }>>(() => {
    const init: Record<string, { elx: string; relux: string }> = {}
    bsyAdlar.forEach(bsy => {
      const e = getKisiHedef(bsy, 'ELECTROLUX')
      const r = getKisiHedef(bsy, 'RELUX')
      init[bsy] = {
        elx:   e.hedefCiro > 0 ? String(e.hedefCiro)   : '',
        relux: r.hedefCiro > 0 ? String(r.hedefCiro) : '',
      }
    })
    return init
  })

  // Yalnızca rakamları sakla
  function handleChange(bsy: string, field: 'elx' | 'relux', raw: string) {
    const digits = raw.replace(/[^\d]/g, '')
    setVals(v => ({ ...v, [bsy]: { ...v[bsy], [field]: digits } }))
  }

  // Görüntüleme: bin ayraçlı
  function display(s: string): string {
    const n = parseInt(s) || 0
    return n > 0 ? n.toLocaleString('tr-TR') : ''
  }
  // Sayı değeri
  function toNum(s: string) { return parseInt(s) || 0 }

  // Alt toplamlar
  const totalElx   = bsyAdlar.reduce((s, bsy) => s + toNum(vals[bsy]?.elx   ?? ''), 0)
  const totalRelux = bsyAdlar.reduce((s, bsy) => s + toNum(vals[bsy]?.relux ?? ''), 0)
  const totalAll   = totalElx + totalRelux

  // Oran hesapla
  function oran(val: number, total: number) {
    if (!total || !val) return null
    return (val / total * 100)
  }

  async function handleSave() {
    const hedefRows = bsyAdlar.flatMap(bsy => [
      { bsyAdi: bsy, brand: 'ELECTROLUX' as BrandKey, hedefCiro: toNum(vals[bsy]?.elx ?? ''),   hakedilenPrim: null },
      { bsyAdi: bsy, brand: 'RELUX'       as BrandKey, hedefCiro: toNum(vals[bsy]?.relux ?? ''), hakedilenPrim: null },
    ])
    await onSave(hedefRows, []); onClose()
  }

  const inputCls = 'w-full text-right border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-brand-400 bg-white tabular-nums'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-medium">{MONTHS_TR[ay - 1]} {yil}</p>
            <h2 className="text-sm font-bold text-gray-800">BSY Hedef Girişi</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60">
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-3">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-600 px-3 py-2 text-left min-w-[160px]">BSY Adı</th>
                {/* Electrolux grubu */}
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[150px]">Electrolux Hedef Ciro</th>
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[70px]" title="Toplam Elx hedefindeki payı">Elx %</th>
                {/* Relux grubu */}
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[150px]">Relux Hedef Ciro</th>
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[70px]" title="Toplam Relux hedefindeki payı">Relux %</th>
              </tr>
            </thead>
            <tbody>
              {bsyAdlar.map((bsy, i) => {
                const elxVal   = toNum(vals[bsy]?.elx   ?? '')
                const reluxVal = toNum(vals[bsy]?.relux ?? '')
                const elxPct   = oran(elxVal,   totalElx)
                const reluxPct = oran(reluxVal, totalRelux)
                return (
                  <tr key={bsy} className={clsx('border-b border-gray-100', i % 2 === 1 && 'bg-gray-50/50')}>
                    <td className="border border-gray-100 px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">{bsy}</td>
                    {/* Electrolux */}
                    <td className="border border-gray-100 p-1">
                      <input type="text" inputMode="numeric"
                        value={display(vals[bsy]?.elx ?? '')}
                        onChange={e => handleChange(bsy, 'elx', e.target.value)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className="border border-gray-100 px-2 py-1.5 text-center tabular-nums">
                      {elxPct != null
                        ? <span className={clsx('font-semibold', elxPct >= 15 ? 'text-blue-600' : 'text-gray-500')}>
                            %{elxPct.toFixed(1)}
                          </span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                    {/* Relux */}
                    <td className="border border-gray-100 p-1">
                      <input type="text" inputMode="numeric"
                        value={display(vals[bsy]?.relux ?? '')}
                        onChange={e => handleChange(bsy, 'relux', e.target.value)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className="border border-gray-100 px-2 py-1.5 text-center tabular-nums">
                      {reluxPct != null
                        ? <span className={clsx('font-semibold', reluxPct >= 15 ? 'text-purple-600' : 'text-gray-500')}>
                            %{reluxPct.toFixed(1)}
                          </span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Alt toplam */}
            <tfoot>
              <tr className="bg-gray-900 text-white font-semibold text-[11px]">
                <td className="border border-gray-700 px-3 py-2">
                  Toplam
                  {totalAll > 0 && (
                    <span className="ml-2 text-[10px] font-normal text-gray-400">
                      {totalAll.toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-right tabular-nums">
                  {totalElx > 0 ? totalElx.toLocaleString('tr-TR') : '—'}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-center text-blue-300">
                  {totalElx > 0 ? '%100' : '—'}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-right tabular-nums">
                  {totalRelux > 0 ? totalRelux.toLocaleString('tr-TR') : '—'}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-center text-purple-300">
                  {totalRelux > 0 ? '%100' : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tahsilat satır tipi ───────────────────────────────────────
interface TahsilatRow { bsyAdi: string; acikHesap: number; hedef: number; gerceklesen: number; oran: number }

// ─── Kişi Bazlı Tablo (ay ≥ 5) ────────────────────────────────
const EMPTY_BRANDS = Object.fromEntries(
  BRAND_KEYS.map(b => [b, { gercCiro: 0 }])
) as Record<BrandKey, { gercCiro: number }>

function BsyKisiTable({
  yil, ay, bsyRows, allBsyNames, getKisiHedef, getKisiExtra, params, tahsilatRows,
}: {
  yil: number; ay: number; bsyRows: BsyBrandRow[]; allBsyNames: string[]
  getKisiHedef: (bsyAdi: string, brand: BrandKey) => { hedefCiro: number; hakedilenPrim: number | null }
  getKisiExtra: (bsyAdi: string) => { markaCarp: number | null; tahsiatCarp: number | null }
  params: Params
  tahsilatRows: TahsilatRow[]
}) {
  const ciroMap = new Map(bsyRows.map(r => [r.bsyAdi.toLocaleLowerCase('tr'), r]))
  const mergedRows: BsyBrandRow[] = (allBsyNames.length > 0 ? allBsyNames : bsyRows.map(r => r.bsyAdi))
    .map(name => ciroMap.get(name.toLocaleLowerCase('tr')) ?? {
      bsyAdi: name, brands: { ...EMPTY_BRANDS }, toplamGercCiro: 0,
    })

  if (mergedRows.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">Bu döneme ait veri bulunamadı.</p>
  }

  // Şirket toplam hedef + gerc — SADECE Elx + Relux (hedefle karşılaştırılabilir olsun)
  let compGerc = 0; let compHedef = 0
  mergedRows.forEach(row => {
    compGerc  += row.brands['ELECTROLUX'].gercCiro + row.brands['RELUX'].gercCiro
    compHedef += getKisiHedef(row.bsyAdi, 'ELECTROLUX').hedefCiro +
                 getKisiHedef(row.bsyAdi, 'RELUX').hedefCiro
  })

  function isExcluded(bsyAdi: string) {
    return PRIM_EXCLUDED_BSYS.some(n => bsyAdi.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'))
  }

  function getTahsilatOran(bsyAdi: string): number {
    return tahsilatRows.find(
      r => r.bsyAdi.toLocaleLowerCase('tr') === bsyAdi.toLocaleLowerCase('tr')
    )?.oran ?? 0
  }

  function getPrims(row: BsyBrandRow) {
    const excluded = isExcluded(row.bsyAdi)
    const elx      = getKisiHedef(row.bsyAdi, 'ELECTROLUX')
    const relux    = getKisiHedef(row.bsyAdi, 'RELUX')
    return calcTieredPrim(
      row.brands['ELECTROLUX'].gercCiro, elx.hedefCiro,
      row.brands['RELUX'].gercCiro,      relux.hedefCiro,
      compGerc, compHedef,
      getTahsilatOran(row.bsyAdi),
      params, excluded,
    )
  }

  // Toplam satırı
  const totals = { elxH: 0, elxG: 0, elxP: 0, reluxH: 0, reluxG: 0, reluxP: 0, topH: 0, topG: 0, topP: 0 }
  mergedRows.forEach(row => {
    const elx   = getKisiHedef(row.bsyAdi, 'ELECTROLUX')
    const relux = getKisiHedef(row.bsyAdi, 'RELUX')
    const { elxPrim, reluxPrim, topPrim } = getPrims(row)
    totals.elxH   += elx.hedefCiro;   totals.elxG  += row.brands['ELECTROLUX'].gercCiro; totals.elxP  += elxPrim
    totals.reluxH += relux.hedefCiro; totals.reluxG += row.brands['RELUX'].gercCiro;      totals.reluxP += reluxPrim
    totals.topH   += elx.hedefCiro + relux.hedefCiro
    totals.topG   += row.brands['ELECTROLUX'].gercCiro + row.brands['RELUX'].gercCiro
    totals.topP   += topPrim   // ③ çarpanı burada yansır
  })

  const cellCls   = 'border-r border-gray-100 px-3 py-1.5 text-right tabular-nums'
  const pctCls    = 'border-r border-gray-100 px-3 py-1.5 text-center tabular-nums'
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

  // Şirket gerc oranı — tablo başlığında göster
  const compAchPct = compHedef > 0 ? (compGerc / compHedef) * 100 : 0

  return (
    <div className="space-y-1">
      {/* Şirket toplam bilgi şeridi */}
      {compHedef > 0 && (
        <div className={clsx(
          'flex items-center gap-3 text-[10px] font-medium px-3 py-1.5 rounded-lg',
          compAchPct < (params['carp2_thr'] ?? 80)
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        )}>
          <span>Şirket Toplam Gerçekleşme: <strong>{fmtPct(compAchPct)}</strong></span>
          {compAchPct < (params['carp2_thr'] ?? 80) && (
            <span className="bg-red-100 rounded px-1.5 py-0.5">
              ② Çarpanı Aktif: ×{params['carp2_val'] ?? 0.50}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="text-xs border-collapse min-w-max bg-white w-full">
          <thead className="sticky top-0 z-20">
            <tr>
              <th colSpan={13} className="bg-red-600 text-white font-bold px-4 py-2 text-left text-sm">
                {yil}/{String(ay).padStart(2, '0')}
              </th>
            </tr>
            <tr className="bg-gray-800 text-white">
              <th rowSpan={2} className="sticky left-0 z-30 bg-gray-800 border-r border-gray-600 px-4 py-2 text-left min-w-[155px]">Bsy Adı</th>
              {(['Electrolux', 'Relux', 'Toplam'] as const).map(label => (
                <th key={label} colSpan={4} className="border-r border-gray-600 px-3 py-2 text-center font-bold">{label}</th>
              ))}
            </tr>
            <tr className="bg-gray-700 text-white text-[10px]">
              {['Hedef','Gerç. Ciro','Gerç. Oranı','Hakedilen Prim',
                'Hedef','Gerç. Ciro','Gerç. Oranı','Hakedilen Prim',
                'Hedef','Gerç. Ciro','Gerç. Oranı','Hakedilen Prim'].map((col, i) => (
                <th key={i} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[100px]">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mergedRows.map((row, idx) => {
              const elx       = getKisiHedef(row.bsyAdi, 'ELECTROLUX')
              const relux     = getKisiHedef(row.bsyAdi, 'RELUX')
              const elxGerc   = row.brands['ELECTROLUX'].gercCiro
              const reluxGerc = row.brands['RELUX'].gercCiro
              const { elxPrim, reluxPrim, topPrim } = getPrims(row)
              const topHedef  = elx.hedefCiro + relux.hedefCiro
              // topGerc: sadece Elx + Relux (hedefle tutarlı)
              const topGerc   = elxGerc + reluxGerc
              const excluded  = isExcluded(row.bsyAdi)
              const tahsilOran = getTahsilatOran(row.bsyAdi)

              // Hangi çarpanlar bu BSY için aktif?
              const c1thr = params['carp1_thr'] ?? 50
              const achElxPct   = elx.hedefCiro   > 0 ? (elxGerc   / elx.hedefCiro)   * 100 : -1
              const achReluxPct = relux.hedefCiro > 0 ? (reluxGerc / relux.hedefCiro) * 100 : -1
              const carp1Active = !excluded && (
                (achElxPct   >= 0 && achElxPct   < c1thr) ||
                (achReluxPct >= 0 && achReluxPct < c1thr)
              )
              const c2thr = params['carp2_thr'] ?? 80
              const compAchRow = compHedef > 0 ? (compGerc / compHedef) * 100 : 0
              const carp2Active = !excluded && compAchRow < c2thr
              const c3thr = params['carp3_thr'] ?? 100
              const carp3Active = !excluded && tahsilOran >= c3thr

              return (
                <tr key={row.bsyAdi} className={clsx('border-b border-gray-100 hover:bg-blue-50/20', idx % 2 === 1 && 'bg-gray-50/40')}>
                  <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 font-medium text-gray-800">
                    <div className="flex flex-col gap-0.5">
                      <span className={excluded ? 'italic text-gray-500' : ''}>{row.bsyAdi}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {excluded && <span className="text-[9px] bg-gray-200 text-gray-500 rounded px-1 py-0.5">prim yok</span>}
                        {carp1Active && <span className="text-[9px] bg-orange-100 text-orange-700 rounded px-1 py-0.5">①×{params['carp1_val'] ?? 0.30}</span>}
                        {carp2Active && <span className="text-[9px] bg-red-100 text-red-700 rounded px-1 py-0.5">②×{params['carp2_val'] ?? 0.50}</span>}
                        {carp3Active && <span className="text-[9px] bg-green-100 text-green-700 rounded px-1 py-0.5">③×{params['carp3_val'] ?? 1.50}</span>}
                        {/* Tahsilat oranı — eşleşme doğrulaması için */}
                        {tahsilOran > 0 && (
                          <span className="text-[9px] text-gray-400">Tah:{Math.round(tahsilOran)}%</span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* ELX */}
                  <td className={cellCls + ' text-gray-700'}>{elx.hedefCiro > 0 ? fmtCur(elx.hedefCiro) : '—'}</td>
                  <td className={cellCls + ' text-gray-800'}>{elxGerc !== 0 ? fmtCur(elxGerc) : '—'}</td>
                  <OranCell gerc={elxGerc} hedef={elx.hedefCiro} className={pctCls} />
                  <td className={cellCls + (elxPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                    {excluded ? '—' : elx.hedefCiro > 0 ? fmtCur(elxPrim) : '—'}
                  </td>
                  {/* RELUX */}
                  <td className={cellCls + ' text-gray-700'}>{relux.hedefCiro > 0 ? fmtCur(relux.hedefCiro) : '—'}</td>
                  <td className={cellCls + ' text-gray-800'}>{reluxGerc !== 0 ? fmtCur(reluxGerc) : '—'}</td>
                  <OranCell gerc={reluxGerc} hedef={relux.hedefCiro} className={pctCls} />
                  <td className={cellCls + (reluxPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                    {excluded ? '—' : relux.hedefCiro > 0 ? fmtCur(reluxPrim) : '—'}
                  </td>
                  {/* TOPLAM */}
                  <td className={cellCls + ' font-semibold text-gray-700'}>{topHedef > 0 ? fmtCur(topHedef) : '—'}</td>
                  <td className={cellCls + ' font-semibold text-gray-800'}>{topGerc !== 0 ? fmtCur(topGerc) : '—'}</td>
                  <OranCell gerc={topGerc} hedef={topHedef} className={pctCls + ' font-semibold'} />
                  <td className={cellCls + (topPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                    {excluded ? '—' : topHedef > 0 ? fmtCur(topPrim) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-red-50 border-t-2 border-red-300 font-semibold text-[11px]">
              <td className="sticky left-0 z-10 bg-red-50 border-r border-red-200 px-4 py-2 text-red-700">Genel Toplam</td>
              <td className={ftCellCls + ' text-gray-700'}>{totals.elxH > 0 ? fmtCur(totals.elxH) : '—'}</td>
              <td className={ftCellCls + ' text-red-700'}>{fmtCur(totals.elxG)}</td>
              <td className={clsx(ftPctCls, totals.elxH > 0 ? ((totals.elxG/totals.elxH*100) >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
                {totals.elxH > 0 ? fmtPct(totals.elxG / totals.elxH * 100) : '—'}
              </td>
              <td className={ftCellCls + (totals.elxP > 0 ? ' text-green-700' : ' text-gray-300')}>{totals.elxP > 0 ? fmtCur(totals.elxP) : '—'}</td>
              <td className={ftCellCls + ' text-gray-700'}>{totals.reluxH > 0 ? fmtCur(totals.reluxH) : '—'}</td>
              <td className={ftCellCls + ' text-red-700'}>{fmtCur(totals.reluxG)}</td>
              <td className={clsx(ftPctCls, totals.reluxH > 0 ? ((totals.reluxG/totals.reluxH*100) >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
                {totals.reluxH > 0 ? fmtPct(totals.reluxG / totals.reluxH * 100) : '—'}
              </td>
              <td className={ftCellCls + (totals.reluxP > 0 ? ' text-green-700' : ' text-gray-300')}>{totals.reluxP > 0 ? fmtCur(totals.reluxP) : '—'}</td>
              <td className={ftCellCls + ' text-gray-700'}>{totals.topH > 0 ? fmtCur(totals.topH) : '—'}</td>
              <td className={ftCellCls + ' text-red-700 font-bold'}>{fmtCur(totals.topG)}</td>
              <td className={clsx(ftPctCls, totals.topH > 0 ? ((totals.topG/totals.topH*100) >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
                {totals.topH > 0 ? fmtPct(totals.topG / totals.topH * 100) : '—'}
              </td>
              <td className={ftCellCls + (totals.topP > 0 ? ' text-green-700' : ' text-gray-300')}>{totals.topP > 0 ? fmtCur(totals.topP) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Tahsilat Tablosu ──────────────────────────────────────────
function TahsilatTablosu({ yil, ay, rows, loading }: {
  yil: number; ay: number; rows: TahsilatRow[]; loading: boolean
}) {
  const toplamAcik  = rows.reduce((s, r) => s + r.acikHesap,   0)
  const toplamHedef = rows.reduce((s, r) => s + r.hedef,       0)
  const toplamGerc  = rows.reduce((s, r) => s + r.gerceklesen, 0)
  const toplamOran  = toplamHedef > 0 ? (toplamGerc / toplamHedef) * 100 : 0

  return (
    <div>
      <div className="flex items-baseline gap-2 px-3 py-2 rounded-t-xl text-white text-xs font-bold bg-[#b45309]">
        Tahsilat Hedef Tablosu
        <span className="font-normal opacity-80 text-[10px]">{MONTHS_TR[ay - 1]} {yil} · Açık Hesap × %90</span>
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
            <RefreshCw size={13} className="animate-spin" /> Yükleniyor…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">Bu döneme ait tahsilat verisi bulunamadı</div>
        ) : (
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-600 w-6">#</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50">BSY</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[130px]">Açık Hesap</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[130px]">Hedef (%90)</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[130px]">Gerçekleşen</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-500 min-w-[100px]">Oran</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500 min-w-[140px]">İlerleme</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const ok  = row.oran >= 100
                const pct = Math.min(100, row.oran)
                return (
                  <tr key={row.bsyAdi} className={clsx('border-b border-gray-100 last:border-0', ok ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                    <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-inherit whitespace-nowrap">{row.bsyAdi}</td>
                    <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{row.acikHesap > 0 ? fmtCur(row.acikHesap) : '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">{row.hedef > 0 ? fmtCur(row.hedef) : '—'}</td>
                    <td className={clsx('px-3 py-2 text-right font-bold tabular-nums', row.gerceklesen > 0 ? (ok ? 'text-green-700' : 'text-gray-900') : 'text-gray-300')}>
                      {row.gerceklesen > 0 ? fmtCur(row.gerceklesen) : '—'}
                    </td>
                    <td className={clsx('px-3 py-2 text-center font-semibold tabular-nums', row.hedef > 0 ? ok ? 'text-green-600' : row.oran >= 80 ? 'text-amber-600' : 'text-red-500' : 'text-gray-300')}>
                      {row.hedef > 0 ? fmtPct(row.oran) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.hedef > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden min-w-[80px]">
                            <div className={clsx('h-2 rounded-full', ok ? 'bg-green-500' : row.oran >= 80 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums">{Math.round(pct)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#b45309] text-white text-[10px] font-semibold">
                <td className="px-3 py-2" colSpan={2}>Toplam</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCur(toplamAcik)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCur(toplamHedef)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCur(toplamGerc)}</td>
                <td className="px-3 py-2 text-center tabular-nums font-bold">{fmtPct(toplamOran)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, shaded = false, children }: { label: string; shaded?: boolean; children: React.ReactNode }) {
  return (
    <tr className={shaded ? 'bg-gray-50/50' : ''}>
      <td className="border border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{label}</td>
      {children}
    </tr>
  )
}

// ─── Ana bileşen ───────────────────────────────────────────────
export function BsyTakipView() {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [showModal,         setShowModal]         = useState(false)
  const [showKisiModal,     setShowKisiModal]     = useState(false)
  const [showParamModal,    setShowParamModal]    = useState(false)
  const [showParamGirModal, setShowParamGirModal] = useState(false)
  const [uploading,         setUploading]         = useState(false)
  const [uploadMsg,         setUploadMsg]         = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { params, saving: paramSaving, save: saveParams } = useBsyParametreler()

  const [allBsyNames, setAllBsyNames] = useState<string[]>([])
  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('role', 'bsy').order('full_name')
      .then(({ data }) => { if (data) setAllBsyNames(data.map((p: { full_name: string }) => p.full_name)) })
  }, [])

  const isYeniLayout = ay >= 5

  const [tahsilatRows,    setTahsilatRows]    = useState<TahsilatRow[]>([])
  const [tahsilatLoading, setTahsilatLoading] = useState(false)
  useEffect(() => {
    setTahsilatLoading(true)
    fetch(`/api/tahsilat?yil=${yil}&ay=${ay}`)
      .then(r => r.json()).then(d => setTahsilatRows(d.rows ?? []))
      .finally(() => setTahsilatLoading(false))
  }, [yil, ay])

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadMsg(null)
    try {
      const presignRes = await fetch('/api/bsy-excel-presign', { method: 'POST' })
      const presign    = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error ?? 'Presign hatası')
      const uploadRes = await fetch(presign.signedUrl, {
        method: 'PUT', body: file,
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      })
      if (!uploadRes.ok) throw new Error('Yükleme hatası: ' + uploadRes.status)
      setUploadMsg('✓ Yüklendi'); reload()
    } catch (err) {
      setUploadMsg('✗ ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const { bsyRows, brandTotals, genelToplamGercCiro, yillar, loading, error, source, reload } = useBsyCiro(yil, ay)
  const { hedefMap, loading: hedefLoading, saving, reload: reloadHedef, save } = useBsyHedef(yil, ay)
  const { loading: kisiLoading, saving: kisiSaving, reload: reloadKisi, getKisiHedef, getKisiExtra, save: saveKisi, error: kisiError } = useBsyKisiHedef(yil, ay)

  const summary = useMemo(() => BRAND_KEYS.map(brand => {
    const h = hedefMap[brand]
    const gercCiro = brandTotals[brand]
    const hedefCiro = h.hedefCiro
    const brandRate = hedefCiro > 0 ? gercCiro / hedefCiro : 0
    const havuzdakiPrim = brandRate >= 0.80 ? Math.min(brandRate, 1.0) * h.toplamPrim : 0
    return { brand, hedefCiro, gercCiro, toplamPrim: h.toplamPrim, havuzdakiPrim, brandRate }
  }), [hedefMap, brandTotals])

  const toplamHedef     = summary.reduce((s, r) => s + r.hedefCiro, 0)
  const toplamGercCiro  = genelToplamGercCiro
  const toplamGercPct   = toplamHedef > 0 ? (toplamGercCiro / toplamHedef) * 100 : 0
  const toplamHavuzdaki = summary.reduce((s, r) => s + r.havuzdakiPrim, 0)

  const hedeflerArr = BRAND_KEYS.map(b => hedefMap[b])
  const primResults = useMemo(
    () => calcBsyPrims(bsyRows, brandTotals, hedeflerArr, genelToplamGercCiro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bsyRows, brandTotals, genelToplamGercCiro, hedefMap]
  )

  const bsyTableRows = useMemo(() =>
    bsyRows.map(r => {
      const prim = primResults[r.bsyAdi] ?? { brands: {} as Record<BrandKey, number>, specialPrim: 0, toplam: 0 }
      const cols = BRAND_KEYS.map(b => {
        const gt  = brandTotals[b]; const gc = r.brands[b].gercCiro
        return { gercCiro: gc, pay: gt > 0 ? (gc / gt) * 100 : 0, hakedilen: prim.brands[b] ?? 0 }
      })
      return { bsyAdi: r.bsyAdi, cols, toplamGercCiro: r.toplamGercCiro, toplamPay: toplamGercCiro > 0 ? (r.toplamGercCiro / toplamGercCiro) * 100 : 0, specialPrim: prim.specialPrim, toplamHakedilen: prim.toplam }
    }), [bsyRows, brandTotals, toplamGercCiro, primResults]
  )

  const yilOptions = yillar.length ? yillar : [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Üst Bar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">BSY Takip</span>
        <div className="relative">
          <select value={yil} onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400">
            {yilOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={ay} onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400">
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <button onClick={() => { reload(); reloadHedef(); reloadKisi() }} disabled={loading || hedefLoading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50" title="Yenile">
          <RefreshCw size={14} className={(loading || hedefLoading) ? 'animate-spin' : ''} />
        </button>
        {source === 'empty' && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Excel bağlantısı yok</span>
        )}
        <div className="flex-1" />

        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-60">
          {uploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? 'Yükleniyor…' : 'Excel Güncelle'}
        </button>
        <button onClick={() => isYeniLayout ? setShowKisiModal(true) : setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm">
          <Settings2 size={12} /> Hedef Gir
        </button>
        <button onClick={() => setShowParamGirModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm">
          <SlidersHorizontal size={12} /> Parametre Gir
        </button>
        <button onClick={() => setShowParamModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm">
          <SlidersHorizontal size={12} /> Parametreler
        </button>

        {uploadMsg && (
          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border',
            uploadMsg.startsWith('✓') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200')}>
            {uploadMsg}
          </span>
        )}
        {!loading && bsyRows.length > 0 && (
          <span className="text-[10px] text-gray-400">{bsyRows.length} BSY · {MONTHS_TR[ay - 1]} {yil}</span>
        )}
      </div>

      {(loading || hedefLoading || kisiLoading) && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin mr-2" /> Veriler yükleniyor…
        </div>
      )}
      {!loading && !hedefLoading && !kisiLoading && (error || kisiError) && (
        <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
          {error && <div>{error}</div>}
          {kisiError && <div>Kişi hedef hatası: {kisiError}</div>}
        </div>
      )}

      {!loading && !hedefLoading && !kisiLoading && !error && !kisiError && (
        <div className="flex-1 overflow-auto p-4 space-y-4">

          {/* Yeni layout (ay ≥ 5) */}
          {isYeniLayout && (
            <BsyKisiTable
              yil={yil} ay={ay} bsyRows={bsyRows} allBsyNames={allBsyNames}
              getKisiHedef={getKisiHedef} getKisiExtra={getKisiExtra}
              params={params} tahsilatRows={tahsilatRows}
            />
          )}

          {/* Eski layout (ay < 5) */}
          {!isYeniLayout && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[640px] bg-white rounded-xl shadow-sm overflow-hidden">
                  <thead>
                    <tr>
                      <th className="w-[148px] border border-gray-200 bg-gray-100" />
                      {BRAND_KEYS.map(b => (
                        <th key={b} className="border border-gray-300 bg-gray-800 text-white font-bold py-2 px-4 text-center">{BRAND_LABEL[b]}</th>
                      ))}
                      <th className="border border-gray-300 bg-gray-800 text-white font-bold py-2 px-4 text-center">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SummaryRow label="Hedef Ciro">
                      {summary.map(s => <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">{fmtCur(s.hedefCiro)}</td>)}
                      <td className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">{fmtCur(toplamHedef)}</td>
                    </SummaryRow>
                    <SummaryRow label="Gerç. Ciro" shaded>
                      {summary.map(s => <td key={s.brand} className="border border-gray-200 px-3 py-2 text-center text-gray-800">{fmtCur(s.gercCiro)}</td>)}
                      <td className="border border-gray-200 px-3 py-2 text-center text-gray-800">{fmtCur(toplamGercCiro)}</td>
                    </SummaryRow>
                    <SummaryRow label="Gerç. Oranı">
                      {summary.map(s => {
                        const pct = s.hedefCiro > 0 ? (s.gercCiro / s.hedefCiro) * 100 : 0
                        return <td key={s.brand} className={clsx('border border-gray-200 px-3 py-2 text-center font-semibold', pct >= PRIM_BARAJI_PCT ? 'text-green-600' : 'text-red-500')}>{fmtPct(pct)}</td>
                      })}
                      <td className={clsx('border border-gray-200 px-3 py-2 text-center font-semibold', toplamGercPct >= PRIM_BARAJI_PCT ? 'text-green-600' : 'text-red-500')}>{fmtPct(toplamGercPct)}</td>
                    </SummaryRow>
                    <SummaryRow label="Havuzdaki Prim" shaded>
                      {summary.map(s => <td key={s.brand} className={clsx('border border-gray-200 px-3 py-2 text-center font-medium', s.havuzdakiPrim > 0 ? 'text-green-600' : 'text-gray-400')}>{fmtCur(s.havuzdakiPrim)}</td>)}
                      <td className={clsx('border border-gray-200 px-3 py-2 text-center font-medium', toplamHavuzdaki > 0 ? 'text-green-600' : 'text-gray-400')}>{fmtCur(toplamHavuzdaki)}</td>
                    </SummaryRow>
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="text-xs border-collapse min-w-max bg-white w-full">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-800 text-white">
                      <th rowSpan={2} className="sticky left-0 z-30 bg-gray-800 border-r border-gray-600 px-4 py-2 text-left min-w-[150px]">Bsy Adı</th>
                      {BRAND_KEYS.map(b => (
                        <th key={b} colSpan={3} className="border-r border-gray-600 px-3 py-2 text-center font-bold">{BRAND_LABEL[b]}</th>
                      ))}
                      <th colSpan={3} className="px-3 py-2 text-center font-bold">Toplam</th>
                    </tr>
                    <tr className="bg-gray-700 text-white text-[10px]">
                      {([...BRAND_KEYS, 'TOPLAM'] as const).map(b => (
                        <>
                          <th key={`${b}-gc`}  className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[110px]">Gerç. Ciro</th>
                          <th key={`${b}-pay`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[90px]">Payı</th>
                          <th key={`${b}-hak`} className="border-r border-gray-600 px-2 py-1.5 text-center min-w-[100px]">Hakedilen Prim</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bsyTableRows.map((r, i) => {
                      const excluded = PRIM_EXCLUDED_BSYS.some(n => r.bsyAdi.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'))
                      return (
                        <tr key={r.bsyAdi} className={clsx('border-b border-gray-100 hover:bg-blue-50/20', i % 2 === 1 && 'bg-gray-50/40', excluded && 'opacity-60')}>
                          <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                            <span className={excluded ? 'italic text-gray-500' : ''}>{r.bsyAdi}</span>
                            {excluded && <span className="ml-1.5 text-[9px] bg-gray-200 text-gray-500 rounded px-1 py-0.5">prim yok</span>}
                          </td>
                          {r.cols.map((c, ci) => (
                            <>
                              <td key={`${r.bsyAdi}-${ci}-gc`} className="border-r border-gray-100 px-3 py-1.5 text-right text-gray-800">{c.gercCiro !== 0 ? fmtCur(c.gercCiro) : '—'}</td>
                              <td key={`${r.bsyAdi}-${ci}-p`}  className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-600">{fmtPct(c.pay)}</td>
                              <td key={`${r.bsyAdi}-${ci}-h`}  className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-300">
                                {excluded ? '—' : c.hakedilen > 0 ? <span className="text-green-600 font-medium">{fmtCur(c.hakedilen)}</span> : '—'}
                              </td>
                            </>
                          ))}
                          <td className="border-r border-gray-100 px-3 py-1.5 text-right font-semibold text-gray-800">{fmtCur(r.toplamGercCiro)}</td>
                          <td className="border-r border-gray-100 px-3 py-1.5 text-center text-gray-600">{fmtPct(r.toplamPay)}</td>
                          <td className={clsx('px-3 py-1.5 text-right font-semibold', excluded ? 'text-gray-300' : r.toplamHakedilen > 0 ? 'text-green-600' : 'text-gray-300')}>
                            {excluded ? '—' : r.toplamHakedilen > 0 ? fmtCur(r.toplamHakedilen) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <TahsilatTablosu yil={yil} ay={ay} rows={tahsilatRows} loading={tahsilatLoading} />
        </div>
      )}

      {/* Modaller */}
      {showModal && !isYeniLayout && (
        <HedefModal yil={yil} ay={ay}
          initial={Object.fromEntries(BRAND_KEYS.map(b => [b, { hedefCiro: hedefMap[b].hedefCiro, toplamPrim: hedefMap[b].toplamPrim }])) as Record<BrandKey, { hedefCiro: number; toplamPrim: number }>}
          saving={saving} onSave={save} onClose={() => setShowModal(false)} />
      )}
      {showKisiModal && isYeniLayout && (
        <KisiHedefModal yil={yil} ay={ay}
          bsyAdlar={allBsyNames.length > 0 ? allBsyNames : bsyRows.map(r => r.bsyAdi)}
          getKisiHedef={getKisiHedef} saving={kisiSaving} onSave={saveKisi}
          onClose={() => setShowKisiModal(false)} />
      )}
      {showParamModal && <ParametrelerModal onClose={() => setShowParamModal(false)} />}
      {showParamGirModal && (
        <ParametreGirModal
          params={params} saving={paramSaving}
          onSave={async p => { await saveParams(p); setShowParamGirModal(false) }}
          onClose={() => setShowParamGirModal(false)}
        />
      )}
    </div>
  )
}
