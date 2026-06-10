'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
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

// ─── Prim parametreleri (BsyTakip ile aynı mantık) ────────────
type Params = Record<string, number>
const DEFAULT_PARAMS: Params = {
  elx_t1_thr: 80,  elx_t1_rate: 0.40,
  elx_t2_thr: 100, elx_t2_rate: 0.70,
  elx_t3_thr: 130, elx_t3_rate: 1.00,
  elx_t4_thr: 150, elx_t4_rate: 1.20,
  relux_t1_thr: 80,  relux_t1_rate: 0.60,
  relux_t2_thr: 100, relux_t2_rate: 0.85,
  relux_t3_thr: 130, relux_t3_rate: 1.15,
  relux_t4_thr: 150, relux_t4_rate: 1.40,
  carp1_thr: 50, carp1_val: 0.70,
  carp2_thr: 80, carp2_val: 0.50,
  carp3_thr: 100, carp3_val: 1.50,
}

function calcTieredPrimBsy(
  gercElx: number, hedefElx: number,
  gercRelux: number, hedefRelux: number,
  compGerc: number, compHedef: number,
  tahsilatOran: number, params: Params, excluded: boolean,
): { elxPrim: number; reluxPrim: number; topPrim: number } {
  if (excluded) return { elxPrim: 0, reluxPrim: 0, topPrim: 0 }
  const achElx   = hedefElx   > 0 ? (gercElx   / hedefElx)   * 100 : 0
  const achRelux = hedefRelux > 0 ? (gercRelux / hedefRelux) * 100 : 0

  // Her marka bağımsız hesaplanır:
  // ≥%80 → tier bazlı prim | <%80 → tierRate = 0 → prim = 0
  // Sonra ① ② ③ sırayla toplama uygulanır.
  function tierRate(achPct: number, prefix: string): number {
    const tiers: [number, number][] = [4,3,2,1].map(i => [
      params[`${prefix}_t${i}_thr`] ?? 0, params[`${prefix}_t${i}_rate`] ?? 0,
    ] as [number, number]).sort((a,b) => b[0]-a[0])
    for (const [thr, rate] of tiers) { if (thr>0 && achPct>=thr) return rate }
    return 0
  }
  // 1. Marka bazında bağımsız prim (≥%80 tier var, <%80 tier=0)
  const elxPrimBase   = gercElx   * tierRate(achElx,   'elx')   / 100
  const reluxPrimBase = gercRelux * tierRate(achRelux, 'relux') / 100

  // 2. Toplam hakedilen = iki marka toplamı
  let toplam = elxPrimBase + reluxPrimBase

  // 3. Çarpanlar sırayla TOPLAMA uygulanır:
  // ① İki markadan birinde %50 altı → hakedişin %70'i
  const c1thr = params['carp1_thr'] ?? 50
  const c1val = params['carp1_val'] ?? 0.70
  if ((hedefElx>0 && achElx<c1thr) || (hedefRelux>0 && achRelux<c1thr)) {
    toplam *= c1val
  }

  // ② Şirket toplam gerc. %80 altı → hakedişin yarısı
  const compAch = compHedef>0 ? (compGerc/compHedef)*100 : 0
  const c2thr = params['carp2_thr'] ?? 80
  const c2val = params['carp2_val'] ?? 0.50
  if (compAch < c2thr) {
    toplam *= c2val
  }

  // ③ Tahsilat ≥%100 → 1,5 ile çarp
  const c3thr = params['carp3_thr'] ?? 100
  const c3val = params['carp3_val'] ?? 1.50
  if (tahsilatOran >= c3thr) {
    toplam *= c3val
  }

  // Marka bazındaki görüntü: oransal dağıt (ay≥5 Hakedilen Prim sütunları için)
  const topBase = elxPrimBase + reluxPrimBase
  const elxPrim   = topBase > 0 ? Math.round(toplam * elxPrimBase   / topBase) : 0
  const reluxPrim = topBase > 0 ? Math.round(toplam * reluxPrimBase / topBase) : 0
  const topPrim   = Math.round(toplam)

  return { elxPrim, reluxPrim, topPrim }
}

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

// ─── Parametre Giriş Modalı ───────────────────────────────────
function ParametreGirModal({
  params, saving, onSave, onClose,
}: {
  params: Params; saving: boolean
  onSave: (p: Params) => Promise<void>; onClose: () => void
}) {
  const [vals, setVals] = useState<Params>({ ...params })
  useEffect(() => { setVals({ ...params }) }, [params])
  function set(key: string, val: string) { setVals(v => ({ ...v, [key]: parseFloat(val) || 0 })) }
  const thrCls  = 'w-16 text-right text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-brand-400 tabular-nums bg-white'
  const rateCls = 'w-20 text-right text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-brand-400 tabular-nums bg-white'
  function TierTable({ prefix, headerBg }: { prefix: string; headerBg: string }) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: headerBg + '40' }}>
        <div className="text-white text-xs font-bold px-4 py-2.5 text-center" style={{ backgroundColor: headerBg }}>
          {prefix === 'elx' ? 'Electrolux' : 'Relux'}
        </div>
        <table className="text-xs w-full border-collapse">
          <thead><tr style={{ backgroundColor: headerBg + '15' }}>
            <th className="px-3 py-2 text-left font-semibold border-b text-gray-700">Gerçekleşme</th>
            <th className="px-3 py-2 text-center font-semibold border-b text-gray-700">Prim Oranı (%)</th>
          </tr></thead>
          <tbody>
            {[1,2,3,4].map(i => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 text-gray-500">
                    <span>≥</span>
                    <input type="number" step="1" min="0" max="999"
                      value={vals[`${prefix}_t${i}_thr`] ?? ''} onChange={e => set(`${prefix}_t${i}_thr`, e.target.value)} className={thrCls} />
                    <span>%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="number" step="0.01" min="0" max="100"
                    value={vals[`${prefix}_t${i}_rate`] ?? ''} onChange={e => set(`${prefix}_t${i}_rate`, e.target.value)} className={rateCls} />
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
          <div className="grid grid-cols-2 gap-4">
            <TierTable prefix="elx"   headerBg="#003087" />
            <TierTable prefix="relux" headerBg="#6b21a8" />
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2.5">Çarpanlar</div>
            <div className="divide-y divide-gray-100 text-xs">
              {[
                { key: 'carp1', label: 'Markalardan biri', op: '<', suffix: '% ise prim ×', badge: '①', color: 'orange' },
                { key: 'carp2', label: 'Şirket toplam gerc.', op: '<', suffix: '% ise prim ×', badge: '②', color: 'red' },
                { key: 'carp3', label: 'Tahsilat gerçekleşmesi ≥', op: '', suffix: '% ise prim ×', badge: '③', color: 'green' },
              ].map(({ key, label, op, suffix, badge, color }) => (
                <div key={key} className="px-4 py-3 flex items-center gap-2 text-gray-700 flex-wrap">
                  <span className={clsx('w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0',
                    color==='orange'?'bg-orange-100 text-orange-700':color==='red'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'
                  )}>{badge}</span>
                  <span className="flex-1 min-w-[120px]">{label}</span>
                  {op && <span className="text-gray-400">{op}</span>}
                  <input type="number" step="1" min="0" max="999"
                    value={vals[`${key}_thr`]??''} onChange={e=>set(`${key}_thr`,e.target.value)} className={thrCls} />
                  <span className="text-gray-400">{suffix}</span>
                  <input type="number" step="0.01" min="0" max="100"
                    value={vals[`${key}_val`]??''} onChange={e=>set(`${key}_val`,e.target.value)} className={rateCls} />
                </div>
              ))}
            </div>
          </div>
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
  yil: number; ay: number; bsyAdlar: string[]
  getKisiHedef: (bsyAdi: string, brand: BrandKey) => { hedefCiro: number; hakedilenPrim: number | null }
  saving: boolean
  onSave: (
    hedefRows: { bsyAdi: string; brand: BrandKey; hedefCiro: number; hakedilenPrim: number | null }[],
    extraRows: { bsyAdi: string; markaCarp: number | null; tahsiatCarp: number | null }[]
  ) => Promise<void>
  onClose: () => void
}) {
  const [vals, setVals] = useState<Record<string, { elx: string; relux: string }>>(() => {
    const init: Record<string, { elx: string; relux: string }> = {}
    bsyAdlar.forEach(bsy => {
      const e = getKisiHedef(bsy, 'ELECTROLUX')
      const r = getKisiHedef(bsy, 'RELUX')
      init[bsy] = {
        elx:   e.hedefCiro > 0 ? String(e.hedefCiro) : '',
        relux: r.hedefCiro > 0 ? String(r.hedefCiro) : '',
      }
    })
    return init
  })

  function handleChange(bsy: string, field: 'elx' | 'relux', raw: string) {
    const digits = raw.replace(/[^\d]/g, '')
    setVals(v => ({ ...v, [bsy]: { ...v[bsy], [field]: digits } }))
  }
  function display(s: string) { const n = parseInt(s)||0; return n>0 ? n.toLocaleString('tr-TR') : '' }
  function toNum(s: string) { return parseInt(s) || 0 }

  const totalElx   = bsyAdlar.reduce((s, b) => s + toNum(vals[b]?.elx   ?? ''), 0)
  const totalRelux = bsyAdlar.reduce((s, b) => s + toNum(vals[b]?.relux ?? ''), 0)
  const totalAll   = totalElx + totalRelux

  function pct(val: number, tot: number) {
    return (tot > 0 && val > 0) ? (val/tot*100).toFixed(1) : null
  }

  async function handleSave() {
    const hedefRows = bsyAdlar.flatMap(bsy => [
      { bsyAdi: bsy, brand: 'ELECTROLUX' as BrandKey, hedefCiro: toNum(vals[bsy]?.elx   ?? ''), hakedilenPrim: null },
      { bsyAdi: bsy, brand: 'RELUX'       as BrandKey, hedefCiro: toNum(vals[bsy]?.relux ?? ''), hakedilenPrim: null },
    ])
    await onSave(hedefRows, [])
    onClose()
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
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[150px]">Electrolux Hedef Ciro</th>
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[65px]">Elx %</th>
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[150px]">Relux Hedef Ciro</th>
                <th className="border border-gray-600 px-2 py-1.5 text-center min-w-[65px]">Relux %</th>
              </tr>
            </thead>
            <tbody>
              {bsyAdlar.map((bsy, i) => {
                const ev = toNum(vals[bsy]?.elx ?? ''), rv = toNum(vals[bsy]?.relux ?? '')
                const ep = pct(ev, totalElx), rp = pct(rv, totalRelux)
                return (
                  <tr key={bsy} className={clsx('border-b border-gray-100', i%2===1 && 'bg-gray-50/50')}>
                    <td className="border border-gray-100 px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">{bsy}</td>
                    <td className="border border-gray-100 p-1">
                      <input type="text" inputMode="numeric" value={display(vals[bsy]?.elx??'')}
                        onChange={e => handleChange(bsy,'elx',e.target.value)} placeholder="0" className={inputCls} />
                    </td>
                    <td className="border border-gray-100 px-2 py-1.5 text-center">
                      {ep ? <span className={clsx('font-semibold', parseFloat(ep)>=15?'text-blue-600':'text-gray-500')}>%{ep}</span>
                          : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="border border-gray-100 p-1">
                      <input type="text" inputMode="numeric" value={display(vals[bsy]?.relux??'')}
                        onChange={e => handleChange(bsy,'relux',e.target.value)} placeholder="0" className={inputCls} />
                    </td>
                    <td className="border border-gray-100 px-2 py-1.5 text-center">
                      {rp ? <span className={clsx('font-semibold', parseFloat(rp)>=15?'text-purple-600':'text-gray-500')}>%{rp}</span>
                          : <span className="text-gray-200">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-900 text-white font-semibold text-[11px]">
                <td className="border border-gray-700 px-3 py-2">
                  Toplam
                  {totalAll > 0 && <span className="ml-2 text-[10px] text-gray-400 font-normal">{totalAll.toLocaleString('tr-TR')} ₺</span>}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-right tabular-nums">{totalElx>0?totalElx.toLocaleString('tr-TR'):'—'}</td>
                <td className="border border-gray-700 px-3 py-2 text-center text-blue-300">{totalElx>0?'%100':'—'}</td>
                <td className="border border-gray-700 px-3 py-2 text-right tabular-nums">{totalRelux>0?totalRelux.toLocaleString('tr-TR'):'—'}</td>
                <td className="border border-gray-700 px-3 py-2 text-center text-purple-300">{totalRelux>0?'%100':'—'}</td>
              </tr>
            </tfoot>
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
  yil, ay, bsyRows, allBsyNames, getKisiHedef, getKisiExtra, params, tahsilatRows,
}: {
  yil: number; ay: number; bsyRows: BsyBrandRow[]; allBsyNames: string[]
  getKisiHedef: (bsyAdi: string, brand: BrandKey) => { hedefCiro: number; hakedilenPrim: number | null }
  getKisiExtra: (bsyAdi: string) => { markaCarp: number | null; tahsiatCarp: number | null }
  params: Params | null   // null = ay<5 → DB prim; set = ay≥5 → parametrik hesap
  tahsilatRows: { bsyAdi: string; oran: number }[]
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

  // Şirket genel toplam (② çarpanı için)
  let compGerc = 0, compHedef = 0
  mergedRows.forEach(r => {
    compGerc  += r.brands['ELECTROLUX'].gercCiro + r.brands['RELUX'].gercCiro
    compHedef += getKisiHedef(r.bsyAdi,'ELECTROLUX').hedefCiro + getKisiHedef(r.bsyAdi,'RELUX').hedefCiro
  })

  const isExcluded = (bsyAdi: string) =>
    PRIM_EXCLUDED_BSYS.some(n => bsyAdi.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'))

  function getTahsilatOran(bsyAdi: string) {
    return tahsilatRows.find(r => r.bsyAdi.toLocaleLowerCase('tr') === bsyAdi.toLocaleLowerCase('tr'))?.oran ?? 0
  }

  function getPrims(row: BsyBrandRow): { elxPrim: number; reluxPrim: number; topPrim: number } {
    const excluded = isExcluded(row.bsyAdi)
    const elx   = getKisiHedef(row.bsyAdi,'ELECTROLUX')
    const relux = getKisiHedef(row.bsyAdi,'RELUX')

    if (params === null) {
      // ay < 5: prim hesaplama yapma, sadece DB'deki manuel değeri Toplam'a yansıt
      if (excluded) return { elxPrim:0, reluxPrim:0, topPrim:0 }
      const manuelToplam = (elx.hakedilenPrim ?? 0) + (relux.hakedilenPrim ?? 0)
      return { elxPrim:0, reluxPrim:0, topPrim: manuelToplam }
    }
    // ay >= 5: parametrik hesap
    return calcTieredPrimBsy(
      row.brands['ELECTROLUX'].gercCiro, elx.hedefCiro,
      row.brands['RELUX'].gercCiro, relux.hedefCiro,
      compGerc, compHedef, getTahsilatOran(row.bsyAdi), params, excluded,
    )
  }

  // Alt toplam hesapları
  const totals = {
    elxHedef:0, elxGerc:0, elxPrim:0,
    reluxHedef:0, reluxGerc:0, reluxPrim:0,
    toplamHedef:0, toplamGerc:0, toplamPrim:0,
  }
  mergedRows.forEach(row => {
    const elx   = getKisiHedef(row.bsyAdi,'ELECTROLUX')
    const relux = getKisiHedef(row.bsyAdi,'RELUX')
    const { elxPrim, reluxPrim, topPrim } = getPrims(row)
    totals.elxHedef    += elx.hedefCiro
    totals.elxGerc     += row.brands['ELECTROLUX'].gercCiro
    totals.elxPrim     += elxPrim
    totals.reluxHedef  += relux.hedefCiro
    totals.reluxGerc   += row.brands['RELUX'].gercCiro
    totals.reluxPrim   += reluxPrim
    totals.toplamHedef += elx.hedefCiro + relux.hedefCiro
    totals.toplamGerc  += row.brands['ELECTROLUX'].gercCiro + row.brands['RELUX'].gercCiro
    totals.toplamPrim  += topPrim
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
            const elx       = getKisiHedef(row.bsyAdi,'ELECTROLUX')
            const relux     = getKisiHedef(row.bsyAdi,'RELUX')
            const elxGerc   = row.brands['ELECTROLUX'].gercCiro
            const reluxGerc = row.brands['RELUX'].gercCiro
            const topHedef  = elx.hedefCiro + relux.hedefCiro
            const topGerc   = elxGerc + reluxGerc
            const { elxPrim, reluxPrim, topPrim } = getPrims(row)
            const excluded  = isExcluded(row.bsyAdi)
            const tahsilOran = getTahsilatOran(row.bsyAdi)

            // Çarpan göstergeleri — sadece parametrik hesap aktifken (params !== null)
            const c1thr = params?.['carp1_thr'] ?? 50
            const achElxPct   = elx.hedefCiro   > 0 ? (elxGerc   / elx.hedefCiro)   * 100 : -1
            const achReluxPct = relux.hedefCiro > 0 ? (reluxGerc / relux.hedefCiro) * 100 : -1
            const carp1Active = !excluded && params !== null && (
              (achElxPct >= 0 && achElxPct < c1thr) || (achReluxPct >= 0 && achReluxPct < c1thr)
            )
            const compAchPct = compHedef > 0 ? (compGerc / compHedef) * 100 : 0
            const carp2Active = !excluded && params !== null && compAchPct < (params['carp2_thr'] ?? 80)
            const carp3Active = !excluded && params !== null && tahsilOran >= (params['carp3_thr'] ?? 100)

            return (
              <tr key={row.bsyAdi} className={clsx(
                'border-b border-gray-100 hover:bg-blue-50/20',
                idx % 2 === 1 && 'bg-gray-50/40'
              )}>
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 font-medium text-gray-800">
                  <div className="flex flex-col gap-0.5">
                    <span className={excluded ? 'italic text-gray-500' : ''}>{row.bsyAdi}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {excluded && <span className="text-[9px] bg-gray-200 text-gray-500 rounded px-1 py-0.5">prim yok</span>}
                      {carp1Active && <span className="text-[9px] bg-orange-100 text-orange-700 rounded px-1 py-0.5 font-semibold">①×{params!['carp1_val'] ?? 0.70}</span>}
                      {carp2Active && <span className="text-[9px] bg-red-100 text-red-700 rounded px-1 py-0.5 font-semibold">②×{params!['carp2_val'] ?? 0.50}</span>}
                      {carp3Active && <span className="text-[9px] bg-green-100 text-green-700 rounded px-1 py-0.5 font-semibold">③×{params!['carp3_val'] ?? 1.50}</span>}
                      {params !== null && tahsilOran > 0 && <span className="text-[9px] text-gray-400">Tah:{Math.round(tahsilOran)}%</span>}
                    </div>
                  </div>
                </td>
                {/* ELECTROLUX */}
                <td className={cellCls + ' text-gray-700'}>{elx.hedefCiro > 0 ? fmtCur(elx.hedefCiro) : '—'}</td>
                <td className={cellCls + ' text-gray-800'}>{elxGerc !== 0 ? fmtCur(elxGerc) : '—'}</td>
                <OranCell gerc={elxGerc} hedef={elx.hedefCiro} className={pctCls} />
                <td className={cellCls + (params !== null && elxPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                  {params !== null && elxPrim > 0 ? fmtCur(elxPrim) : '—'}
                </td>
                {/* RELUX */}
                <td className={cellCls + ' text-gray-700'}>{relux.hedefCiro > 0 ? fmtCur(relux.hedefCiro) : '—'}</td>
                <td className={cellCls + ' text-gray-800'}>{reluxGerc !== 0 ? fmtCur(reluxGerc) : '—'}</td>
                <OranCell gerc={reluxGerc} hedef={relux.hedefCiro} className={pctCls} />
                <td className={cellCls + (params !== null && reluxPrim > 0 ? ' text-green-600 font-semibold' : ' text-gray-300')}>
                  {params !== null && reluxPrim > 0 ? fmtCur(reluxPrim) : '—'}
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
              {params !== null && totals.elxPrim > 0 ? fmtCur(totals.elxPrim) : '—'}
            </td>
            {/* RELUX */}
            <td className={ftCellCls + ' text-gray-700'}>{totals.reluxHedef > 0 ? fmtCur(totals.reluxHedef) : '—'}</td>
            <td className={ftCellCls + ' text-red-700'}>{fmtCur(totals.reluxGerc)}</td>
            <td className={clsx(ftPctCls, totals.reluxHedef > 0 ? ((totals.reluxGerc / totals.reluxHedef) * 100 >= 80 ? 'text-green-700' : 'text-red-600') : 'text-gray-300')}>
              {totals.reluxHedef > 0 ? fmtPct((totals.reluxGerc / totals.reluxHedef) * 100) : '—'}
            </td>
            <td className={ftCellCls + (totals.reluxPrim > 0 ? ' text-green-700' : ' text-gray-300')}>
              {params !== null && totals.reluxPrim > 0 ? fmtCur(totals.reluxPrim) : '—'}
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
export function BsyView({ isAdmin = false, isBsy = false, bsyAdi = '' }: { isAdmin?: boolean; isBsy?: boolean; bsyAdi?: string }) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay,  setAy]  = useState(now.getMonth() + 1)
  const [showModal,       setShowModal]       = useState(false)
  const [showKisiModal,   setShowKisiModal]   = useState(false)
  const [showParamModal,  setShowParamModal]  = useState(false)

  const { params, saving: paramSaving, save: saveParams } = useBsyParametreler()
  const [showParamGirModal, setShowParamGirModal] = useState(false)
  // ay >= 5 → parametrik hesap; ay < 5 → DB manuel prims
  const activeParams = ay >= 5 ? params : null
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


  // ── Tahsilat verileri ──────────────────────────────────────────
  interface TahsilatRow { bsyAdi: string; acikHesap: number; hedef: number; gerceklesen: number; oran: number }
  interface TahsilatDetayRow { bsyAdi: string; cariIsim: string; ay: number; tur: string; acikHesap: number; gerceklesen: number }
  const [tahsilatRows,    setTahsilatRows]    = useState<TahsilatRow[]>([])
  const [tahsilatDetay,   setTahsilatDetay]   = useState<TahsilatDetayRow[]>([])
  const [tahsilatLoading, setTahsilatLoading] = useState(false)

  useEffect(() => {
    setTahsilatLoading(true)
    fetch(`/api/tahsilat?yil=${yil}&ay=${ay}`)
      .then(r => r.json())
      .then(d => {
        const allRows: TahsilatRow[] = d.rows ?? []
        setTahsilatRows(allRows)
        setTahsilatDetay(d.detay ?? [])
      })
      .finally(() => setTahsilatLoading(false))
  }, [yil, ay])

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      // 1. Supabase'den imzalı yükleme URL'si al (Vercel üzerinden küçük istek)
      const presignRes = await fetch('/api/bsy-excel-presign', { method: 'POST' })
      const presign    = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error ?? 'Presign hatası')

      // 2. Dosyayı doğrudan Supabase Storage'a yükle (Vercel 4.5MB limitini atlar)
      const uploadRes = await fetch(presign.signedUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      })
      if (!uploadRes.ok) throw new Error('Supabase yükleme hatası: ' + uploadRes.status)

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
              onClick={() => setShowKisiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              <Settings2 size={12} />
              Hedef Gir
            </button>

          </>
        )}

        {/* Parametre Gir — sadece admin */}
        {isAdmin && (
          <button
            onClick={() => setShowParamGirModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm"
          >
            <SlidersHorizontal size={12} />
            Parametre Gir
          </button>
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

          {/* ══ Kişi Bazlı Ciro + Prim Tablosu (tüm aylar) ══ */}
          <BsyKisiTable
            yil={yil}
            ay={ay}
            bsyRows={isBsy && bsyAdi ? bsyRows.filter(r => r.bsyAdi === bsyAdi) : bsyRows}
            allBsyNames={isBsy && bsyAdi ? [bsyAdi] : allBsyNames}
            getKisiHedef={getKisiHedef}
            getKisiExtra={getKisiExtra}
            params={activeParams}
            tahsilatRows={tahsilatRows}
          />


          {/* ══════════════════════════════════════════════════
               TAHSİLAT HEDEF TABLOSU
          ══════════════════════════════════════════════════ */}
          <TahsilatTablosu
            yil={yil}
            ay={ay}
            rows={tahsilatRows}
            loading={tahsilatLoading}
          />

          {/* ── Tahsilat Detayı ───────────────────────────── */}
          {!tahsilatLoading && tahsilatDetay.length > 0 && (
            <TahsilatDetayTablosu
              detay={isBsy && bsyAdi
                ? tahsilatDetay.filter(r => r.bsyAdi === bsyAdi)
                : tahsilatDetay}
              ay={ay}
              yil={yil}
              tekBsy={isBsy}
            />
          )}


        </div>
      )}

      {/* ── Eski Hedef Giriş Modalı (ay < 5) ───────────────────── */}
      {false && (
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
      {showKisiModal && (
        <KisiHedefModal
          yil={yil}
          ay={ay}
          bsyAdlar={isBsy && bsyAdi ? [bsyAdi] : (allBsyNames.length > 0 ? allBsyNames : bsyRows.map(r => r.bsyAdi))}
          getKisiHedef={getKisiHedef}
          saving={kisiSaving}
          onSave={saveKisi}
          onClose={() => setShowKisiModal(false)}
        />
      )}

      {/* ── Parametreler Modalı ─────────────────────────────────── */}
      {showParamGirModal && isAdmin && (
        <ParametreGirModal
          params={params}
          saving={paramSaving}
          onSave={async p => { await saveParams(p); setShowParamGirModal(false) }}
          onClose={() => setShowParamGirModal(false)}
        />
      )}
      {showParamModal && (
        <ParametrelerModal isAdmin={isAdmin} onClose={() => setShowParamModal(false)} />
      )}
    </div>
  )
}

// ─── Tahsilat Hedef Tablosu ────────────────────────────────────
function TahsilatTablosu({
  yil, ay, rows, loading,
}: {
  yil:     number
  ay:      number
  rows:    { bsyAdi: string; acikHesap: number; hedef: number; gerceklesen: number; oran: number }[]
  loading: boolean
}) {
  const toplamAcik  = rows.reduce((s, r) => s + r.acikHesap,   0)
  const toplamHedef = rows.reduce((s, r) => s + r.hedef,       0)
  const toplamGerc  = rows.reduce((s, r) => s + r.gerceklesen, 0)
  const toplamOran  = toplamHedef > 0 ? (toplamGerc / toplamHedef) * 100 : 0

  return (
    <div className="space-y-0">
      {/* Başlık */}
      <div className="flex items-baseline gap-2 px-3 py-2 rounded-t-xl text-white text-xs font-bold bg-[#b45309]">
        Tahsilat Hedef Tablosu
        <span className="font-normal opacity-80 text-[10px]">
          {MONTHS_TR[ay - 1]} {yil} · Açık Hesap × %90
        </span>
      </div>

      <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
            <RefreshCw size={13} className="animate-spin" /> Yükleniyor…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            Bu döneme ait tahsilat verisi bulunamadı
          </div>
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
                  <tr key={row.bsyAdi} className={clsx(
                    'border-b border-gray-100 last:border-0',
                    ok ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                  )}>
                    <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-inherit whitespace-nowrap">{row.bsyAdi}</td>
                    <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                      {row.acikHesap > 0 ? fmtCur(row.acikHesap) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">
                      {row.hedef > 0 ? fmtCur(row.hedef) : '—'}
                    </td>
                    <td className={clsx('px-3 py-2 text-right font-bold tabular-nums',
                      row.gerceklesen > 0 ? (ok ? 'text-green-700' : 'text-gray-900') : 'text-gray-300'
                    )}>
                      {row.gerceklesen > 0 ? fmtCur(row.gerceklesen) : '—'}
                    </td>
                    <td className={clsx('px-3 py-2 text-center font-semibold tabular-nums',
                      row.hedef > 0
                        ? ok ? 'text-green-600' : row.oran >= 80 ? 'text-amber-600' : 'text-red-500'
                        : 'text-gray-300'
                    )}>
                      {row.hedef > 0 ? fmtPct(row.oran) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.hedef > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden min-w-[80px]">
                            <div
                              className={clsx('h-2 rounded-full transition-all duration-500',
                                ok ? 'bg-green-500' : row.oran >= 80 ? 'bg-amber-400' : 'bg-red-400'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums">
                            {Math.round(pct)}%
                          </span>
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

// ─── Tahsilat Detay Tablosu ───────────────────────────────────
interface DetayRow { bsyAdi: string; cariIsim: string; ay: number; tur: string; acikHesap: number; gerceklesen: number }

function TahsilatDetayTablosu({
  detay, ay, yil, tekBsy,
}: {
  detay:   DetayRow[]
  ay:      number
  yil:     number
  tekBsy:  boolean   // BSY kullanıcısı → BSY sütunu gösterme
}) {
  const toplamGerc = detay.reduce((s, r) => s + r.gerceklesen, 0)
  const toplamAcik = detay.reduce((s, r) => s + r.acikHesap,   0)

  return (
    <div className="space-y-0">
      <div className="flex items-baseline gap-2 px-3 py-2 rounded-t-xl text-white text-xs font-bold bg-[#7c3aed]">
        Tahsilat Detayı
        <span className="font-normal opacity-80 text-[10px]">
          {MONTHS_TR[ay - 1]} {yil} · Cari & Tahsilat Tipi Bazında
        </span>
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {!tekBsy && <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">BSY</th>}
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Cari İsim</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[120px]">Açık Hesap</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[120px]">Gerçekleşen</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-500 min-w-[120px]">Tahsilat Tipi</th>
            </tr>
          </thead>
          <tbody>
            {detay.map((r, i) => (
              <tr key={i} className={clsx('border-b border-gray-50 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                {!tekBsy && (
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-[11px]">{r.bsyAdi}</td>
                )}
                <td className="px-3 py-2 font-medium text-gray-800">{r.cariIsim}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {r.acikHesap > 0 ? fmtCur(r.acikHesap) : '—'}
                </td>
                <td className={clsx('px-3 py-2 text-right tabular-nums font-semibold',
                  r.gerceklesen > 0 ? 'text-green-700' : 'text-gray-300')}>
                  {r.gerceklesen > 0 ? fmtCur(r.gerceklesen) : '—'}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {r.tur ? (
                    <span className="text-[10px] bg-violet-50 text-violet-700 rounded px-1.5 py-0.5 font-medium">
                      {r.tur}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#7c3aed] text-white text-[10px] font-semibold">
              <td className="px-3 py-2" colSpan={tekBsy ? 1 : 2}>Toplam</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtCur(toplamAcik)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtCur(toplamGerc)}</td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── BSY Rapor Tablo Bileşeni ──────────────────────────────────
function BsyRaporTablosu({
  baslik, altyazi, rows, aylar, renkClass,
}: {
  baslik:    string
  altyazi:   string
  rows:      { bsyAdi: string; ay: number; adet: number }[]
  aylar:     number[]
  renkClass: string
}) {
  // BSY listesi (adet toplamına göre sıralı)
  const bsyler = [...new Set(rows.map(r => r.bsyAdi))].sort((a, b) => {
    const totA = rows.filter(r => r.bsyAdi === a).reduce((s, r) => s + r.adet, 0)
    const totB = rows.filter(r => r.bsyAdi === b).reduce((s, r) => s + r.adet, 0)
    return totB - totA
  })

  // pivot: bsyAdi → ay → adet
  const pivot = new Map<string, Map<number, number>>()
  rows.forEach(r => {
    if (!pivot.has(r.bsyAdi)) pivot.set(r.bsyAdi, new Map())
    pivot.get(r.bsyAdi)!.set(r.ay, r.adet)
  })

  // ay toplamları
  const ayToplam = new Map<number, number>()
  aylar.forEach(ay => {
    ayToplam.set(ay, rows.filter(r => r.ay === ay).reduce((s, r) => s + r.adet, 0))
  })
  const genelToplam = rows.reduce((s, r) => s + r.adet, 0)

  if (bsyler.length === 0) {
    return (
      <div>
        <div className={clsx('px-3 py-2 rounded-t-xl text-white text-xs font-bold', renkClass)}>
          {baslik} <span className="font-normal opacity-80 ml-1">{altyazi}</span>
        </div>
        <div className="border border-t-0 border-gray-200 rounded-b-xl px-4 py-6 text-center text-xs text-gray-400">
          Veri bulunamadı
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Başlık */}
      <div className={clsx('px-3 py-2 rounded-t-xl text-white text-xs font-bold flex items-baseline gap-2', renkClass)}>
        {baslik}
        <span className="font-normal opacity-80 text-[10px]">{altyazi}</span>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto border border-t-0 border-gray-200 rounded-b-xl">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">BSY</th>
              {aylar.map(ay => (
                <th key={ay} className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap min-w-[70px]">
                  {MONTHS_TR[ay - 1]}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-bold text-gray-700 whitespace-nowrap">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {bsyler.map((bsy, idx) => {
              const ayMap   = pivot.get(bsy) ?? new Map()
              const toplam  = [...ayMap.values()].reduce((s, v) => s + v, 0)
              return (
                <tr key={bsy} className={clsx('border-b border-gray-100 last:border-0', idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-inherit">{bsy}</td>
                  {aylar.map(ay => {
                    const adet = ayMap.get(ay) ?? 0
                    return (
                      <td key={ay} className="px-3 py-2 text-right text-gray-700 tabular-nums">
                        {adet > 0 ? adet.toLocaleString('tr-TR') : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-bold text-gray-900 tabular-nums">{toplam.toLocaleString('tr-TR')}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={clsx('text-white text-[10px] font-semibold', renkClass)}>
              <td className="px-3 py-2">Toplam</td>
              {aylar.map(ay => (
                <td key={ay} className="px-3 py-2 text-right tabular-nums">
                  {(ayToplam.get(ay) ?? 0).toLocaleString('tr-TR')}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-bold">{genelToplam.toLocaleString('tr-TR')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
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
