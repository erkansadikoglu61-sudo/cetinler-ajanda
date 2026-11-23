'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { RefreshCw, X, Save, Target, ChevronDown, ChevronRight, FileDown, Upload, Truck, MapPin } from 'lucide-react'
import { SubeStokYukle, type SevkYukleme } from '@/components/SubeStokYukle'
import { isoTarih, subeKompakt } from '@/lib/subeStok'
import * as XLSX from 'xlsx'
import clsx from 'clsx'

import { useSellout } from '@/hooks/useSellout'
import { useSelloutTargets, ProfileTarget, MerchTarget } from '@/hooks/useSelloutTargets'
import {
  SELLOUT_GROUPS, GRUP_NORMALIZE,
  PRIM_SUP, PRIM_JR, PRIM_MERCH,
  calcPrim, namesMatch, normalizeName, donemdeAktif,
  fmtCur, currentDonem, donemOptions, donemLabel,
} from '@/lib/sellout'
import { Profile, supabase } from '@/lib/supabase'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'
import { SayfaParametreleri } from '@/components/SayfaParametreleri'
import { SelloutAciklama } from '@/components/SelloutAciklama'
import { getOzelGruplar, ozelSubeAdetleri, buildOzelCarpan } from '@/lib/ozelUygulama'
import { DEVIR_DONEMI, isDevirSup, devraldiklari } from '@/lib/supDevir'

type SubTab = 'sup' | 'jr' | 'merch' | 'top20' | 'satislar' | 'satisgirmeyen' | 'ozel'

// EKSTRA Prim grupları/eşikleri ve çift prim çarpanı: lib/ozelUygulama (tek kaynak).

// PHP TARIH ("DD.MM.YYYY") veya "YYYY-MM-DD" → karşılaştırılabilir "YYYY-MM-DD".
// Parse edilemezse '' döner (o zaman ay bazlı karşılaştırmaya düşülür).
function tarihToIso(t: string): string {
  const s = (t || '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

// ─── Top-30 yardımcı tipler ───
interface Top20Row { cariIsim: string; subeAdi: string; adet: number; sira?: number }

function calcTop20(
  periodRows: import('@/hooks/useSellout').SelloutRow[],
  filter: (r: import('@/hooks/useSellout').SelloutRow) => boolean,
): Top20Row[] {
  const map = new Map<string, Top20Row>()
  periodRows.filter(filter).forEach(r => {
    const key = `${r.cari_isim}||${r.sube_adi}`
    const ex  = map.get(key) ?? { cariIsim: r.cari_isim, subeAdi: r.sube_adi, adet: 0 }
    ex.adet  += r.satilan_adet
    map.set(key, ex)
  })
  return [...map.values()].sort((a, b) => b.adet - a.adet).map((r, i) => ({ ...r, sira: i + 1 }))
}

function Top20Table({
  title, subtitle, data, colorMap, highlight,
}: {
  title: string
  subtitle?: string
  data: Top20Row[]
  colorMap: Map<string, string>
  highlight?: Set<string>   // 'cari||şube' — vurgulanacak satırlar (Merch kullanıcısının şubeleri)
}) {
  if (data.length === 0) return (
    <div className="text-xs text-gray-400 text-center py-6">Bu dönemde veri yok.</div>
  )
  const toplam = data.reduce((s, d) => s + d.adet, 0)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ maxHeight: '560px' }}>
      {/* Başlık — sabit */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 flex items-baseline gap-2">
        <span className="text-xs font-bold text-gray-800">{title}</span>
        {subtitle && <span className="text-[10px] text-gray-400">{subtitle}</span>}
        <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{data.length} şube</span>
      </div>

      {/* Kaydırılabilir satırlar */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-800 text-white">
              <th className="px-2 py-2 text-center font-semibold w-7">#</th>
              <th className="px-3 py-2 text-left font-semibold">Cari</th>
              <th className="px-3 py-2 text-left font-semibold">Şube</th>
              <th className="px-3 py-2 text-right font-semibold">Adet</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const color = colorMap.get(d.cariIsim) ?? '#6B7280'
              return (
                <tr key={i} className={clsx(
                  'border-b border-gray-100 transition-colors',
                  highlight?.has(`${d.cariIsim}||${d.subeAdi}`) ? 'bg-amber-100 font-semibold' : 'hover:bg-gray-50/60'
                )}>
                  <td className="px-2 py-1.5 text-center text-gray-400 font-medium text-[10px]">{d.sira ?? i + 1}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold" style={{ color }}>
                        {d.cariIsim?.split(' ')[0] ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{d.subeAdi}</td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color }}>
                    {d.adet.toLocaleString('tr-TR')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Toplam satırı — sabit altta */}
      <div className="flex-shrink-0 border-t-2 border-gray-300">
        <table className="w-full text-xs border-collapse">
          <tbody>
            <tr className="bg-gray-800 text-white font-semibold text-[11px]">
              <td className="px-2 py-2 w-7" />
              <td colSpan={2} className="px-3 py-2">Toplam</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {toplam.toLocaleString('tr-TR')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── helpers ───
function pct(hedef: number, gerc: number) {
  return hedef > 0 ? (gerc / hedef) * 100 : 0
}

function PctBadge({ val }: { val: number }) {
  return (
    <span className={clsx(
      'inline-block px-1 py-0.5 rounded text-[10px] font-bold whitespace-nowrap',
      val >= 100 ? 'bg-green-200 text-green-900'
        : val >= 80  ? 'bg-green-100 text-green-800'
        : val >= 60  ? 'bg-yellow-100 text-yellow-800'
        :              'bg-red-100   text-red-700'
    )}>%{val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  )
}

// ─── Target entry modal (generic) ─────────────────────────────
interface TargetRow {
  key: string          // profile_id or merch_name
  label: string
  sublabel?: string
  isProfile: boolean   // true → profile_targets, false → merch_targets
  supervisorName?: string
}

function TargetEntryModal({
  title, rows, groups, initialValues, donem, enteredBy, onSave, onClose, saving,
  showDestekCol, destekInitial, gizleInitial, onSaveDestek,
}: {
  title: string
  rows: TargetRow[]
  groups: readonly string[]
  initialValues: (key: string, grup: string) => number
  donem: string
  enteredBy: string
  onSave: (profileTargets: ProfileTarget[], merchTargets: MerchTarget[]) => Promise<void>
  onClose: () => void
  saving: boolean
  showDestekCol?: boolean
  destekInitial?: (key: string) => boolean
  gizleInitial?: (key: string) => boolean
  onSaveDestek?: (flags: { merch_name: string; destek_var: boolean; gizle: boolean }[]) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    rows.forEach(r => groups.forEach(g => {
      init[`${r.key}||${g}`] = initialValues(r.key, g)
    }))
    return init
  })

  const [destekValues, setDestekValues] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    if (showDestekCol && destekInitial) rows.forEach(r => { init[r.key] = destekInitial(r.key) })
    return init
  })

  const showGizleCol = !!gizleInitial
  const [gizleValues, setGizleValues] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    if (showGizleCol && gizleInitial) rows.forEach(r => { init[r.key] = gizleInitial(r.key) })
    return init
  })

  const set = (key: string, grup: string, val: number) =>
    setValues(p => ({ ...p, [`${key}||${grup}`]: val }))

  const setDestek = (key: string, val: boolean) =>
    setDestekValues(p => ({ ...p, [key]: val }))

  const setGizle = (key: string, val: boolean) =>
    setGizleValues(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    const profileRows: ProfileTarget[] = []
    const merchRows: MerchTarget[]     = []
    rows.forEach(r => {
      groups.forEach(g => {
        const h = values[`${r.key}||${g}`] ?? 0
        if (r.isProfile) {
          profileRows.push({ donem, profile_id: r.key, grup: g, hedef: h, entered_by: enteredBy })
        } else {
          merchRows.push({ donem, merch_name: r.key, supervisor_name: r.supervisorName, grup: g, hedef: h, entered_by: enteredBy })
        }
      })
    })
    await onSave(profileRows, merchRows)
    if (showDestekCol && onSaveDestek) {
      const flags = rows.filter(r => !r.isProfile).map(r => ({
        merch_name: r.key,
        destek_var: destekValues[r.key] ?? false,
        gizle: gizleValues[r.key] ?? false,
      }))
      await onSaveDestek(flags)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-2 pt-4 overflow-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-brand-700" />
            <h2 className="font-semibold text-sm">{title} — {donemLabel(donem)}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 text-white rounded-lg text-xs font-medium hover:bg-brand-600 disabled:opacity-50"
            >
              <Save size={13} />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-3">
          <table className="text-xs border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-medium text-gray-600 border border-gray-200 min-w-[140px]">Kişi</th>
                {showDestekCol && (
                  <th className="text-center px-3 py-2 font-medium text-gray-600 border border-gray-200 min-w-[110px] bg-amber-50">Destek Personeli Var mı?</th>
                )}
                {showGizleCol && (
                  <th className="text-center px-3 py-2 font-medium text-gray-600 border border-gray-200 min-w-[110px] bg-rose-50">Listede Görünmesin</th>
                )}
                {groups.map(g => (
                  <th key={g} className="text-center px-3 py-2 font-medium text-gray-600 border border-gray-200 min-w-[80px]">{g}</th>
                ))}
                <th className="text-center px-3 py-2 font-medium text-gray-600 border border-gray-200">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const total = groups.reduce((s, g) => s + (values[`${r.key}||${g}`] ?? 0), 0)
                return (
                  <tr key={r.key} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border border-gray-200 px-3 py-1.5 min-w-[140px]">
                      <p className="font-medium text-gray-800 truncate">{r.label}</p>
                      {r.sublabel && <p className="text-[10px] text-gray-400">{r.sublabel}</p>}
                    </td>
                    {showDestekCol && (
                      <td className="border border-gray-200 p-1 text-center bg-amber-50">
                        <input
                          type="checkbox"
                          checked={destekValues[r.key] ?? false}
                          onChange={e => setDestek(r.key, e.target.checked)}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {showGizleCol && (
                      <td className="border border-gray-200 p-1 text-center bg-rose-50">
                        <input
                          type="checkbox"
                          checked={gizleValues[r.key] ?? false}
                          onChange={e => setGizle(r.key, e.target.checked)}
                          className="w-4 h-4 accent-rose-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {groups.map(g => (
                      <td key={g} className="border border-gray-200 p-1">
                        <input
                          type="number"
                          min={0}
                          value={values[`${r.key}||${g}`] ?? 0}
                          onChange={e => set(r.key, g, parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-brand-400"
                        />
                      </td>
                    ))}
                    <td className="border border-gray-200 px-3 py-1.5 text-center font-semibold text-gray-700">{total}</td>
                  </tr>
                )
              })}
            </tbody>

            {/* ── Toplam satırı ── */}
            <tfoot>
              <tr className="bg-brand-700 text-white font-semibold">
                <td className="sticky left-0 z-10 bg-brand-700 border border-brand-600 px-3 py-2 text-xs">
                  Toplam Dağıtılan
                </td>
                {showDestekCol && <td className="border border-brand-600 px-3 py-2" />}
                {showGizleCol && <td className="border border-brand-600 px-3 py-2" />}
                {groups.map(g => {
                  const colTotal = rows.reduce((s, r) => s + (values[`${r.key}||${g}`] ?? 0), 0)
                  return (
                    <td key={g} className="border border-brand-600 px-3 py-2 text-center text-xs tabular-nums">
                      {colTotal}
                    </td>
                  )
                })}
                <td className="border border-brand-600 px-3 py-2 text-center text-xs tabular-nums">
                  {rows.reduce((s, r) =>
                    s + groups.reduce((gs, g) => gs + (values[`${r.key}||${g}`] ?? 0), 0), 0
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main SelloutView ─────────────────────────────────────────
interface Props {
  currentProfile: Profile
  team: Profile[]
  visibleIds: string[]
  active: boolean
}

/** Şube Takibi'nde cari kısaltması: ilk kelime; ilk kelime 2-3 harfliyse (ör. "ÖZ")
 *  ikinci kelime de eklenir ("ÖZ ŞANAL"). Şube adı zaten bu kısaltmayla başlıyorsa tekrar edilmez. */
function cariSubeKisa(cari: string, sube: string): string {
  const w = (cari || '').trim().split(/\s+/).filter(Boolean).map(x => x.replace(/[.,]+$/, ''))
  const kisa = w.length === 0 ? '' : (w[0].length >= 2 && w[0].length <= 3 && w[1] ? `${w[0]} ${w[1]}` : w[0])
  const sb = (sube || '').trim()
  if (!kisa) return sb
  if (sb.toLocaleUpperCase('tr').startsWith(kisa.toLocaleUpperCase('tr') + ' ')) return sb
  return [kisa, sb].filter(Boolean).join(' ')
}

/** Şube eşleştirme anahtarı (görev "Cari / Şube" metni ↔ Şube Takibi şubesi) */
function subeZiyaretAnahtari(cari: string, sube: string): string {
  const sade = (x: string) => normalizeName(x).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean)
  const ct = sade(cari)
  let st = sade(sube)
  // Şube adının başındaki cari kelimelerini at ("ÖZ ŞANAL BAYRAKLI" → "BAYRAKLI")
  for (let i = 0; i < ct.length && st.length > 1 && st[0] === ct[i]; i++) st = st.slice(1)
  return `${ct[0] ?? ''}||${subeKompakt(st.join(' '), '')}`
}

export function SelloutView({ currentProfile, team, visibleIds, active }: Props) {
  const [donem, setDonem]         = useState(currentDonem)
  const [subTab, setSubTab]       = useState<SubTab>(() =>
    currentProfile.role === 'bsy' ? 'top20'
    : currentProfile.role === 'merch' ? 'merch'
    : currentProfile.role === 'jr' ? 'jr'
    : 'sup'
  )
  const [targetModal, setTargetModal] = useState<SubTab | null>(null)
  const [merchSearch, setMerchSearch] = useState('')
  const [merchCari, setMerchCari] = useState('')     // Merch sekmesi cari filtresi
  const [adetPrimData, setAdetPrimData] = useState<{ stokKodu: string; bayiMerch: number | null; kosulluDestek: number | null; kategori: string | null }[]>([])
  const [ozelPrimData, setOzelPrimData] = useState<{ stok_kodu: string[] | null; grup_kodu: string[] | null; cari_adi: string[] | null; sube_adi: string[] | null; bayi_merch: number | null; kosullu_destek: number | null; prim_carpan: number | null; tarih_baslangic: string | null; tarih_bitis: string | null }[]>([])
  const [merchHedefData, setMerchHedefData] = useState<{ merch_name: string; grup: string; hedef: number }[]>([])
  // Merch personeli olmayan ama sorumlusu tanımlı şubeler (B2B şube satırı ya da destek personeli)
  const [subeAtamalari, setSubeAtamalari] = useState<{ cari_adi: string; sube_kod: string; sube_adi: string; sup_adi: string; jr_adi: string; bsy_kod: string; bsy_adi: string; kaynak: string }[]>([])
  const [merchDetayData, setMerchDetayData] = useState<{ merch_adi: string; merch_grubu: string; sup_adi: string; jr_adi: string; cari_adi: string; cari_kod: string; sube_adi: string; sube_kod: string; bsy_kod: string; bsy_adi: string }[]>([])
  const [destekFlags, setDestekFlags] = useState<Record<string, boolean>>({})
  const [gizleFlags,  setGizleFlags]  = useState<Record<string, boolean>>({})
  const [satMerchTipi, setSatMerchTipi] = useState('')
  const [satMerch,     setSatMerch]     = useState('')
  const [satCari,      setSatCari]      = useState('')
  const [ozelCari,     setOzelCari]     = useState('')
  const [ozelSube,     setOzelSube]     = useState('')

  const isAdmin = currentProfile.role === 'admin'
  const isSup   = currentProfile.role === 'sup'
  const isJr    = currentProfile.role === 'jr'
  const isBsy   = currentProfile.role === 'bsy'
  // Çetinler Merch kullanıcısı: yalnızca Merch / Top 20 / Satışlar, yalnızca kendi verisi
  const isMerch = currentProfile.role === 'merch'

  const {
    rows: allRows, loading: selloutLoading, fetchedAt, reload: reloadSellout,
  } = useSellout(active)

  // Adet prim verilerini fetch et
  useEffect(() => {
    if (!active) return
    const [yil, ay] = donem.split('-')
    authFetch(`/api/adet-prim?yil=${yil}&ay=${ay}`)
      .then(r => r.json())
      .then(d => setAdetPrimData(d.rows || []))
      .catch(() => setAdetPrimData([]))
    authFetch(`/api/prim-ozel?yil=${yil}`)
      .then(r => r.json())
      .then(d => setOzelPrimData(d.rows || []))
      .catch(() => setOzelPrimData([]))
  }, [active, donem])

  // Merch hedef verilerini fetch et
  useEffect(() => {
    if (!active) return
    authFetch(`/api/sellout-targets?donem=${donem}`)
      .then(r => r.json())
      .then(d => setMerchHedefData(d.merch_targets || []))
      .catch(() => setMerchHedefData([]))
  }, [active, donem])

  // Merch detay verilerini fetch et (Jr ve Çetinler Merch sayıları için)
  useEffect(() => {
    if (!active) return
    fetch('/api/merch-detay')
      .then(r => r.json())
      .then(d => { setMerchDetayData(d.data || []); setSubeAtamalari(d.subeAtamalari || []) })
      .catch(() => setMerchDetayData([]))
  }, [active])

  // Destek personeli flag verilerini fetch et
  useEffect(() => {
    if (!active) return
    authFetch(`/api/merch-destek-flag?donem=${donem}`)
      .then(r => r.json())
      .then(d => {
        const dmap: Record<string, boolean> = {}
        const gmap: Record<string, boolean> = {}
        for (const f of (d.flags ?? [])) { dmap[f.merch_name] = f.destek_var; gmap[f.merch_name] = f.gizle ?? false }
        setDestekFlags(dmap)
        setGizleFlags(gmap)
      })
      .catch(() => { setDestekFlags({}); setGizleFlags({}) })
  }, [active, donem])

  const {
    getProfileHedef, getMerchHedef,
    upsertProfileTargets, upsertMerchTargets,
    saving,
  } = useSelloutTargets(donem)

  // ── Period rows ──────────────────────────────────────────────
  const periodRows = useMemo(
    () => allRows.filter(r => r.donem === donem),
    [allRows, donem]
  )

  // ── Top-30 şube sıralamaları ─────────────────────────────────
  // Merch kullanıcısının şubeleri (dönem satışları + merch-detay ataması) — Top 20'de vurgulanır
  const myMerchSubeKeys = useMemo(() => {
    const keys = new Set<string>()
    if (!isMerch) return keys
    const me = currentProfile.full_name
    periodRows.forEach(r => { if (namesMatch(r.merch_personel, me)) keys.add(`${r.cari_isim}||${r.sube_adi}`) })
    merchDetayData.forEach(m => { if (m.merch_adi && namesMatch(m.merch_adi, me)) keys.add(`${m.cari_adi}||${m.sube_adi}`) })
    return keys
  }, [isMerch, currentProfile.full_name, periodRows, merchDetayData])

  const top20Ipl = useMemo(
    () => calcTop20(periodRows, r =>
      r.grup_aciklama?.toLowerCase().includes('ipl') ?? false
    ),
    [periodRows]
  )
  const top20Rms = useMemo(
    () => calcTop20(periodRows, r =>
      r.stok_kodu?.startsWith('RMS9200') ?? false
    ),
    [periodRows]
  )
  const top20Supurge = useMemo(
    () => calcTop20(periodRows, r =>
      r.grup_aciklama?.toLowerCase().includes('süpürge') ||
      r.grup_aciklama?.toLowerCase().includes('supurge') ||
      r.grup_aciklama?.toLowerCase().includes('süpürge') ? true : false
    ),
    [periodRows]
  )

  // ── Global cari renk haritası (3 tablodaki tüm unique cariler, globally eşsiz renk) ──
  const globalCariColorMap = useMemo(() => {
    const allCaris = new Set<string>()
    top20Ipl.forEach(r => allCaris.add(r.cariIsim))
    top20Rms.forEach(r => allCaris.add(r.cariIsim))
    top20Supurge.forEach(r => allCaris.add(r.cariIsim))
    const sorted = [...allCaris].sort((a, b) => a.localeCompare(b, 'tr'))
    const map = new Map<string, string>()
    const total = Math.max(sorted.length, 1)
    sorted.forEach((name, i) => {
      // Eşit aralıklı hue + hafif offset ile yakın renk çakışmasını önle
      const hue = Math.round((i * 360) / total) % 360
      // Açık/koyu alternasyonuyla daha kolay ayırt edilir
      const lightness = i % 2 === 0 ? 40 : 50
      map.set(name, `hsl(${hue}, 75%, ${lightness}%)`)
    })
    return map
  }, [top20Ipl, top20Rms, top20Supurge])

  // ── Team slices ──────────────────────────────────────────────
  // Görevden ayrılanlar (lib/sellout AYRILANLAR) ayrıldıkları dönemden sonra listelenmez
  const visibleSups = useMemo(
    () => team.filter(p => p.role === 'sup' && visibleIds.includes(p.id) && donemdeAktif(p.full_name, donem)),
    [team, visibleIds, donem]
  )
  const visibleJrs = useMemo(
    () => team.filter(p => p.role === 'jr' && visibleIds.includes(p.id) && donemdeAktif(p.full_name, donem)),
    [team, visibleIds, donem]
  )
  const jrsOf = useCallback(
    (supId: string) => visibleJrs.filter(j => j.manager_id === supId),
    [visibleJrs]
  )

  // ── Jr sayısı (PHP merch-detay'dan) ──
  const jrsOfSupName = useCallback(
    (supName: string): number => {
      const uniqueJrs = new Set<string>()
      merchDetayData.forEach(m => {
        if (m.jr_adi && m.sup_adi && normalizeName(m.sup_adi) === normalizeName(supName)) {
          uniqueJrs.add(m.jr_adi.toLowerCase())
        }
      })
      return uniqueJrs.size
    },
    [merchDetayData]
  )

  // ── Şube sayısı (PHP F kolonu SUBE_KODU + K kolonu SUPERVIZOR) ──
  // K kolonundaki süpervizör isimlerini baz alarak gruplama, her süpervizöre bağlı benzersiz şube sayısı
  const subesOfSup = useCallback(
    (supName: string): number => {
      const normSupName = normalizeName(supName)
      const uniqueSubeKods = new Set<string>()

      merchDetayData.forEach(m => {
        if (m.sube_kod && m.sup_adi && normalizeName(m.sup_adi) === normSupName) {
          uniqueSubeKods.add(m.sube_kod.trim())
        }
      })

      return uniqueSubeKods.size
    },
    [merchDetayData]
  )

  // ── Çetinler Merch sayısı (PHP merch-detay'dan) ──
  const merchsOfSup = useCallback(
    (supName: string): number => {
      const normSupName = normalizeName(supName)

      // Bu Supervizör'ün Jr'larını bul
      const jrNames = new Set<string>()
      merchDetayData.forEach(m => {
        if (m.jr_adi && m.sup_adi && normalizeName(m.sup_adi) === normSupName) {
          jrNames.add(normalizeName(m.jr_adi))
        }
      })

      const allNames = new Set([normSupName, ...jrNames])

      // Çetinler Merch'leri say
      const uniqueMerchs = new Set<string>()
      merchDetayData.forEach(m => {
        if (m.merch_grubu === 'Çetinler Merch' && m.merch_adi) {
          // Merch'in sup_adi veya jr_adi bu Supervizör'e ait mi?
          if (
            (m.sup_adi && allNames.has(normalizeName(m.sup_adi))) ||
            (m.jr_adi && allNames.has(normalizeName(m.jr_adi)))
          ) {
            uniqueMerchs.add(m.merch_adi.toLowerCase())
          }
        }
      })

      return uniqueMerchs.size
    },
    [merchDetayData]
  )

  // ── Jr için şube sayısı (L kolonunda Jr ismi olanlar) ──
  const subesOfJr = useCallback(
    (jrName: string): number => {
      const normJrName = normalizeName(jrName)
      const uniqueSubeKods = new Set<string>()

      merchDetayData.forEach(m => {
        if (m.sube_kod && m.jr_adi && normalizeName(m.jr_adi) === normJrName) {
          uniqueSubeKods.add(m.sube_kod.trim())
        }
      })

      return uniqueSubeKods.size
    },
    [merchDetayData]
  )

  // ── Jr için Çetinler Merch sayısı ──
  const merchsOfJr = useCallback(
    (jrName: string): number => {
      const normJrName = normalizeName(jrName)
      const uniqueMerchs = new Set<string>()

      merchDetayData.forEach(m => {
        if (m.merch_grubu === 'Çetinler Merch' && m.merch_adi) {
          if (
            (m.sup_adi && normalizeName(m.sup_adi) === normJrName) ||
            (m.jr_adi && normalizeName(m.jr_adi) === normJrName)
          ) {
            uniqueMerchs.add(m.merch_adi.toLowerCase())
          }
        }
      })

      return uniqueMerchs.size
    },
    [merchDetayData]
  )

  // ── Satış Girmeyen Şubeler (otomatik, döneme göre) ───────────
  // Atanmış şube evreni /api/merch-detay'dan gelir; seçili dönemde
  // merch_satis'te (satılan_adet>0) görünen şube kodları çıkarılınca
  // kalan (adet 0) şubeler bulunur. Role göre kolonlanır:
  //   admin → her süpervizör bir kolon · sup/jr → kendi şubeleri ·
  //   bsy → kendine bağlı carilerin şubeleri (cari başına kolon).
  interface SgColumn { title: string; subeler: { subeKod: string; subeAdi: string; cariAdi: string; adet: number; kayit: string; cetinler: boolean }[] }
  const satisGirmeyenHesap = useMemo(() => {
    // Dönemde şube başına toplam satış adedi
    const adetBySube = new Map<string, number>()
    periodRows.forEach(r => {
      const sk = (r.sube_kod || '').trim()
      if (!sk) return
      adetBySube.set(sk, (adetBySube.get(sk) ?? 0) + r.satilan_adet)
    })

    // Atanmış benzersiz şubeler (sube_kod bazında). Aynı şube birden çok satırda
    // gelebilir (Bayi/Çetinler/Destek); Destek satırında sup/jr boş olabildiği
    // için tek satır alıp geçmek şubeyi yanlışlıkla sahipsiz bırakıyordu.
    // Bu yüzden satırlar BİRLEŞTİRİLİR: her alan ilk DOLU değerle doldurulur.
    // Sahiplik önceliği: Merch (Çetinler/Bayi) satırının sup/jr'ı, Destek Personeli
    // satırınınkinden önce gelir. B2B'de şube yeni süpervizöre geçtiğinde destek
    // satırları eski süpervizörde kalabiliyor (ör. EVKUR ANTALYA: Çetinler Merch
    // Gülcan Bayer, Destek Personeli satırları hâlâ Atilla Yılmaz).
    const subeMap = new Map<string, { subeAdi: string; sup: string; jr: string; bsyKod: string; bsyAdi: string; cariAdi: string; supMerch: boolean }>()
    merchDetayData.forEach(m => {
      const sk = (m.sube_kod || '').trim()
      if (!sk) return
      const isMerch = m.merch_grubu !== 'Destek Personeli'
      const cur = subeMap.get(sk)
      if (!cur) {
        subeMap.set(sk, {
          subeAdi: m.sube_adi || sk,
          sup: m.sup_adi || '',
          jr: m.jr_adi || '',
          bsyKod: (m.bsy_kod || '').toUpperCase(),
          bsyAdi: m.bsy_adi || '',
          cariAdi: m.cari_adi || '',
          supMerch: isMerch && !!m.sup_adi,
        })
      } else {
        if (isMerch && !cur.supMerch && m.sup_adi) {
          // Destek satırından gelen sahipliği Merch satırıyla değiştir (sup+jr birlikte)
          cur.sup = m.sup_adi
          cur.jr = m.jr_adi || ''
          cur.supMerch = true
        } else {
          if (!cur.sup && m.sup_adi) cur.sup = m.sup_adi
          if (!cur.jr && m.jr_adi && (!cur.supMerch || isMerch)) cur.jr = m.jr_adi
        }
        if (!cur.bsyKod && m.bsy_kod) cur.bsyKod = m.bsy_kod.toUpperCase()
        if (!cur.bsyAdi && m.bsy_adi) cur.bsyAdi = m.bsy_adi
        if (!cur.cariAdi && m.cari_adi) cur.cariAdi = m.cari_adi
        if ((!cur.subeAdi || cur.subeAdi === sk) && m.sube_adi) cur.subeAdi = m.sube_adi
      }
    })

    // Merch personeli olmayan şubeler: merch satırı yoksa ya da sorumlusu boşsa atamadan doldur
    subeAtamalari.forEach(a => {
      const sk = (a.sube_kod || '').trim()
      if (!sk) return
      const cur = subeMap.get(sk)
      if (!cur) {
        subeMap.set(sk, {
          subeAdi: a.sube_adi || sk, sup: a.sup_adi || '', jr: a.jr_adi || '',
          bsyKod: (a.bsy_kod || '').toUpperCase(), bsyAdi: a.bsy_adi || '', cariAdi: a.cari_adi || '', supMerch: false,
        })
      } else if (a.kaynak === 'elle') {
        // Yöneticinin elle ataması B2B'deki (ör. ayrılan) sorumlunun yerine geçer
        if (a.sup_adi) cur.sup = a.sup_adi
        if (a.jr_adi || a.sup_adi) cur.jr = a.jr_adi || ''
      } else if (!cur.sup && a.sup_adi) {
        cur.sup = a.sup_adi
        if (!cur.jr && a.jr_adi) cur.jr = a.jr_adi
      }
    })

    // Şubenin hangi kayıtlarla geldiği (üzerine gelince gösterilir)
    const kayitBySube = new Map<string, string[]>()
    const kayitEkle = (sk: string, t: string) => {
      const l = kayitBySube.get(sk) ?? []
      if (!l.includes(t)) l.push(t)
      kayitBySube.set(sk, l)
    }
    // Çetinler Merch: yalnızca seçili ayda o şubeye satış girdiyse (adediyle) gösterilir
    const cetinlerDonem = new Map<string, Map<string, number>>()
    periodRows.forEach(r => {
      const sk = (r.sube_kod || '').trim()
      if (!sk || r.merch_tipi !== 'Çetinler Merch' || !r.merch_personel || !(r.satilan_adet > 0)) return
      let m = cetinlerDonem.get(sk)
      if (!m) { m = new Map(); cetinlerDonem.set(sk, m) }
      m.set(r.merch_personel, (m.get(r.merch_personel) ?? 0) + r.satilan_adet)
    })
    cetinlerDonem.forEach((m, sk) => {
      ;[...m.entries()].sort((a, b) => b[1] - a[1])
        .forEach(([ad, adet]) => kayitEkle(sk, `Çetinler Merch: ${ad} — ${adet} adet satış (${donemLabel(donem)})`))
    })
    merchDetayData.forEach(m => {
      const sk = (m.sube_kod || '').trim()
      if (!sk || m.merch_grubu === 'Çetinler Merch') return
      kayitEkle(sk, `${m.merch_adi} (${m.merch_grubu || 'merch'}) → ${[m.sup_adi, m.jr_adi].filter(Boolean).join(' / ') || 'sorumlu yok'}`)
    })
    subeAtamalari.forEach(a => {
      const sk = (a.sube_kod || '').trim()
      const ad = a.kaynak === 'elle' ? 'Elle atama' : a.kaynak === 'destek' ? 'Destek personeli kaydı' : 'B2B şube satırı'
      if (sk) kayitEkle(sk, `${ad} → ${[a.sup_adi, a.jr_adi].filter(Boolean).join(' / ')}`)
    })

    // Seçili ayda Çetinler Merch'in satış girdiği şubeler — tabloda mavi kalın yazılır
    const cetinlerSube = new Set(cetinlerDonem.keys())

    // Atanmış tüm şubeler + dönem satış adedi (satışsız = 0)
    const assigned = [...subeMap.entries()]
      .map(([sk, v]) => ({ ...v, subeKod: sk, adet: adetBySube.get(sk) ?? 0, kayit: (kayitBySube.get(sk) ?? []).join('\n'), cetinler: cetinlerSube.has(sk) }))

    // Satış adedine göre AZALAN (en çok satan üstte, satış girmeyenler = 0 en altta), sonra cari/şube
    const bySales = (a: { adet: number; cariAdi: string; subeAdi: string }, b: { adet: number; cariAdi: string; subeAdi: string }) =>
      b.adet - a.adet || a.cariAdi.localeCompare(b.cariAdi, 'tr') || a.subeAdi.localeCompare(b.subeAdi, 'tr')
    const strip = (arr: typeof assigned) => arr.map(s => ({ subeKod: s.subeKod, subeAdi: s.subeAdi, cariAdi: s.cariAdi, adet: s.adet, kayit: s.kayit, cetinler: s.cetinler })).sort(bySales)
    const cols: SgColumn[] = []

    if (isBsy) {
      const kod = BSY_NAME_TO_KOD[normalizeName(currentProfile.full_name)] ?? ''
      const mine = assigned.filter(s =>
        (kod && s.bsyKod === kod) || (s.bsyAdi && namesMatch(s.bsyAdi, currentProfile.full_name))
      )
      const byCari = new Map<string, typeof mine>()
      mine.forEach(s => {
        const key = s.cariAdi || '—'
        if (!byCari.has(key)) byCari.set(key, [])
        byCari.get(key)!.push(s)
      })
      ;[...byCari.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
        .forEach(([cari, subeler]) => cols.push({ title: cari, subeler: strip(subeler) }))
    } else if (isJr) {
      cols.push({ title: currentProfile.full_name, subeler: strip(assigned.filter(s => s.jr && namesMatch(s.jr, currentProfile.full_name))) })
    } else if (isSup) {
      cols.push({ title: currentProfile.full_name, subeler: strip(assigned.filter(s => s.sup && namesMatch(s.sup, currentProfile.full_name))) })
    } else {
      // Atanmış şubesi olmayan süpervizör (ör. ayrılan) kolon olarak gösterilmez
      visibleSups.forEach(sup => {
        const subeler = strip(assigned.filter(s => s.sup && namesMatch(s.sup, sup.full_name)))
        if (subeler.length > 0) cols.push({ title: sup.full_name, subeler })
      })
    }
    // Yönetici kontrolü: hiçbir kolona girmeyen şubeler (sorumlusu yok / aktif süpervizör değil)
    const sahipsiz = isAdmin
      ? assigned
          .filter(s => !visibleSups.some(sup => s.sup && namesMatch(s.sup, sup.full_name)))
          .map(s => ({ subeKod: s.subeKod, cariAdi: s.cariAdi, subeAdi: s.subeAdi, sup: s.sup, jr: s.jr }))
      : []
    const adlar = new Set(assigned.map(s => `${normalizeName(s.cariAdi)}||${subeKompakt(s.subeAdi, s.cariAdi)}`))
    return { cols, sahipsiz, adlar }
  }, [periodRows, donem, merchDetayData, subeAtamalari, visibleSups, isBsy, isJr, isSup, isAdmin, currentProfile.full_name])
  const satisGirmeyenBase: SgColumn[] = satisGirmeyenHesap.cols

  // Yönetici: B2B cari-şube listesinde olup Şube Takibi'nde hiç kaydı olmayan şubeler
  const [b2bSubeler, setB2bSubeler] = useState<{ sube_kod?: string; cari_adi: string; sube_adi: string }[] | null>(null)
  useEffect(() => {
    if (!isAdmin || subTab !== 'satisgirmeyen' || b2bSubeler) return
    fetch('/api/bsy-cari-sube').then(r => r.json()).then(j => setB2bSubeler(j.data ?? [])).catch(() => setB2bSubeler([]))
  }, [isAdmin, subTab, b2bSubeler])

  // Şube Takibi cari filtresi — seçenekler kullanıcının gördüğü şubelerden
  const [sgCari, setSgCari] = useState('')
  const sgCariOptions = useMemo(
    () => [...new Set(satisGirmeyenBase.flatMap(c => c.subeler.map(x => x.cariAdi)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr')),
    [satisGirmeyenBase]
  )
  const satisGirmeyenColumns = useMemo<SgColumn[]>(() => {
    if (!sgCari) return satisGirmeyenBase
    const cols = satisGirmeyenBase.map(c => ({ ...c, subeler: c.subeler.filter(x => x.cariAdi === sgCari) }))
    // Çok kolonlu görünümde (admin/BSY) carinin şubesi olmayan kolonlar gizlenir
    return cols.length > 1 ? cols.filter(c => c.subeler.length > 0) : cols
  }, [satisGirmeyenBase, sgCari])
  // Ekrandaki tablolardaki tekil şubelerin özeti (cari ve ay filtresiyle güncellenir)
  const sgOzet = useMemo(() => {
    const adet = new Map<string, number>()
    satisGirmeyenColumns.forEach(c => c.subeler.forEach(x => {
      const k = x.subeKod || `${x.cariAdi}||${x.subeAdi}`
      adet.set(k, Math.max(adet.get(k) ?? 0, x.adet))
    }))
    const satisli = [...adet.values()].filter(a => a > 0).length
    return { toplam: adet.size, satisli, girmeyen: adet.size - satisli }
  }, [satisGirmeyenColumns])

  const sgGorunmeyen = useMemo(() => {
    if (!isAdmin) return []
    const liste: { subeKod: string; cariAdi: string; subeAdi: string; neden: string }[] = satisGirmeyenHesap.sahipsiz.map(s => ({
      subeKod: s.subeKod, cariAdi: s.cariAdi, subeAdi: s.subeAdi,
      neden: s.sup ? `B2B sorumlusu: ${s.sup} — uygulamada aktif süpervizör değil` : (s.jr ? `Yalnızca Jr tanımlı: ${s.jr}` : 'B2B\'de süpervizör tanımlı değil'),
    }))
    for (const r of b2bSubeler ?? []) {
      const k = `${normalizeName(r.cari_adi)}||${subeKompakt(r.sube_adi, r.cari_adi)}`
      if (!satisGirmeyenHesap.adlar.has(k)) liste.push({ subeKod: r.sube_kod ?? '', cariAdi: r.cari_adi, subeAdi: r.sube_adi, neden: 'B2B\'de bu şubede merch personeli yok' })
    }
    return liste
      .filter(x => !sgCari || x.cariAdi === sgCari)
      .sort((a, b) => a.cariAdi.localeCompare(b.cariAdi, 'tr') || a.subeAdi.localeCompare(b.subeAdi, 'tr'))
  }, [isAdmin, satisGirmeyenHesap, b2bSubeler, sgCari])

  // ── Elle şube yetkisi (merch personeli olmayan şubeler) — yalnızca yönetici ──
  const [elleAtamalar, setElleAtamalar] = useState<{ sube_kod: string; cari_adi: string | null; sube_adi: string | null; sup_adi: string | null; jr_adi: string | null }[]>([])
  const [atamaSecim, setAtamaSecim] = useState<Record<string, { sup: string; jr: string }>>({})
  const [atamaHata, setAtamaHata] = useState('')
  const atamaYenile = useCallback(async () => {
    try {
      const r = await authFetch('/api/sube-yetki')
      const j = await r.json()
      if (!r.ok) { setAtamaHata(j.tabloYok ? 'Şube yetki tablosu henüz oluşturulmadı (SQL çalıştırılmalı).' : (j.error || '')); return }
      setAtamaHata('')
      setElleAtamalar(j.atamalar ?? [])
    } catch { /* yoksay */ }
  }, [])
  useEffect(() => { if (isAdmin && subTab === 'satisgirmeyen') atamaYenile() }, [isAdmin, subTab, atamaYenile])
  const [b2bYenileniyor, setB2bYenileniyor] = useState(false)
  const atamaSonrasi = useCallback(async (taze = false) => {
    await atamaYenile()
    try {
      const d = await (await fetch(`/api/merch-detay${taze ? '?yenile=1' : ''}`)).json()
      setMerchDetayData(d.data || [])
      setSubeAtamalari(d.subeAtamalari || [])
    } catch { /* yoksay */ }
  }, [atamaYenile])
  const subeAta = async (x: { subeKod: string; cariAdi: string; subeAdi: string }) => {
    const sec = atamaSecim[x.subeKod]
    if (!sec?.sup && !sec?.jr) return
    const r = await authFetch('/api/sube-yetki', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sube_kod: x.subeKod, cari_adi: x.cariAdi, sube_adi: x.subeAdi, sup_adi: sec.sup, jr_adi: sec.jr }),
    })
    if (!r.ok) { setAtamaHata((await r.json()).error || 'Atanamadı'); return }
    await atamaSonrasi()
  }
  const atamaKaldir = async (subeKod: string) => {
    if (!confirm('Bu şube ataması kaldırılsın mı?')) return
    const r = await authFetch('/api/sube-yetki', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sube_kod: subeKod }),
    })
    if (!r.ok) { setAtamaHata((await r.json()).error || 'Kaldırılamadı'); return }
    await atamaSonrasi()
  }

  // ── Şube stok (milat) + sevk → Bekleyen / Kalan ─────────────
  // Kalan = milat stoğu + teslim edilmemiş (sayıma girmemiş) sevkler − milattan SONRAKİ satışlar.
  // Sevk tarihine bakılmaz: yüklenen sevk, yeni stok sayımında "teslim edildi" işaretlenene kadar eklenir.
  // Bekleyen: yüklenen stok raporundaki değer (bir sonraki yüklemeye kadar sabit).
  interface StokKaydi { sube_key: string; stok_kodu: string; stok_adi: string | null; kalan: number; bekleyen: number; milat: string }
  interface SevkKaydi { sube_key: string; stok_kodu: string; stok_adi: string | null; adet: number; tarih: string; sayimda?: boolean }
  const [stokVeri, setStokVeri] = useState<{ stok: StokKaydi[]; sevk: SevkKaydi[]; yuklemeler: SevkYukleme[] } | null>(null)
  const [stokHata, setStokHata] = useState('')
  const [stokYukle, setStokYukle] = useState<'stok' | 'sevk' | null>(null)
  const [sgAcik, setSgAcik] = useState<Set<string>>(new Set())

  // ── Ziyaretler: seçili ayda check-in yapılmış görevler (Ajanda) → şube yanında işaret ──
  const [ziyaretler, setZiyaretler] = useState<{ pid: string; date: string; customer: string | null }[]>([])
  useEffect(() => {
    if (subTab !== 'satisgirmeyen') return
    let iptal = false
    const [y, m] = donem.split('-').map(Number)
    const son = new Date(y, m, 0).getDate()
    ;(async () => {
      const tum: { pid: string; date: string; customer: string | null }[] = []
      for (let bas = 0; ; bas += 1000) {
        const { data, error } = await supabase.from('tasks')
          .select('pid, date, customer')
          .gte('date', `${donem}-01`).lte('date', `${donem}-${String(son).padStart(2, '0')}`)
          .not('checkin_ts', 'is', null).not('customer', 'is', null)
          .order('date').range(bas, bas + 999)
        if (error || !data) break
        tum.push(...(data as typeof tum))
        if (data.length < 1000) break
      }
      if (!iptal) setZiyaretler(tum)
    })()
    return () => { iptal = true }
  }, [subTab, donem])
  const ziyaretBySube = useMemo(() => {
    const ad = new Map(team.map(p => [p.id, p.full_name]))
    const m = new Map<string, { tarih: string; kisi: string }[]>()
    for (const z of ziyaretler) {
      const parca = (z.customer || '').split(' / ')
      if (parca.length < 2) continue
      const k = subeZiyaretAnahtari(parca[0], parca.slice(1).join(' / '))
      const l = m.get(k) ?? []
      l.push({ tarih: z.date, kisi: ad.get(z.pid) ?? '' })
      m.set(k, l)
    }
    return m
  }, [ziyaretler, team])
  const stokYenile = useCallback(async () => {
    try {
      const r = await authFetch('/api/sube-stok')
      const j = await r.json()
      if (!r.ok) { setStokHata(j.tabloYok ? 'Stok tabloları henüz oluşturulmadı.' : (j.error || 'Stok alınamadı')); setStokVeri(null); return }
      setStokHata('')
      setStokVeri(j)
    } catch (e) { setStokHata(String(e)) }
  }, [])
  useEffect(() => { if (subTab === 'satisgirmeyen' && !stokVeri && !stokHata) stokYenile() }, [subTab, stokVeri, stokHata, stokYenile])

  const sgStok = useMemo(() => {
    const kod = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()
    type Urun = { stokKodu: string; stokAdi: string; satis: number; bekleyen: number; kalan: number; stokVar: boolean }
    const stokBySube = new Map<string, { milat: string; urunler: Map<string, Urun> }>()
    for (const r of stokVeri?.stok ?? []) {
      const sk = kod(r.sube_key)
      let e = stokBySube.get(sk)
      if (!e) { e = { milat: r.milat, urunler: new Map() }; stokBySube.set(sk, e) }
      if (r.milat > e.milat) e.milat = r.milat
      e.urunler.set(kod(r.stok_kodu), { stokKodu: kod(r.stok_kodu), stokAdi: r.stok_adi ?? '', satis: 0, bekleyen: r.bekleyen, kalan: r.kalan, stokVar: true })
    }
    const urunAl = (sk: string, stokKodu: string, stokAdi: string) => {
      const e = stokBySube.get(sk)!
      let u = e.urunler.get(stokKodu)
      if (!u) { u = { stokKodu, stokAdi, satis: 0, bekleyen: 0, kalan: 0, stokVar: false }; e.urunler.set(stokKodu, u) }
      if (!u.stokAdi && stokAdi) u.stokAdi = stokAdi
      return u
    }
    // Teslim edilmemiş sevkler → Kalan'a eklenir
    for (const r of stokVeri?.sevk ?? []) {
      const sk = kod(r.sube_key)
      const e = stokBySube.get(sk)
      if (!e || r.sayimda) continue
      urunAl(sk, kod(r.stok_kodu), r.stok_adi ?? '').kalan += r.adet
    }
    // Satışlar (milattan sonra) → Kalan'dan düşer
    for (const r of allRows) {
      const sk = kod(r.sube_kod)
      const e = stokBySube.get(sk)
      if (!e) continue
      const t = isoTarih(r.tarih)
      if (!t || t <= e.milat) continue
      urunAl(sk, kod(r.stok_kodu), r.stok_adi).kalan -= r.satilan_adet
    }
    // Dönem satışları (Satış kolonu) ürün bazında
    const donemBySube = new Map<string, Map<string, { stokAdi: string; adet: number }>>()
    for (const r of periodRows) {
      const sk = kod(r.sube_kod)
      if (!sk) continue
      let m = donemBySube.get(sk)
      if (!m) { m = new Map(); donemBySube.set(sk, m) }
      const k = kod(r.stok_kodu)
      const c = m.get(k) ?? { stokAdi: r.stok_adi, adet: 0 }
      c.adet += r.satilan_adet
      m.set(k, c)
    }
    const milatlar = [...new Set([...stokBySube.values()].map(e => e.milat))].sort()
    return {
      milatlar,
      subeSayisi: stokBySube.size,
      detay: (subeKod: string) => {
        const sk = kod(subeKod)
        const e = stokBySube.get(sk)
        const donem = donemBySube.get(sk) ?? new Map<string, { stokAdi: string; adet: number }>()
        const urunler = new Map<string, Urun>()
        for (const [k, u] of e?.urunler ?? []) urunler.set(k, { ...u, satis: 0 })
        for (const [k, d] of donem) {
          const u = urunler.get(k) ?? { stokKodu: k, stokAdi: d.stokAdi, satis: 0, bekleyen: 0, kalan: 0, stokVar: false }
          u.satis = d.adet
          if (!u.stokAdi) u.stokAdi = d.stokAdi
          urunler.set(k, u)
        }
        const liste = [...urunler.values()]
          .filter(u => u.satis !== 0 || u.bekleyen !== 0 || u.kalan !== 0)
          .sort((a, b) => b.satis - a.satis || b.kalan - a.kalan || a.stokKodu.localeCompare(b.stokKodu))
        return {
          stokVar: !!e,
          milat: e?.milat ?? '',
          bekleyen: e ? liste.reduce((t, u) => t + u.bekleyen, 0) : null,
          kalan: e ? liste.reduce((t, u) => t + u.kalan, 0) : null,
          urunler: liste,
        }
      },
    }
  }, [stokVeri, allRows, periodRows])

  // ── Gerç aggregation ────────────────────────────────────────
  const getGerc = useCallback(
    // anaSup: süpervizör toplamında, /api/sellout'un Jr'a atadığı satışlar
    // B2B'deki asıl süpervizör adıyla (ana_supervisor_adi) da eşleşir.
    (supApiNames: string[], grup: string, anaSup?: string): number => {
      const ana = anaSup ? normalizeName(anaSup) : null
      return periodRows
        .filter(r => {
          const normApi = normalizeName(r.supervisor_adi)
          return (supApiNames.some(n => normalizeName(n) === normApi) ||
                  (ana !== null && normalizeName(r.ana_supervisor_adi ?? '') === ana))
              && GRUP_NORMALIZE[r.grup_aciklama] === grup
        })
        .reduce((s, r) => s + r.satilan_adet, 0)
    },
    [periodRows]
  )

  // ── Unique Çetinler Merch listesi ────────────────────────────
  // Tüm süpervizörlerin isimlerini hesapla (sup + jr)
  const allSupNames = useMemo(
    () => team.filter(p => visibleIds.includes(p.id)).map(p => p.full_name),
    [team, visibleIds]
  )

  // ── Filtered period rows (sadece bağlı supervisorlar / BSY için kendi Carileri) ──
  const bsyKod = isBsy
    ? (BSY_NAME_TO_KOD[currentProfile.full_name.toLocaleLowerCase('tr')] ?? null)
    : null

  const filteredPeriodRows = useMemo(() => {
    return periodRows.filter(r => {
      if (isMerch) return namesMatch(r.merch_personel, currentProfile.full_name)
      if (isBsy && bsyKod) {
        return r.bsy === bsyKod
      }
      const normApi = normalizeName(r.supervisor_adi || '')
      return allSupNames.some(n => normalizeName(n) === normApi)
    })
  }, [periodRows, allSupNames, isBsy, bsyKod, isMerch, currentProfile.full_name])

  // ── Devir (Eylül 2026, bkz. lib/supDevir) ──
  // Şubesi artık bu süpervizöre/Jr'a ait olan, Atilla Yılmaz'a yazılmış satışlar
  // Satışlar'da BİLGİ AMAÇLI gösterilir. Satış Atilla'da kalır: hedef/gerçekleşme/
  // prim hesapları değişmez ve Satışlar toplamlarına katılmaz.
  const devirRows = useMemo(() => {
    if (donem !== DEVIR_DONEMI || isAdmin || isBsy || isMerch) return []
    const myNames = new Set(allSupNames.map(normalizeName).filter(Boolean))
    const mySubeler = new Set<string>()
    merchDetayData.forEach(m => {
      const sk = (m.sube_kod || '').trim()
      if (!sk) return
      if (myNames.has(normalizeName(m.sup_adi || '')) || myNames.has(normalizeName(m.jr_adi || ''))) mySubeler.add(sk)
    })
    if (mySubeler.size === 0) return []
    const zatenVar = new Set(filteredPeriodRows)
    return periodRows.filter(r =>
      !zatenVar.has(r) && isDevirSup(r.supervisor_adi || '') && mySubeler.has((r.sube_kod || '').trim()))
  }, [donem, isAdmin, isBsy, isMerch, allSupNames, merchDetayData, periodRows, filteredPeriodRows])
  const devirSet = useMemo(() => new Set(devirRows), [devirRows])
  const satislarBaseRows = useMemo(
    () => (devirRows.length ? [...filteredPeriodRows, ...devirRows] : filteredPeriodRows),
    [filteredPeriodRows, devirRows],
  )

  // ── Satışlar tablosu ek filtreleri ──
  const satislarRows = useMemo(() => {
    return satislarBaseRows.filter(r => {
      if (satMerchTipi && r.merch_tipi !== satMerchTipi) return false
      if (satMerch && r.merch_personel !== satMerch) return false
      if (satCari) {
        const label = r.sube_adi ? `${r.cari_isim} – ${r.sube_adi}` : r.cari_isim
        if (label !== satCari) return false
      }
      return true
    })
  }, [satislarBaseRows, satMerchTipi, satMerch, satCari])

  // ── Adet prim lookup ──
  const adetPrimMap = useMemo(() => {
    const map = new Map<string, { bayiMerch: number; kosulluDestek: number; kategori: string }>()
    adetPrimData.forEach(p => {
      map.set(p.stokKodu, {
        bayiMerch: p.bayiMerch || 0,
        kosulluDestek: p.kosulluDestek || 0,
        kategori: p.kategori || '',
      })
    })
    return map
  }, [adetPrimData])

  const normStr = (s: string) => (s || '').trim().toLowerCase()
    .replace(/İ/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, ' ')

  // Satış satırına uyan özel prim kuralını bul (cari/şube/stok/grup + GÜN bazlı tarih).
  const findOzel = useCallback((stokKodu: string, grupKodu: string, cariIsim: string, subeAdi: string, tarih: string) => {
    const saleIso = tarihToIso(tarih)  // 'YYYY-MM-DD' veya ''
    return ozelPrimData.find(r => {
      const stokOk = !r.stok_kodu || r.stok_kodu.some(s => s.toUpperCase() === stokKodu.toUpperCase())
      const grupOk = !r.grup_kodu || (r.stok_kodu?.length ? stokOk : r.grup_kodu.some(g => g.toUpperCase() === grupKodu.toUpperCase()))
      const cariOk = !r.cari_adi  || r.cari_adi.some(c => normStr(c) === normStr(cariIsim))
      const subeOk = !r.sube_adi  || r.sube_adi.some(s => normStr(s) === normStr(subeAdi))
      // Tarih kısıtı GÜN bazlı: satır tarihi çözülebiliyorsa tam tarih; yoksa ay bazına düş.
      let basOk: boolean, bitOk: boolean
      if (saleIso) {
        basOk = !r.tarih_baslangic || r.tarih_baslangic.slice(0, 10) <= saleIso
        bitOk = !r.tarih_bitis     || r.tarih_bitis.slice(0, 10)     >= saleIso
      } else {
        const from = r.tarih_baslangic ? r.tarih_baslangic.slice(0, 7) : null
        const to   = r.tarih_bitis     ? r.tarih_bitis.slice(0, 7)     : null
        basOk = !from || from <= donem
        bitOk = !to   || to   >= donem
      }
      return stokOk && grupOk && cariOk && subeOk && basOk && bitOk
    })
  }, [ozelPrimData, donem, normStr])

  // Bayi merch prim oranı (standart + özel ek / çarpan). Merch tipinden bağımsız —
  // özel kural o cari/stok/tarihe uygulanır.
  // EKSTRA prim (Özel Uygulama Takip): şube grup eşiğine ulaştıysa Bayi Merch
  // satırlarında ilgili stokların primi × 2 (lib/ozelUygulama).
  const ozelCarpan = useMemo(() => buildOzelCarpan(allRows.map(r => ({
    cari: r.cari_isim, sube: r.sube_adi, stokKodu: r.stok_kodu, adet: r.satilan_adet, merchTipi: r.merch_tipi, donem: r.donem,
  })), donem), [allRows, donem])

  const getEffectiveBayiMerch = useCallback((stokKodu: string, grupKodu: string, cariIsim: string, subeAdi: string, tarih: string, merchTipi: string): number => {
    const standardRate = adetPrimMap.get(stokKodu)?.bayiMerch ?? 0
    const rule = findOzel(stokKodu, grupKodu, cariIsim, subeAdi, tarih)
    let rate = standardRate
    if (rule?.prim_carpan != null) rate = standardRate * rule.prim_carpan
    else if (rule?.bayi_merch != null) rate = standardRate + rule.bayi_merch
    return rate * ozelCarpan(cariIsim, subeAdi, stokKodu, merchTipi)
  }, [adetPrimMap, findOzel, ozelCarpan])

  // Koşullu destek prim oranı (standart + özel koşullu destek ek / çarpan).
  const getEffectiveKosulluDestek = useCallback((stokKodu: string, grupKodu: string, cariIsim: string, subeAdi: string, tarih: string): number => {
    const standardRate = adetPrimMap.get(stokKodu)?.kosulluDestek ?? 0
    const rule = findOzel(stokKodu, grupKodu, cariIsim, subeAdi, tarih)
    if (!rule) return standardRate
    if (rule.prim_carpan   != null) return standardRate * rule.prim_carpan
    if (rule.kosullu_destek != null) return standardRate + rule.kosullu_destek
    return standardRate
  }, [adetPrimMap, findOzel])

  // ── Merch kategori performans hesapla ──
  const merchKategoriPerformans = useMemo(() => {
    // merch_name → { kategori_normalized → { hedef, gerçekleşen, oran } }
    const map = new Map<string, Map<string, { hedef: number; gerceklesen: number; oran: number }>>()

    // Hedefleri ekle (grup = normalized isim)
    merchHedefData.forEach(h => {
      const merchKey = h.merch_name.toLowerCase()
      if (!map.has(merchKey)) {
        map.set(merchKey, new Map())
      }
      // h.grup zaten normalized (Düzleştirici&Maşa Grubu)
      map.get(merchKey)!.set(h.grup, { hedef: h.hedef, gerceklesen: 0, oran: 0 })
    })

    // Gerçekleşenleri topla (sadece Çetinler Merch satışları)
    periodRows.forEach(r => {
      if (r.merch_tipi !== 'Çetinler Merch' || !r.merch_personel || !r.grup_aciklama) return
      const merchKey = r.merch_personel.toLowerCase()

      // API'den gelen kategoriyi normalize et
      const normalizedKategori = GRUP_NORMALIZE[r.grup_aciklama] || r.grup_aciklama

      if (!map.has(merchKey)) {
        map.set(merchKey, new Map())
      }
      const kategoriMap = map.get(merchKey)!
      if (!kategoriMap.has(normalizedKategori)) {
        kategoriMap.set(normalizedKategori, { hedef: 0, gerceklesen: 0, oran: 0 })
      }
      const existing = kategoriMap.get(normalizedKategori)!
      existing.gerceklesen += r.satilan_adet || 0
    })

    // Oranları hesapla
    map.forEach(kategoriMap => {
      kategoriMap.forEach(data => {
        data.oran = data.hedef > 0 ? (data.gerceklesen / data.hedef) * 100 : 0
      })
    })

    return map
  }, [merchHedefData, periodRows])

  // ── Satışlar tablosunu Excel'e aktar ──
  const exportSatislarExcel = useCallback(() => {
    const headers = [
      'Merch Personel', 'Cari', 'Şube', 'Stok Adı', 'Stok Kodu', 'Grup/Kategori',
      'Satılan Adet', 'Süpervizör', 'Merch Tipi', 'BSY',
      'Bayi Merch Adet Primi', 'Bayi Merch Prim Hakedişi',
      'Destek Per. Adet Primi', 'Çet. Merch Kat. Gerç. %', 'Çet. Merch Gerç.Oranına Göre Prim',
    ]

    // Çetinler Merch kullanıcısı: BSY'den sonraki prim kolonları (10–14) yok
    const gizli = isMerch ? new Set([10, 11, 12, 13, 14]) : new Set<number>()
    const kolon = <T,>(arr: T[]) => arr.filter((_, i) => !gizli.has(i))
    const aoa: (string | number)[][] = [kolon(headers)]

    for (const row of satislarRows) {
      const primData = adetPrimMap.get(row.stok_kodu || '') || { bayiMerch: 0, kosulluDestek: 0, kategori: '' }
      const satisAdedi = row.satilan_adet || 0

      const bayiMerchPrimAdet = getEffectiveBayiMerch(row.stok_kodu || '', (row.grup_kodu || '').toUpperCase(), row.cari_isim || '', row.sube_adi || '', row.tarih || '', row.merch_tipi || '')
      const bayiMerchHakedis = bayiMerchPrimAdet * satisAdedi

      const destekVarMi = row.merch_tipi === 'Çetinler Merch' && !!destekFlags[row.merch_personel || '']
      const destekPrimAdet = destekVarMi
        ? getEffectiveKosulluDestek(row.stok_kodu || '', (row.grup_kodu || '').toUpperCase(), row.cari_isim || '', row.sube_adi || '', row.tarih || '')
        : 0

      const merchKey = (row.merch_personel || '').toLowerCase()
      const kategoriRaw = row.grup_aciklama || ''
      const kategoriNormalized = GRUP_NORMALIZE[kategoriRaw] || kategoriRaw
      const cetinlerMerchGercOran = merchKategoriPerformans.get(merchKey)?.get(kategoriNormalized)?.oran || 0

      const cetinlerMerchPrim = destekPrimAdet > 0
        ? (cetinlerMerchGercOran >= 100
            ? destekPrimAdet * satisAdedi
            : (cetinlerMerchGercOran / 100) * destekPrimAdet * satisAdedi)
        : 0

      const r2 = (n: number) => Math.round(n * 100) / 100

      aoa.push(kolon([
        row.merch_personel || '', row.cari_isim || '', row.sube_adi || '',
        row.stok_adi || '', row.stok_kodu || '', row.grup_aciklama || '',
        satisAdedi, row.supervisor_adi || '', row.merch_tipi || '', row.bsy || '',
        r2(bayiMerchPrimAdet), r2(bayiMerchHakedis),
        r2(destekPrimAdet), r2(cetinlerMerchGercOran), r2(cetinlerMerchPrim),
      ]))
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Kolon genişlikleri
    ws['!cols'] = kolon([
      { wch: 18 }, { wch: 34 }, { wch: 16 }, { wch: 34 }, { wch: 12 }, { wch: 18 },
      { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 8 },
      { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 22 },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Satışlar')
    XLSX.writeFile(wb, `Satislar_${donem}.xlsx`)
  }, [satislarRows, adetPrimMap, getEffectiveBayiMerch, getEffectiveKosulluDestek, destekFlags, merchKategoriPerformans, donem, isMerch])

  // ── Satışlar alt toplamları (satır hesabıyla birebir aynı — özel prim + gün bazlı) ──
  const satislarTotals = useMemo(() => {
    let toplamAdet = 0, bayiHakedis = 0, destekHakedis = 0, cetinlerPrim = 0
    for (const r of satislarRows) {
      if (devirSet.has(r)) continue // devir: satış Atilla'da, toplama katılmaz
      const adet = r.satilan_adet || 0
      toplamAdet += adet
      const stk = r.stok_kodu || '', grp = (r.grup_kodu || '').toUpperCase()
      const cari = r.cari_isim || '', sube = r.sube_adi || '', tarih = r.tarih || ''
      bayiHakedis += getEffectiveBayiMerch(stk, grp, cari, sube, tarih, r.merch_tipi || '') * adet
      if (r.merch_tipi === 'Çetinler Merch' && destekFlags[r.merch_personel || '']) {
        const dp = getEffectiveKosulluDestek(stk, grp, cari, sube, tarih)
        destekHakedis += dp * adet
        const mk  = (r.merch_personel || '').toLowerCase()
        const kat = GRUP_NORMALIZE[r.grup_aciklama || ''] || r.grup_aciklama || ''
        const oran = merchKategoriPerformans.get(mk)?.get(kat)?.oran || 0
        cetinlerPrim += oran >= 100 ? dp * adet : (oran / 100) * dp * adet
      }
    }
    return { toplamAdet, bayiHakedis, destekHakedis, cetinlerPrim }
  }, [satislarRows, devirSet, getEffectiveBayiMerch, getEffectiveKosulluDestek, destekFlags, merchKategoriPerformans])

  // Filtre: MERCH_TIPI === 'Çetinler Merch' olan satırlardan unique kişi listesi
  // Sadece seçili dönemde satışı olan kişiler (toplam satış > 0)
  const uniqueMerch = useMemo(() => {
    const map = new Map<string, { supApiName: string; cariIsim: string; subeAdi: string; totalSales: number }>()

    // 1. Satış yapmış Çetinler Merch'leri ekle (periodRows'tan)
    periodRows.forEach(r => {
      if (!r.merch_personel) return
      if (r.merch_tipi === 'Çetinler Merch') {
        const existing = map.get(r.merch_personel)
        if (!existing) {
          map.set(r.merch_personel, {
            supApiName: r.supervisor_adi ?? '',
            cariIsim:   r.cari_isim  ?? '',
            subeAdi:    r.sube_adi   ?? '',
            totalSales: r.satilan_adet,
          })
        } else {
          existing.totalSales += r.satilan_adet
        }
      }
    })

    // 2. Tüm Çetinler Merch'leri ekle (merchDetayData'dan - satış yapmamış olanlar dahil)
    merchDetayData.forEach(m => {
      if (m.merch_grubu === 'Çetinler Merch' && m.merch_adi) {
        if (!map.has(m.merch_adi)) {
          // Satış yapmamış, sadece kayıtlı olan
          map.set(m.merch_adi, {
            supApiName: m.jr_adi || m.sup_adi, // Jr varsa Jr, yoksa Sup
            cariIsim:   m.cari_adi || '',
            subeAdi:    m.sube_adi || '',
            totalSales: 0,
          })
        }
      }
    })

    return Array.from(map.entries())
      .map(([name, v]) => ({ name, supApiName: v.supApiName, cariIsim: v.cariIsim, subeAdi: v.subeAdi }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [periodRows, merchDetayData])

  // Merch visible to current user: supervisor_adi'si mevcut kullanıcının görebileceği
  // bir süpervizör/jr. ismiyle eşleşenler
  const myVisibleSupNames = useMemo(() => {
    if (isAdmin) return allSupNames
    if (isSup) {
      const myJrs = jrsOf(currentProfile.id).map(j => j.full_name)
      return [currentProfile.full_name, ...myJrs]
    }
    if (isJr) return [currentProfile.full_name, ...devraldiklari(currentProfile.full_name)]
    return []
  }, [isAdmin, isSup, isJr, currentProfile, allSupNames, jrsOf])

  const visibleMerch = useMemo(
    () => isMerch
      ? uniqueMerch.filter(m => namesMatch(m.name, currentProfile.full_name))
      : uniqueMerch.filter(m =>
          !m.supApiName || myVisibleSupNames.some(n => namesMatch(n, m.supApiName))
        ),
    [uniqueMerch, myVisibleSupNames, isMerch, currentProfile.full_name]
  )

  // ── Sup table data ───────────────────────────────────────────
  const supRows = useMemo(() => {
    const sups = isAdmin ? visibleSups : visibleSups.filter(s => s.id === currentProfile.id)
    return sups.map(sup => {
      const jrs      = jrsOf(sup.id)
      const apiNames = [sup.full_name, ...jrs.map(j => j.full_name)]
      const groups   = SELLOUT_GROUPS.map(g => {
        const h = getProfileHedef(sup.id, g)
        const v = getGerc(apiNames, g, sup.full_name)
        const p = pct(h, v)
        const prim = calcPrim(h, v, PRIM_SUP[g], donem)
        return { g, h, v, p, prim }
      })
      const tH = groups.reduce((s, x) => s + x.h, 0)
      const tV = groups.reduce((s, x) => s + x.v, 0)
      const tP = pct(tH, tV)
      const tPrim = groups.reduce((s, x) => s + x.prim, 0)
      return { profile: sup, groups, tH, tV, tP, tPrim }
    })
  }, [visibleSups, isAdmin, currentProfile.id, jrsOf, getProfileHedef, getGerc, donem])

  // Sup totals footer
  const supFooter = useMemo(() => {
    const totH = supRows.reduce((s, r) => s + r.tH, 0)
    const totV = supRows.reduce((s, r) => s + r.tV, 0)
    const totPrim = supRows.reduce((s, r) => s + r.tPrim, 0)
    const groupTotals = SELLOUT_GROUPS.map((g, i) => ({
      g,
      h:    supRows.reduce((s, r) => s + r.groups[i].h, 0),
      v:    supRows.reduce((s, r) => s + r.groups[i].v, 0),
      prim: supRows.reduce((s, r) => s + r.groups[i].prim, 0),
    }))
    return { groupTotals, totH, totV, totP: pct(totH, totV), totPrim }
  }, [supRows])

  // ── Jr table data ────────────────────────────────────────────
  const jrRows = useMemo(() => {
    // Jr: kendisi + öncülü (Jr devri; öncül yalnızca görevde olduğu aylarda görünür)
    const oncul = isJr ? devraldiklari(currentProfile.full_name) : []
    const jrs = (isAdmin || isSup) ? visibleJrs
      : visibleJrs.filter(j => j.id === currentProfile.id || oncul.some(a => namesMatch(a, j.full_name)))
    return jrs.map(jr => {
      const sup = team.find(p => p.id === jr.manager_id)
      const groups = SELLOUT_GROUPS.map(g => {
        const h = getProfileHedef(jr.id, g)
        const v = getGerc([jr.full_name], g)
        const p = pct(h, v)
        const prim = calcPrim(h, v, PRIM_JR[g], donem)
        return { g, h, v, p, prim }
      })
      const tH = groups.reduce((s, x) => s + x.h, 0)
      const tV = groups.reduce((s, x) => s + x.v, 0)
      const tP = pct(tH, tV)
      const tPrim = groups.reduce((s, x) => s + x.prim, 0)
      return { profile: jr, sup, groups, tH, tV, tP, tPrim }
    })
  }, [visibleJrs, isAdmin, isSup, currentProfile.id, team, getProfileHedef, getGerc, donem])

  // Jr totals footer
  const jrFooter = useMemo(() => {
    const totH = jrRows.reduce((s, r) => s + r.tH, 0)
    const totV = jrRows.reduce((s, r) => s + r.tV, 0)
    const totPrim = jrRows.reduce((s, r) => s + r.tPrim, 0)
    const groupTotals = SELLOUT_GROUPS.map((g, i) => ({
      g,
      h:    jrRows.reduce((s, r) => s + r.groups[i].h, 0),
      v:    jrRows.reduce((s, r) => s + r.groups[i].v, 0),
      prim: jrRows.reduce((s, r) => s + r.groups[i].prim, 0),
    }))
    return { groupTotals, totH, totV, totP: pct(totH, totV), totPrim }
  }, [jrRows])

  // ── Merch table data ─────────────────────────────────────────
  const filteredMerch = useMemo(() => {
    // "Listede Görünmesin" işaretli merchler ana listede gizlenir
    // (hedef modalında görünmeye devam eder — oradan geri açılabilir).
    let base = visibleMerch.filter(m => !gizleFlags[m.name])
    if (merchCari) base = base.filter(m => m.cariIsim === merchCari)
    if (!merchSearch.trim()) return base
    // Arama: merch adı, bağlı olduğu kişi (Jr. Süpervizör / Süpervizör) ve
    // Jr.'a bağlıysa onun Süpervizörü. Türkçe karakter/büyük-küçük harf toleranslı.
    const q = normalizeName(merchSearch)
    const supOf = (apiName: string) => {
      const jr = team.find(p => p.role === 'jr' && namesMatch(p.full_name, apiName))
      return jr ? (team.find(p => p.id === jr.manager_id)?.full_name ?? '') : ''
    }
    return base.filter(m =>
      normalizeName(m.name).includes(q) ||
      normalizeName(m.supApiName).includes(q) ||
      normalizeName(supOf(m.supApiName)).includes(q)
    )
  }, [visibleMerch, merchSearch, gizleFlags, merchCari, team])

  // Merch sekmesi cari filtresi seçenekleri
  const merchCariOptions = useMemo(
    () => [...new Set(visibleMerch.filter(m => !gizleFlags[m.name]).map(m => m.cariIsim).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr')),
    [visibleMerch, gizleFlags]
  )

  const merchRows = useMemo(() =>
    filteredMerch.map(m => {
      const groups = SELLOUT_GROUPS.map(g => {
        const h = getMerchHedef(m.name, g)
        const v = periodRows
          .filter(r => r.merch_personel === m.name && GRUP_NORMALIZE[r.grup_aciklama] === g)
          .reduce((s, r) => s + r.satilan_adet, 0)
        const p    = pct(h, v)
        const prim = calcPrim(h, v, PRIM_MERCH[g], donem)
        return { g, h, v, p, prim }
      })
      const tH    = groups.reduce((s, x) => s + x.h, 0)
      const tV    = groups.reduce((s, x) => s + x.v, 0)
      const tPrim = groups.reduce((s, x) => s + x.prim, 0)
      return { name: m.name, supApiName: m.supApiName, cariIsim: m.cariIsim, subeAdi: m.subeAdi, groups, tH, tV, tP: pct(tH, tV), tPrim }
    }),
  [filteredMerch, getMerchHedef, periodRows, donem])

  // Admin: listede görünen merchlerin süpervizör (bağlı olduğu kişi) bazında adedi
  const merchSupCounts = useMemo(() => {
    const m = new Map<string, number>()   // key: temiz tam ad (SV eki atılmış)
    filteredMerch.forEach(x => {
      const clean = (x.supApiName || '').replace(/\bSV\b/gi, '').replace(/\s+/g, ' ').trim() || '—'
      m.set(clean, (m.get(clean) ?? 0) + 1)
    })
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
  }, [filteredMerch])

  // ── Target entry rows ────────────────────────────────────────
  const supTargetRows = useMemo((): TargetRow[] =>
    (isAdmin ? visibleSups : visibleSups.filter(s => s.id === currentProfile.id))
      .map(s => {
        const jrCount = jrsOfSupName(s.full_name)
        const subeCount = subesOfSup(s.full_name)
        const merchCount = merchsOfSup(s.full_name)
        return {
          key: s.id,
          label: s.full_name,
          sublabel: `${jrCount} jr.sup, ${subeCount} şube, ${merchCount} merch`,
          isProfile: true,
        }
      }),
  [visibleSups, isAdmin, currentProfile.id, jrsOfSupName, subesOfSup, merchsOfSup])

  const jrTargetRows = useMemo((): TargetRow[] => {
    const jrs = (isAdmin)
      ? visibleJrs
      : isSup
        ? jrsOf(currentProfile.id)
        : []
    return jrs.map(j => ({
      key: j.id, label: j.full_name,
      sublabel: team.find(p => p.id === j.manager_id)?.full_name,
      isProfile: true,
    }))
  }, [visibleJrs, isAdmin, isSup, currentProfile.id, jrsOf, team])

  const merchTargetRows = useMemo((): TargetRow[] =>
    visibleMerch.map(m => ({
      key: m.name, label: m.name,
      sublabel: m.supApiName,
      isProfile: false,
      supervisorName: m.supApiName,
    })),
  [visibleMerch])

  // ── Save handlers ────────────────────────────────────────────
  const handleSave = async (pts: ProfileTarget[], mts: MerchTarget[]) => {
    const ok1 = pts.length ? await upsertProfileTargets(pts) : true
    const ok2 = mts.length ? await upsertMerchTargets(mts) : true
    if (ok1 && ok2) setTargetModal(null)
  }

  // ── Özel Uygulama Takip (Eylül 2026 EKSTRA Prim) ───────────
  // Şube bazında tanımlı ürün gruplarının satış adedi; eşik ve üzeri şubeler çift prim
  // hakkeder. Rol bazlı görünürlük: Admin tümü, Sup kendi + Jr'ları,
  // Jr kendi şubeleri (merch-detay'daki sup_adi/jr_adi eşleşmesi).
  const ozelRows = useMemo(() => {
    // Seçili döneme göre çalışır (özel uygulama aylık farklılık gösterebilir).
    // Prim yalnızca Bayi Merch için geçerli — Çetinler Merch satışları sayılmaz
    // (yalnızca Çetinler Merch olan şubeler tabloya girmez).
    const gruplar = getOzelGruplar(donem)
    // merch-detay: norm(cari)||norm(sube) → { sup, jr }
    const detay = new Map<string, { sup: string; jr: string }>()
    merchDetayData.forEach(d => {
      const k = `${normalizeName(d.cari_adi)}||${normalizeName(d.sube_adi)}`
      if (!detay.has(k)) detay.set(k, { sup: d.sup_adi || '', jr: d.jr_adi || '' })
    })

    // Şube (cari+sube) bazında her özel grup için adet (yalnızca Bayi Merch)
    const groups = ozelSubeAdetleri(allRows.map(r => ({
      cari: r.cari_isim, sube: r.sube_adi, stokKodu: r.stok_kodu, adet: r.satilan_adet, merchTipi: r.merch_tipi, donem: r.donem,
    })), donem)

    type Row = { cari: string; sube: string; grup: string; renk: string; hedef: number; gerc: number; kalan: number; ulasti: boolean }
    const out: Row[] = []
    for (const [k, g] of groups) {
      const info = detay.get(k)
      let visible = false
      if (isAdmin) visible = true
      else if (isSup) visible = !!info && namesMatch(info.sup, currentProfile.full_name)
      else if (isJr) visible = !!info && namesMatch(info.jr, currentProfile.full_name)
      if (!visible) continue

      for (const grp of gruplar) {
        const gerc = g.adet[grp.key] ?? 0
        if (gerc <= 0) continue
        out.push({
          cari: g.cari, sube: g.sube, grup: grp.badge, renk: grp.renk,
          hedef: grp.hedef, gerc,
          kalan: Math.max(0, grp.hedef - gerc),
          ulasti: gerc >= grp.hedef,
        })
      }
    }
    // Hakkedenler üstte değil — takip için: önce hakketmeyen & yakın olanlar,
    // sonra hakkedenler. (kalan artan; hakkedenler en sonda)
    out.sort((a, b) =>
      Number(a.ulasti) - Number(b.ulasti) ||
      a.kalan - b.kalan ||
      a.cari.localeCompare(b.cari, 'tr') ||
      a.sube.localeCompare(b.sube, 'tr') ||
      a.grup.localeCompare(b.grup)
    )
    return out
  }, [allRows, donem, merchDetayData, isAdmin, isSup, isJr, currentProfile.full_name])

  // Cari / Şube filtre seçenekleri (rol kapsamına göre)
  const ozelCariOptions = useMemo(
    () => [...new Set(ozelRows.map(r => r.cari))].sort((a, b) => a.localeCompare(b, 'tr')),
    [ozelRows]
  )
  const ozelSubeOptions = useMemo(
    () => [...new Set(ozelRows.filter(r => !ozelCari || r.cari === ozelCari).map(r => r.sube))]
      .sort((a, b) => a.localeCompare(b, 'tr')),
    [ozelRows, ozelCari]
  )
  const ozelFiltered = useMemo(
    () => ozelRows.filter(r => (!ozelCari || r.cari === ozelCari) && (!ozelSube || r.sube === ozelSube)),
    [ozelRows, ozelCari, ozelSube]
  )
  const ozelUlasan = useMemo(() => ozelFiltered.filter(r => r.ulasti).length, [ozelFiltered])

  const exportOzelExcel = useCallback(() => {
    const headers = ['Cari', 'Şube', 'Grup', 'Grup Hedef', 'Gerçekleşen', 'Kalan', 'Durum']
    const aoa: (string | number)[][] = [headers]
    for (const r of ozelFiltered) {
      aoa.push([r.cari, r.sube, r.grup, r.hedef, r.gerc, r.kalan, r.ulasti ? 'Çift Prim' : `${r.kalan} kaldı`])
    }
    // Alt toplam
    aoa.push(['TOPLAM', '', '', '', ozelFiltered.reduce((s, r) => s + r.gerc, 0), ozelFiltered.reduce((s, r) => s + r.kalan, 0), ''])
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 46 }, { wch: 18 }, { wch: 8 }, { wch: 11 }, { wch: 13 }, { wch: 8 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Özel Uygulama Takip')
    XLSX.writeFile(wb, `Ozel_Uygulama_Takip_${donem}.xlsx`)
  }, [ozelFiltered, donem])

  // ── Which sub-tabs are visible? ───────────────────────────────
  const showSupTab  = (isAdmin || isSup) && !isMerch
  const showJrTab   = (isAdmin || isSup || isJr) && !isMerch
  const showMerchTab = true

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar: period + sync ── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white">
        {/* Period picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Dönem:</span>
          <div className="relative">
            <select
              value={donem}
              onChange={e => setDonem(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
            >
              {donemOptions().map(d => (
                <option key={d} value={d}>{donemLabel(d)}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex-1" />

        {/* Sync status */}
        {fetchedAt && (
          <span className="text-[10px] text-gray-400">
            Son güncelleme: {fetchedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={reloadSellout}
          disabled={selloutLoading}
          className="p-1.5 text-gray-400 hover:text-brand-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw size={13} className={clsx(selloutLoading && 'animate-spin')} />
        </button>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="flex-shrink-0 flex border-b border-gray-100 bg-white px-4 gap-1 pt-1">
        {!isBsy && showSupTab && (
          <button
            onClick={() => setSubTab('sup')}
            className={clsx(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              subTab === 'sup' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >Süpervizör</button>
        )}
        {!isBsy && showJrTab && (
          <button
            onClick={() => setSubTab('jr')}
            className={clsx(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              subTab === 'jr' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >Jr. Süpervizör</button>
        )}
        {!isBsy && showMerchTab && (
          <button
            onClick={() => setSubTab('merch')}
            className={clsx(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              subTab === 'merch' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >Merch</button>
        )}
        <button
          onClick={() => setSubTab('top20')}
          className={clsx(
            'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            subTab === 'top20' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          )}
        >Top 20</button>
        <button
          onClick={() => setSubTab('satislar')}
          className={clsx(
            'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            subTab === 'satislar' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          )}
        >Satışlar</button>
        {!isMerch && (
        <button
          onClick={() => setSubTab('satisgirmeyen')}
          className={clsx(
            'px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
            subTab === 'satisgirmeyen' ? 'border-rose-500 text-rose-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          )}
        >Şube Takibi</button>
        )}
        {(isAdmin || isSup || isJr) && (
          <button
            onClick={() => setSubTab('ozel')}
            className={clsx(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
              subTab === 'ozel' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >🚀 Özel Uygulama Takip</button>
        )}
        <div className="flex-1" />
        {/* Target entry button */}
        {(isAdmin || isSup) && subTab !== 'sup' && subTab !== 'ozel' && subTab !== 'satisgirmeyen' && (
          <button
            onClick={() => setTargetModal(subTab)}
            className="flex items-center gap-1 px-2 py-1 mb-1 text-[11px] bg-brand-700 text-white rounded-lg hover:bg-brand-600"
          >
            <Target size={11} /> Hedef Gir
          </button>
        )}
        {isAdmin && subTab === 'sup' && (
          <button
            onClick={() => setTargetModal('sup')}
            className="flex items-center gap-1 px-2 py-1 mb-1 text-[11px] bg-brand-700 text-white rounded-lg hover:bg-brand-600"
          >
            <Target size={11} /> Hedef Gir
          </button>
        )}
      </div>

      {/* ── Table area ── */}
      <div className="flex-1 overflow-auto p-2">
        {selloutLoading && (
          <div className="flex items-center justify-center h-32 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin mr-2" /> Veri yükleniyor…
          </div>
        )}

        {!selloutLoading && subTab === 'sup' && showSupTab && (
          <>
          <SelloutAciklama donem={donem} sekme="sup" isAdmin={isAdmin} profileId={currentProfile.id} />
          <SelloutTable
            rows={supRows.map(r => {
              const jrCount = jrsOfSupName(r.profile.full_name)
              const subeCount = subesOfSup(r.profile.full_name)
              const merchCount = merchsOfSup(r.profile.full_name)
              return {
                label: r.profile.full_name,
                sublabel: `${jrCount} jr.sup, ${subeCount} şube, ${merchCount} merch`,
                color: r.profile.color,
                groups: r.groups.map(g => ({ h: g.h, v: g.v, p: g.p, prim: g.prim })),
                tH: r.tH, tV: r.tV, tP: r.tP, tPrim: r.tPrim,
              }
            })}
            footer={{ groups: supFooter.groupTotals.map(g => ({ h: g.h, v: g.v, p: pct(g.h, g.v), prim: g.prim })), tH: supFooter.totH, tV: supFooter.totV, tP: supFooter.totP, tPrim: supFooter.totPrim }}
            showPrim
            kategoriPrimi={PRIM_SUP}
          />
          <SayfaParametreleri
            visible={isAdmin}
            baslik="Sellout ▸ Süpervizör"
            aciklama="Süpervizörlerin, seçili dönemdeki kategori bazlı sellout satış hedef/gerçekleşme ve prim tablosu. Her süpervizöre kendi + bağlı Jr. Süpervizörlerinin satışları dahildir."
            parametreler={[
              { label: 'Dönem', value: `Üstteki "Dönem" seçimi (şu an: ${donemLabel(donem)}). Hedef, gerçekleşen ve primler bu döneme aittir.` },
              { label: 'Kişi listesi', value: 'Süpervizör rolündeki profiller (Supabase). Admin tümünü görür; süpervizör yalnızca kendi satırını görür.' },
              { label: 'Kategori grupları', value: 'IPL · Üflemeli · Düzleştirici&Maşa · Epilatör&Baskül&Mutfak · Erkek Bakım · Süpürge · Mutfak ve Diğer (grup_aciklama → GRUP_NORMALIZE eşlemesiyle).' },
              { label: 'Hedef (Hed.)', value: '"Hedef Gir" ile girilen, dönem bazlı süpervizör hedefleri (Supabase profile_targets).' },
              { label: 'Gerçekleşen (Gerç.)', value: 'Sellout satışından (/api/sellout) süpervizörün KENDİ + bağlı Jr. Süpervizörlerinin o gruba ait satılan_adet toplamı. İsim eşleşmesi normalizeName ile (Türkçe harf + " SV" eki toleranslı).' },
              { label: '% ve renkler', value: 'Gerç ÷ Hedef. ≥%100 koyu yeşil, ≥%80 açık yeşil, ≥%60 sarı, <%60 kırmızı.' },
              { label: 'Kat. Primi (₺)', value: 'IPL 7.500 · Üflemeli 6.500 · Düzleştirici&Maşa 4.000 · Epilatör&Baskül&Mutfak 2.500 · Erkek Bakım 1.500 · Süpürge 7.000 · Mutfak ve Diğer 3.000 (toplam 32.000 · Süpervizör seviyesi = PRIM_SUP).' },
              { label: 'Prim hesabı', value: 'Hedef 0 → prim yok. Oran <%80 → prim yok. Oran ≥%80 → KatPrimi × min(oran, %100). Yani %100+ tam prim, %80–100 arası oranla (calcPrim, eşik PRIM_ESIGI=%80). Ekim 2026 özel uygulama: bu prim ayrıca oran %80+ → ×1,25 · %100+ → ×1,75 · %130+ → ×2,25 ile çarpılır (OZEL_KATEGORI_PRIM).' },
              { label: 'İsim altı sayılar', value: 'jr.sup / şube / merch — /api/merch-detay (PHP) canlı verisinden: süpervizöre bağlı benzersiz Jr. Süpervizör, SUBE_KODU ve "Çetinler Merch" adedi. Bu sayılar döneme bağlı DEĞİL, güncel atama yapısını gösterir.' },
              { label: 'Toplam sütunu', value: 'Satırdaki tüm grupların Hedef / Gerçekleşen / Prim toplamı.' },
            ]}
          />
          </>
        )}

        {!selloutLoading && subTab === 'jr' && showJrTab && (
          <>
          <SelloutAciklama donem={donem} sekme="jr" isAdmin={isAdmin} profileId={currentProfile.id} />
          <SelloutTable
            rows={jrRows.map(r => {
              const subeCount = subesOfJr(r.profile.full_name)
              const merchCount = merchsOfJr(r.profile.full_name)
              return {
                label: r.profile.full_name,
                sublabel: `${r.sup?.full_name || '—'} · ${subeCount} şube, ${merchCount} merch`,
                color: r.profile.color,
                groups: r.groups.map(g => ({ h: g.h, v: g.v, p: g.p, prim: g.prim })),
                tH: r.tH, tV: r.tV, tP: r.tP, tPrim: r.tPrim,
              }
            })}
            footer={{ groups: jrFooter.groupTotals.map(g => ({ h: g.h, v: g.v, p: pct(g.h, g.v), prim: g.prim })), tH: jrFooter.totH, tV: jrFooter.totV, tP: jrFooter.totP, tPrim: jrFooter.totPrim }}
            showPrim
            kategoriPrimi={PRIM_JR}
          />
          </>
        )}

        {!selloutLoading && subTab === 'merch' && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <input
                type="text"
                placeholder="Merch, Jr. Süpervizör veya Süpervizör ara…"
                value={merchSearch}
                onChange={e => setMerchSearch(e.target.value)}
                className="w-full max-w-xs text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400"
              />
              {merchCariOptions.length > 1 && (
                <select
                  value={merchCari}
                  onChange={e => setMerchCari(e.target.value)}
                  className="max-w-xs text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-400"
                >
                  <option value="">Tüm Cariler</option>
                  {merchCariOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <span className="text-[10px] text-gray-400">{filteredMerch.length} merch</span>
              {isAdmin && merchSupCounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                  {merchSupCounts.map(([name, n], i) => (
                    <span key={name} className="whitespace-nowrap">
                      <b className="text-gray-700">{name.split(' ')[0]}</b> {n} merch{i < merchSupCounts.length - 1 ? ' ·' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <SelloutAciklama donem={donem} sekme="merch" isAdmin={isAdmin} profileId={currentProfile.id} />
            <SelloutTable
              rows={merchRows.map(r => ({
                label:     r.name,
                sublabel:  r.supApiName,
                sublabel2: [r.cariIsim?.split(' ')[0], r.subeAdi].filter(Boolean).join(' / '),
                groups:    r.groups.map(g => ({ h: g.h, v: g.v, p: g.p, prim: g.prim })),
                tH: r.tH, tV: r.tV, tP: r.tP, tPrim: r.tPrim,
                labelColor: r.tV === 0 ? '#ef4444' : undefined, // Satış yoksa kırmızı
              }))}
              footer={(() => {
                const totH    = merchRows.reduce((s, r) => s + r.tH, 0)
                const totV    = merchRows.reduce((s, r) => s + r.tV, 0)
                const totPrim = merchRows.reduce((s, r) => s + r.tPrim, 0)
                const groupTotals = SELLOUT_GROUPS.map((_, i) => ({
                  h:    merchRows.reduce((s, r) => s + r.groups[i].h, 0),
                  v:    merchRows.reduce((s, r) => s + r.groups[i].v, 0),
                  p:    pct(merchRows.reduce((s, r) => s + r.groups[i].h, 0), merchRows.reduce((s, r) => s + r.groups[i].v, 0)),
                  prim: merchRows.reduce((s, r) => s + r.groups[i].prim, 0),
                }))
                return { groups: groupTotals, tH: totH, tV: totV, tP: pct(totH, totV), tPrim: totPrim }
              })()}
              showPrim
              showRowNo
              kategoriPrimi={PRIM_MERCH}
            />
            <SayfaParametreleri
              visible={isAdmin}
              baslik="Sellout ▸ Merch (Çetinler Merch)"
              aciklama="Çetinler Merch personelinin, seçili dönemdeki kategori bazlı satış hedef/gerçekleşme ve prim tablosu."
              parametreler={[
                { label: 'Dönem', value: `Üstteki "Dönem" seçimi (şu an: ${donemLabel(donem)}). Tüm hedef, gerçekleşen ve primler bu döneme aittir.` },
                { label: 'Kişi listesi', value: 'merch_tipi = "Çetinler Merch" olan personel. Satış yapanlar (sellout) + merch-detay listesinde tanımlı satış yapmayanlar dahil. Satışı 0 olanlar kırmızı yazılır.' },
                { label: 'Arama', value: 'Merch adı veya bağlı Süpervizör adına göre filtreler.' },
                { label: 'Kategori grupları', value: 'IPL · Üflemeli · Düzleştirici&Maşa · Epilatör&Baskül&Mutfak · Erkek Bakım · Süpürge · Mutfak ve Diğer (grup_aciklama → GRUP_NORMALIZE eşlemesiyle).' },
                { label: 'Hedef (Hed.)', value: '"Hedef Gir" ile girilen, dönem bazlı merch hedefleri (Supabase).' },
                { label: 'Gerçekleşen (Gerç.)', value: 'Sellout satış verisinden (/api/sellout) o merch + gruba ait satılan_adet toplamı.' },
                { label: '% ve renkler', value: 'Gerç ÷ Hedef. ≥%100 koyu yeşil, ≥%80 açık yeşil, ≥%60 sarı, <%60 kırmızı.' },
                { label: 'Kat. Primi (₺)', value: 'IPL 3.750 · Üflemeli 3.250 · Düzleştirici&Maşa 2.000 · Epilatör&Baskül&Mutfak 1.250 · Erkek Bakım 1.250 · Süpürge 3.750 · Mutfak ve Diğer 1.250 (Merch seviyesi = PRIM_MERCH).' },
                { label: 'Prim hesabı', value: 'Hedef 0 → prim yok. Oran <%80 → prim yok. Oran ≥%80 → KatPrimi × min(oran, %100). Yani %100+ tam prim, %80–100 arası oranla (calcPrim). Ekim 2026 özel uygulama: bu prim ayrıca oran %80+ → ×1,25 · %100+ → ×1,75 · %130+ → ×2,25 ile çarpılır (OZEL_KATEGORI_PRIM).' },
                { label: 'Toplam sütunu', value: 'Satırdaki tüm grupların Hedef / Gerçekleşen / Prim toplamı.' },
              ]}
            />
          </>
        )}

        {/* ── Top 30 Şube Sıralaması ── */}
        {!selloutLoading && subTab === 'top20' && (
          <div className="space-y-5 pb-4">
            <div className="px-1 pt-1">
              <p className="text-[10px] text-gray-400 mb-3">
                Seçilen dönem için şube bazında satış adedi sıralaması
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Top20Table
                  title="1 · IPL Grubu"
                  subtitle="Kategori bazında tüm şubeler"
                  data={top20Ipl}
                  colorMap={globalCariColorMap}
                  highlight={myMerchSubeKeys}
                />
                <Top20Table
                  title="2 · RMS9200 Stokları"
                  subtitle="RMS9200 ile başlayan stoklarda tüm şubeler"
                  data={top20Rms}
                  colorMap={globalCariColorMap}
                  highlight={myMerchSubeKeys}
                />
                <Top20Table
                  title="3 · Süpürge Grubu"
                  subtitle="Kategori bazında tüm şubeler"
                  data={top20Supurge}
                  colorMap={globalCariColorMap}
                  highlight={myMerchSubeKeys}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Satışlar Tablosu ── */}
        {!selloutLoading && subTab === 'satislar' && (
          <div className="p-2">
            {/* Filtreler */}
            {(() => {
              const tipiOptions = [...new Set(satislarBaseRows.map(r => r.merch_tipi).filter(Boolean))].sort()
              const merchOptions = [...new Set(satislarBaseRows.map(r => r.merch_personel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
              const cariOptions  = [...new Set(satislarBaseRows.map(r => r.sube_adi ? `${r.cari_isim} – ${r.sube_adi}` : r.cari_isim).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
              return (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <select value={satMerchTipi} onChange={e => setSatMerchTipi(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-brand-400 max-w-[160px]">
                    <option value="">Merch Tipi (Tümü)</option>
                    {tipiOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={satMerch} onChange={e => setSatMerch(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-brand-400 max-w-[200px]">
                    <option value="">Merch (Tümü)</option>
                    {merchOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={satCari} onChange={e => setSatCari(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-brand-400 max-w-[260px]">
                    <option value="">Cari ve Şube (Tümü)</option>
                    {cariOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {(satMerchTipi || satMerch || satCari) && (
                    <button onClick={() => { setSatMerchTipi(''); setSatMerch(''); setSatCari('') }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline">Sıfırla</button>
                  )}
                  <button
                    onClick={exportSatislarExcel}
                    disabled={satislarRows.length === 0}
                    className="ml-auto flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Görünen satışları Excel'e aktar"
                  >
                    <FileDown size={13} /> Excel'e Aktar
                  </button>
                  <span className="text-[10px] text-gray-400">{satislarRows.length.toLocaleString('tr-TR')} kayıt</span>
                </div>
              )
            })()}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="text-xs border-collapse w-full bg-white">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-800 text-white">
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[140px]">Merch Personel</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Cari</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[120px]">Şube</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Stok Adı</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[100px]">Stok Kodu</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[150px]">Grup/Kategori</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">Satılan Adet</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[120px]">Süpervizör</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[100px]">Merch Tipi</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[80px]">BSY</th>
                    {/* Çetinler Merch kullanıcısı BSY'den sonraki prim kolonlarını görmez */}
                    {!isMerch && (<>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[110px] bg-blue-700">Bayi Merch Adet Primi</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[130px] bg-blue-800">Bayi Merch Prim Hakedişi</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[140px] bg-purple-700">Destek Per. Adet Primi</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[140px] bg-green-700">Çet. Merch Kat. Gerç. %</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[160px] bg-green-800">Çet. Merch Gerç.Oranına Göre Prim</th>
                    </>)}
                  </tr>
                  {/* ── Üst toplam satırı ── */}
                  {(() => {
                    const fmt2 = (n: number) => n > 0 ? `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'
                    return (
                      <tr className="bg-gray-700 text-white text-[11px] font-semibold">
                        <td colSpan={6} className="px-3 py-1.5 text-right text-gray-300">TOPLAM</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {satislarTotals.toplamAdet.toLocaleString('tr-TR')}
                        </td>
                        <td colSpan={3} className="px-3 py-1.5 text-center text-gray-300 text-[10px]">
                          {satislarRows.length.toLocaleString('tr-TR')} kayıt
                        </td>
                        {!isMerch && (<>
                        <td className="px-3 py-1.5 text-right tabular-nums bg-blue-800">—</td>
                        <td className="px-3 py-1.5 text-right tabular-nums bg-blue-800">{fmt2(satislarTotals.bayiHakedis)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums bg-purple-800">{fmt2(satislarTotals.destekHakedis)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums bg-green-800">—</td>
                        <td className="px-3 py-1.5 text-right tabular-nums bg-green-800">{fmt2(satislarTotals.cetinlerPrim)}</td>
                        </>)}
                      </tr>
                    )
                  })()}
                </thead>
                <tbody>
                  {satislarRows.length === 0 ? (
                    <tr>
                      <td colSpan={isMerch ? 10 : 15} className="px-4 py-8 text-center text-gray-400 text-[11px]">
                        Bu dönem için satış verisi yok
                      </td>
                    </tr>
                  ) : (
                    satislarRows.map((row, idx) => {
                      // Hesaplamalar
                      const primData = adetPrimMap.get(row.stok_kodu || '') || { bayiMerch: 0, kosulluDestek: 0, kategori: '' }
                      const satisAdedi = row.satilan_adet || 0

                      // 1. Bayi Merch Adet Primi (özel prim kuralı varsa uygula — merch tipinden bağımsız)
                      const bayiMerchPrimAdet = getEffectiveBayiMerch(row.stok_kodu || '', (row.grup_kodu || '').toUpperCase(), row.cari_isim || '', row.sube_adi || '', row.tarih || '', row.merch_tipi || '')

                      // 2. Bayi Merch Prim Hakedişi
                      const bayiMerchHakedis = bayiMerchPrimAdet * satisAdedi

                      // 3. Destek Personeli Adet Primi — yalnızca o dönem için flag'li Merch'ler
                      //    (özel koşullu destek ek'i de uygulanır)
                      const destekVarMi = row.merch_tipi === 'Çetinler Merch' && !!destekFlags[row.merch_personel || '']
                      const destekPrimAdet = destekVarMi
                        ? getEffectiveKosulluDestek(row.stok_kodu || '', (row.grup_kodu || '').toUpperCase(), row.cari_isim || '', row.sube_adi || '', row.tarih || '')
                        : 0

                      // 4. Çetinler Merch Kategori Gerçekleşme Oranı
                      const merchKey = (row.merch_personel || '').toLowerCase()
                      const kategoriRaw = row.grup_aciklama || ''
                      const kategoriNormalized = GRUP_NORMALIZE[kategoriRaw] || kategoriRaw
                      const merchKategoriData = merchKategoriPerformans.get(merchKey)?.get(kategoriNormalized)
                      const cetinlerMerchGercOran = merchKategoriData?.oran || 0

                      // 5. Çetinler Merch Gerç.Oranına Göre Adet Primi
                      // >=100% → tam destek prim, <100% → oran × destek prim
                      const cetinlerMerchPrim = destekPrimAdet > 0
                        ? (cetinlerMerchGercOran >= 100
                            ? destekPrimAdet * satisAdedi
                            : (cetinlerMerchGercOran / 100) * destekPrimAdet * satisAdedi)
                        : 0

                      return (
                        <tr
                          key={idx}
                          className={clsx(
                            'border-b border-gray-100 last:border-0',
                            devirSet.has(row) ? 'bg-amber-50/70' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                          )}
                        >
                          <td className="px-3 py-2 font-medium text-gray-800">{row.merch_personel || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{row.cari_isim || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.sube_adi || '—'}</td>
                          <td className="px-3 py-2 text-gray-700 text-[11px]">{row.stok_adi || '—'}</td>
                          <td className="px-3 py-2 font-mono text-gray-800">{row.stok_kodu || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.grup_aciklama || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                            {satisAdedi.toLocaleString('tr-TR')}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {row.supervisor_adi || '—'}
                            {devirSet.has(row) && (
                              <div
                                className="text-[9px] font-medium text-amber-700"
                                title="Eylül satışı Atilla Yılmaz'a yazılır; şube artık sizde olduğu için bilgi amaçlı gösteriliyor. Toplamlara dahil değildir."
                              >
                                Devir · toplama dahil değil
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={clsx(
                              'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium',
                              row.merch_tipi === 'Çetinler Merch'
                                ? 'bg-brand-100 text-brand-700'
                                : 'bg-gray-100 text-gray-600'
                            )}>
                              {row.merch_tipi || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700 text-[11px]">{row.bsy || '—'}</td>

                          {/* YENİ KOLONLAR */}
                          {!isMerch && (<>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-700 font-medium bg-blue-50">
                            {bayiMerchPrimAdet > 0 ? `${bayiMerchPrimAdet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-800 font-bold bg-blue-100">
                            {bayiMerchHakedis > 0 ? `${bayiMerchHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-purple-700 font-medium bg-purple-50">
                            {destekPrimAdet > 0 ? `${destekPrimAdet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 font-medium bg-green-50">
                            {cetinlerMerchGercOran > 0 ? `%${cetinlerMerchGercOran.toFixed(1)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-800 font-bold bg-green-100">
                            {cetinlerMerchPrim > 0 ? `${cetinlerMerchPrim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'}
                          </td>
                          </>)}
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  {(() => {
                    const fmt2 = (n: number) => n > 0 ? `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '—'
                    return (
                      <tr className="bg-gray-800 text-white font-semibold">
                        <td colSpan={6} className="px-3 py-2.5 text-right">TOPLAM</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {satislarTotals.toplamAdet.toLocaleString('tr-TR')}
                        </td>
                        <td colSpan={3} className="px-3 py-2.5 text-center text-[10px]">
                          {satislarRows.length.toLocaleString('tr-TR')} kayıt
                        </td>
                        {!isMerch && (<>
                        <td className="px-3 py-2.5 text-right tabular-nums bg-blue-900">—</td>
                        <td className="px-3 py-2.5 text-right tabular-nums bg-blue-900">{fmt2(satislarTotals.bayiHakedis)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums bg-purple-900">{fmt2(satislarTotals.destekHakedis)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums bg-green-900">—</td>
                        <td className="px-3 py-2.5 text-right tabular-nums bg-green-900">{fmt2(satislarTotals.cetinlerPrim)}</td>
                        </>)}
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Satış Girmeyen Şubeler Takip (otomatik, döneme göre) ── */}
        {!selloutLoading && subTab === 'satisgirmeyen' && (
          <div className="p-2 pb-4">
            <p className="mb-2 px-1 text-[11px] text-gray-500">
              Seçili dönemde ({donemLabel(donem)}) sorumlu kişinin tüm şubeleri, satış adedine göre büyükten küçüğe sıralı
              (satış girmeyenler = 0 en altta). Başlıkta: toplam şube · satışlı · girmeyen adedi.
              Atanmış şubeler /api/merch-detay’den, satışlar /api/sellout (export_merch_satis.php)’den otomatik hesaplanır — elle giriş yoktur.
            </p>
            <p className="mb-2 px-1 text-[11px] text-gray-500">
              <span className="font-bold text-blue-700">Mavi kalın</span> şubelerde seçili ayda Çetinler Merch satış girişi var (üzerine gelince kim, kaç adet).
              {' '}<MapPin size={11} className="inline text-orange-500 -mt-0.5" /> seçili ayda ziyaret (check-in) edilen şube (üzerine gelince tarih ve kişi). Dipteki oran = Kalan ÷ Satış; 3,00 üstü <span className="text-red-600 font-semibold">kırmızı</span>, altı <span className="text-green-600 font-semibold">yeşil</span>.
            </p>
            <div className="mb-2 px-1 flex flex-wrap items-center gap-x-6 gap-y-2">
              {sgCariOptions.length > 1 && (
                <select
                  value={sgCari}
                  onChange={e => setSgCari(e.target.value)}
                  className="max-w-sm text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-brand-400"
                >
                  <option value="">Tüm Cariler</option>
                  {sgCariOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {sgOzet.toplam > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs"
                  title={`${sgCari || 'Tüm cariler'} · ${donemLabel(donem)} — aşağıdaki tablolardaki tekil şubeler (birden fazla kolonda olan şube bir kez sayılır)`}>
                  <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-700">
                    Şube: <b className="tabular-nums">{sgOzet.toplam.toLocaleString('tr-TR')}</b>
                  </span>
                  <span className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-green-800">
                    Satış giren: <b className="tabular-nums">{sgOzet.satisli.toLocaleString('tr-TR')}</b>
                    <span className="ml-1 text-green-700/70">(%{Math.round(sgOzet.satisli / sgOzet.toplam * 100)})</span>
                  </span>
                  <span className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800">
                    Girmeyen: <b className="tabular-nums">{sgOzet.girmeyen.toLocaleString('tr-TR')}</b>
                    <span className="ml-1 text-rose-700/70">(%{Math.round(sgOzet.girmeyen / sgOzet.toplam * 100)})</span>
                  </span>
                </div>
              )}
            </div>
            {/* Stok bilgisi + yönetici yükleme düğmeleri */}
            <div className="mb-2 px-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              {stokHata ? (
                <span className="text-amber-700">{stokHata}</span>
              ) : sgStok.subeSayisi > 0 ? (
                <span>
                  Stok milatı: <b>{sgStok.milatlar.map(m => m.split('-').reverse().join('.')).join(', ')}</b> · {sgStok.subeSayisi} şube
                  {' '}· Kalan = stok + teslim edilmemiş sevkler − milattan sonraki satışlar
                </span>
              ) : stokVeri ? (
                <span>Henüz stok yüklenmedi.</span>
              ) : null}
              {isAdmin && (
                <span className="ml-auto flex gap-2">
                  <button
                    onClick={async () => { setB2bYenileniyor(true); await atamaSonrasi(true); setB2bYenileniyor(false) }}
                    disabled={b2bYenileniyor}
                    title="B2B merch / süpervizör kayıtlarını önbelleği atlayarak yeniden çeker"
                    className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <RefreshCw size={12} className={b2bYenileniyor ? 'animate-spin' : ''} /> B2B&apos;den yenile
                  </button>
                  <button onClick={() => setStokYukle('stok')}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
                    <Upload size={12} /> Stok yükle
                  </button>
                  <button onClick={() => setStokYukle('sevk')}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
                    <Truck size={12} /> Sevk yükle
                  </button>
                </span>
              )}
            </div>
            {stokYukle && (
              <SubeStokYukle
                tip={stokYukle}
                cariler={sgCariOptions}
                varsayilanCari={sgCari}
                yuklemeler={stokVeri?.yuklemeler ?? []}
                onClose={() => setStokYukle(null)}
                onKaydedildi={stokYenile}
              />
            )}
            {satisGirmeyenColumns.every(c => c.subeler.length === 0) ? (
              <div className="text-center py-10 text-xs text-gray-400">
                Gösterilecek şube bulunamadı.
              </div>
            ) : (
              <div className="overflow-auto">
                <div className="flex items-start gap-3">
                  {satisGirmeyenColumns.map((c, ci) => {
                    const detaylar = c.subeler.map(s => sgStok.detay(s.subeKod))
                    const topSatis = c.subeler.reduce((t, s) => t + s.adet, 0)
                    const topBekleyen = detaylar.reduce((t, d) => t + (d.bekleyen ?? 0), 0)
                    const topKalan = detaylar.reduce((t, d) => t + (d.kalan ?? 0), 0)
                    const stokluSube = detaylar.filter(d => d.stokVar).length
                    const sayi = (n: number | null) => (n === null ? '—' : n.toLocaleString('tr-TR'))
                    return (
                      <table key={ci} className="border-collapse text-xs shrink-0">
                        <thead>
                          <tr>
                            <th colSpan={5} className="border border-gray-200 bg-brand-700 text-white px-3 py-1.5 text-center font-semibold whitespace-nowrap">
                              <div>{c.title}</div>
                              <div className="opacity-80 font-normal text-[10px]">
                                {c.subeler.length} şube · {c.subeler.filter(s => s.adet > 0).length} satışlı · {c.subeler.filter(s => s.adet <= 0).length} girmeyen
                              </div>
                            </th>
                          </tr>
                          <tr>
                            <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-center text-gray-400 w-8">#</th>
                            <th className="border border-gray-200 bg-gray-100 px-3 py-1 text-left font-medium text-gray-600 min-w-[200px]">Cari / Şube</th>
                            <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-right font-medium text-gray-600 w-16">Satış</th>
                            <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-right font-medium text-gray-600 w-16">Bekleyen</th>
                            <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-right font-medium text-gray-600 w-16">Kalan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.subeler.map((s, ri) => {
                            const d = detaylar[ri]
                            const key = `${ci}|${s.subeKod}`
                            const acik = sgAcik.has(key)
                            const acilir = d.urunler.length > 0
                            return (
                              <React.Fragment key={key}>
                                <tr className={clsx(ri % 2 ? 'bg-gray-50/60' : '', acilir && 'cursor-pointer hover:bg-brand-50/50')}
                                  onClick={() => acilir && setSgAcik(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })}>
                                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-400 tabular-nums">{ri + 1}</td>
                                  <td className="border border-gray-200 px-2 py-1 whitespace-nowrap"
                                    title={s.kayit ? `B2B kaydı (şube kodu ${s.subeKod}):\n${s.kayit}` : undefined}>
                                    <span className="inline-flex items-center gap-1">
                                      {acilir
                                        ? (acik ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />)
                                        : <span className="w-3" />}
                                      <span className={s.cetinler ? 'font-bold text-blue-700' : undefined}>
                                        {cariSubeKisa(s.cariAdi, s.subeAdi)}
                                      </span>
                                      {(() => {
                                        const zl = ziyaretBySube.get(subeZiyaretAnahtari(s.cariAdi, s.subeAdi))
                                        if (!zl?.length) return null
                                        const metin = zl.map(z => `${z.tarih.slice(8, 10)}.${z.tarih.slice(5, 7)} ${z.kisi}`.trim()).join('\n')
                                        return (
                                          <span className="inline-flex items-center text-orange-500" title={`Ziyaret (${donemLabel(donem)}):\n${metin}`}>
                                            <MapPin size={11} />
                                            {zl.length > 1 && <span className="text-[9px] font-semibold leading-none">{zl.length}</span>}
                                          </span>
                                        )
                                      })()}
                                    </span>
                                  </td>
                                  <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-gray-600">{s.adet}</td>
                                  <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-gray-600">{sayi(d.bekleyen)}</td>
                                  <td className={clsx('border border-gray-200 px-2 py-1 text-right tabular-nums font-medium',
                                    d.kalan !== null && d.kalan < 0 ? 'text-red-600' : 'text-gray-800')}>{sayi(d.kalan)}</td>
                                </tr>
                                {acik && d.urunler.map(u => (
                                  <tr key={`${key}|${u.stokKodu}`} className="bg-amber-50/40 text-[11px]">
                                    <td className="border border-gray-200" />
                                    <td className="border border-gray-200 pl-7 pr-2 py-0.5 whitespace-nowrap" title={u.stokAdi || undefined}>
                                      <span className="font-mono text-gray-700">{u.stokKodu}</span>
                                    </td>
                                    <td className="border border-gray-200 px-2 py-0.5 text-right tabular-nums text-gray-600">{u.satis || ''}</td>
                                    <td className="border border-gray-200 px-2 py-0.5 text-right tabular-nums text-gray-600">{d.stokVar ? u.bekleyen : '—'}</td>
                                    <td className={clsx('border border-gray-200 px-2 py-0.5 text-right tabular-nums',
                                      d.stokVar && u.kalan < 0 ? 'text-red-600' : 'text-gray-700')}>{d.stokVar ? u.kalan : '—'}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-brand-50 font-semibold text-gray-800">
                            <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-500">Σ</td>
                            <td className="border border-gray-200 px-3 py-1.5 whitespace-nowrap">
                              Toplam <span className="font-normal text-gray-500">({c.subeler.length} şube{stokluSube > 0 ? `, ${stokluSube} stoklu` : ''})</span>
                            </td>
                            <td className="border border-gray-200 px-2 py-1.5 text-right tabular-nums">{topSatis.toLocaleString('tr-TR')}</td>
                            <td className="border border-gray-200 px-2 py-1.5 text-right tabular-nums">{stokluSube > 0 ? topBekleyen.toLocaleString('tr-TR') : '—'}</td>
                            <td className="border border-gray-200 px-2 py-1.5 text-right tabular-nums">{stokluSube > 0 ? topKalan.toLocaleString('tr-TR') : '—'}</td>
                          </tr>
                          {stokluSube > 0 && (() => {
                            const oran = topSatis > 0 ? topKalan / topSatis : null
                            return (
                              <tr className="bg-brand-50 font-semibold text-gray-800">
                                <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-500">%</td>
                                <td colSpan={3} className="border border-gray-200 px-3 py-1.5 whitespace-nowrap"
                                  title="Kalan toplamı ÷ Satış toplamı. 3,00 üstü kırmızı (stok, satışın 3 katından fazla), 3,00 ve altı yeşil.">
                                  Kalan / Satış oranı
                                </td>
                                <td className={clsx('border border-gray-200 px-2 py-1.5 text-right tabular-nums',
                                  oran === null ? 'text-gray-400' : oran > 3 ? 'text-red-600' : 'text-green-600')}>
                                  {oran === null ? '—' : oran.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })()}
                        </tfoot>
                      </table>
                    )
                  })}
                </div>
              </div>
            )}
            {isAdmin && (sgGorunmeyen.length > 0 || elleAtamalar.length > 0 || atamaHata) && (
              <details className="mt-3 mx-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <summary className="cursor-pointer font-medium">
                  Tabloda görünmeyen şubeler ({sgGorunmeyen.length}){elleAtamalar.length > 0 ? ` · elle atanan ${elleAtamalar.length}` : ''} — yalnızca yönetici
                </summary>
                <p className="mt-1 text-amber-800/80">
                  Şubeler B2B&apos;deki merch kayıtlarındaki süpervizör / Jr ile kolonlara yerleşir; merch personeli olmayan şubeler
                  B2B raporlarına düşmediği için görünmez. Buradan süpervizör (ve istenirse Jr) atayın — Şube Takibi,
                  görev penceresi ve v2 Şubelerim&apos;de geçerli olur.
                </p>
                {atamaHata && <p className="mt-1 text-red-700">{atamaHata}</p>}
                <table className="mt-1 w-full">
                  <tbody>
                    {sgGorunmeyen.map((x, i) => {
                      const sec = atamaSecim[x.subeKod] ?? { sup: '', jr: '' }
                      const supP = visibleSups.find(p => p.full_name === sec.sup)
                      const jrSecenek = supP ? jrsOf(supP.id) : visibleJrs
                      return (
                        <tr key={i} className="border-t border-amber-100 align-middle">
                          <td className="py-1 pr-3 whitespace-nowrap">{cariSubeKisa(x.cariAdi, x.subeAdi)}</td>
                          <td className="py-1 pr-3 text-amber-800/80">{x.neden}</td>
                          <td className="py-1 whitespace-nowrap">
                            {x.subeKod ? (
                              <span className="inline-flex items-center gap-1">
                                <select value={sec.sup} onChange={e => setAtamaSecim(m => ({ ...m, [x.subeKod]: { sup: e.target.value, jr: '' } }))}
                                  className="rounded border border-amber-300 bg-white px-1 py-0.5 text-[11px]">
                                  <option value="">Süpervizör…</option>
                                  {visibleSups.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
                                </select>
                                <select value={sec.jr} onChange={e => setAtamaSecim(m => ({ ...m, [x.subeKod]: { ...sec, jr: e.target.value } }))}
                                  className="rounded border border-amber-300 bg-white px-1 py-0.5 text-[11px]">
                                  <option value="">Jr (yok)</option>
                                  {jrSecenek.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
                                </select>
                                <button onClick={() => subeAta(x)} disabled={!sec.sup && !sec.jr}
                                  className="rounded bg-brand-500 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-40">Ata</button>
                              </span>
                            ) : <span className="text-amber-800/60">şube kodu yok</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {elleAtamalar.length > 0 && (
                  <div className="mt-2 border-t border-amber-200 pt-1">
                    <p className="font-medium">Elle atanan şubeler</p>
                    <ul>
                      {elleAtamalar.map(a => (
                        <li key={a.sube_kod} className="flex items-center gap-2 py-0.5">
                          <span className="flex-1">{cariSubeKisa(a.cari_adi ?? '', a.sube_adi ?? '')} → {[a.sup_adi, a.jr_adi].filter(Boolean).join(' / ')}</span>
                          <button onClick={() => atamaKaldir(a.sube_kod)} className="text-red-600 hover:underline">kaldır</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            )}
            <SayfaParametreleri
              visible={isAdmin}
              baslik="Sellout ▸ Şube Takibi"
              aciklama="Seçili dönemde hiç satış girmemiş (adet 0) şubelerin, sorumlu kişiye göre kolonlanmış takibi. Tamamen otomatik; elle giriş yoktur."
              parametreler={[
                { label: 'Dönem', value: `Üstteki "Dönem" seçimi (şu an: ${donemLabel(donem)}). Satışsızlık bu döneme göre hesaplanır.` },
                { label: 'Atanmış şube evreni', value: '/api/merch-detay (export_merch_detay.php) — her şubenin sup/jr/bsy/cari ataması buradan gelir.' },
                { label: 'Satış verisi', value: '/api/sellout (export_merch_satis.php) — seçili dönemde her şubenin satılan_adet toplamı. Satış sütununda gösterilir.' },
                { label: 'Stok (Bekleyen / Kalan)', value: 'Yönetici "Stok yükle" ile şube + ürün bazında stok raporu yükler (milat tarihiyle). Bekleyen: rapordaki değer aynen. Kalan = milat stoğu + teslim edilmemiş sevkler ("Sevk yükle"; yeni sayımda "teslim edildi" işaretlenene kadar) − milattan sonraki satışlar. Şube adına tıklayınca ürün satırları açılır.' },
                { label: 'Sıralama', value: 'Sorumlu kişinin TÜM şubeleri listelenir, satış adedine göre büyükten küçüğe (satış girmeyenler = 0 en altta), eşitlikte cari/şube adına göre.' },
                { label: 'Başlık sayıları', value: 'Her kolon başlığında: toplam şube · kaçı satışlı (adet>0) · kaçı girmeyen (adet 0).' },
                { label: 'Görünürlük', value: 'Admin: tüm süpervizörler (her biri bir kolon). Süpervizör: kendi şubeleri. Jr. Süpervizör: kendi şubeleri. BSY: kendine bağlı carilerin şubeleri (cari başına kolon).' },
                { label: 'Eşleştirme', value: 'İsimler normalizeName ile eşleşir (Türkçe harf + " SV" eki toleranslı); BSY, profil adından BSY koduna çevrilerek merch-detay bsy_kod ile eşleşir.' },
              ]}
            />
          </div>
        )}

        {/* ── Özel Uygulama Takip (EKSTRA Prim) ── */}
        {!selloutLoading && subTab === 'ozel' && (
          <div className="p-2">
            <SayfaParametreleri
              visible={isAdmin}
              baslik="Sellout ▸ Özel Uygulama Takip (EKSTRA Prim)"
              aciklama="Seçili dönemde, tanımlı ürün gruplarından şube bazında eşik ve üzeri satış yapan şubelerin çift prim takibi."
              parametreler={[
                { label: 'Dönem', value: `Üstteki "Dönem" seçimi (şu an: ${donemLabel(donem)}). Satışlar bu döneme göre süzülür.` },
                { label: 'Kapsam', value: 'Yalnızca Bayi Merch satışları sayılır; Çetinler Merch satışları dahil edilmez.' },
                { label: 'Gruplama', value: 'Şube bazında (Cari + Şube). Her şube için her grubun satış adedi ayrı toplanır.' },
                { label: 'Gruplar & eşikler', value: getOzelGruplar(donem).map(g => `${g.label} (${g.codes.join(', ')}) ≥ ${g.hedef}`).join(' · ') },
                { label: 'Gerçekleşen', value: 'Sellout satış verisinden (/api/sellout) o şube + gruba ait satılan_adet toplamı.' },
                { label: 'Durum', value: 'Gerçekleşen ≥ grup eşiği ise "Çift Prim" hak edilir; değilse "kalan" adet gösterilir.' },
                { label: 'Görünürlük', value: 'Admin tümü · Süpervizör kendi + Jr şubeleri · Jr kendi şubeleri (merch-detay sup_adi/jr_adi eşleşmesi).' },
              ]}
            />
            {/* Bilgi bandı */}
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-emerald-800">🚀 EKSTRA Prim Uygulaması</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">{donemLabel(donem)}</span>
              </div>
              <p className="text-[11px] text-emerald-900/80 leading-snug">
                {donemLabel(donem)} döneminde, aşağıdaki ürün gruplarından <b>ŞUBE BAZINDA</b> belirtilen adet
                ve üzeri satışlara <b>ÇİFT PRİM</b> uygulanır
                {' '}(<b>yalnızca Bayi Merch</b>; Çetinler Merch satışları dahil değildir).
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {getOzelGruplar(donem).map(g => (
                  <li key={g.key} className="text-[11px] text-emerald-900/80 leading-snug">
                    <b>{g.label}</b> ({g.codes.join(', ')}) — <b>{g.hedef} adet ve üzeri</b>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] font-semibold text-emerald-800 mt-1.5">
                Çift prim hakkeden şube-grup: {ozelUlasan} / {ozelFiltered.length}
              </p>
            </div>

            {/* Cari / Şube filtreleri */}
            {ozelRows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <select
                  value={ozelCari}
                  onChange={e => { setOzelCari(e.target.value); setOzelSube('') }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-brand-400 max-w-[280px]"
                >
                  <option value="">Cari (Tümü)</option>
                  {ozelCariOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={ozelSube}
                  onChange={e => setOzelSube(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-brand-400 max-w-[200px]"
                >
                  <option value="">Şube (Tümü)</option>
                  {ozelSubeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(ozelCari || ozelSube) && (
                  <button
                    onClick={() => { setOzelCari(''); setOzelSube('') }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >Sıfırla</button>
                )}
                <button
                  onClick={exportOzelExcel}
                  disabled={ozelFiltered.length === 0}
                  className="ml-auto flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Görünen kayıtları Excel'e aktar"
                >
                  <FileDown size={13} /> Excel'e Aktar
                </button>
                <span className="text-[10px] text-gray-400">{ozelFiltered.length} kayıt</span>
              </div>
            )}

            {ozelRows.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-gray-400">
                Kapsamınızda henüz bu uygulamaya dahil ürün satışı bulunmuyor.
              </div>
            ) : ozelFiltered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-gray-400">
                Seçili filtreye uygun kayıt yok.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="text-xs border-collapse w-full bg-white">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-800 text-white">
                      <th className="px-3 py-2.5 text-left font-semibold min-w-[220px]">Cari</th>
                      <th className="px-3 py-2.5 text-left font-semibold min-w-[120px]">Şube</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Grup</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Grup Hedef</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Gerçekleşen</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Kalan</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ozelFiltered.map((r, i) => (
                      <tr
                        key={`${r.cari}|${r.sube}|${r.grup}`}
                        className={clsx(
                          'border-t border-gray-100',
                          r.ulasti ? 'bg-emerald-50' : (r.kalan <= 2 ? 'bg-amber-50' : (i % 2 ? 'bg-gray-50/50' : 'bg-white'))
                        )}
                      >
                        <td className="px-3 py-2 text-gray-800">{r.cari}</td>
                        <td className="px-3 py-2 text-gray-600">{r.sube}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={clsx(
                            'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                            r.renk
                          )}>{r.grup}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.hedef}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">{r.gerc}</td>
                        <td className={clsx('px-3 py-2 text-right tabular-nums font-semibold', r.kalan === 0 ? 'text-emerald-600' : (r.kalan <= 2 ? 'text-amber-600' : 'text-gray-500'))}>
                          {r.kalan}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.ulasti
                            ? <span className="text-[10px] font-bold text-emerald-700">✓ Çift Prim</span>
                            : <span className="text-[10px] text-gray-400">{r.kalan} kaldı</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0">
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-gray-700">Alt Toplam</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                        {ozelFiltered.reduce((s, r) => s + r.gerc, 0).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                        {ozelFiltered.reduce((s, r) => s + r.kalan, 0).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Target entry modals ── */}
      {targetModal === 'sup' && (
        <TargetEntryModal
          title="Süpervizör Hedefleri"
          rows={supTargetRows}
          groups={SELLOUT_GROUPS}
          initialValues={getProfileHedef}
          donem={donem}
          enteredBy={currentProfile.id}
          onSave={handleSave}
          onClose={() => setTargetModal(null)}
          saving={saving}
        />
      )}
      {targetModal === 'jr' && (
        <TargetEntryModal
          title="Jr. Süpervizör Hedefleri"
          rows={jrTargetRows}
          groups={SELLOUT_GROUPS}
          initialValues={getProfileHedef}
          donem={donem}
          enteredBy={currentProfile.id}
          onSave={handleSave}
          onClose={() => setTargetModal(null)}
          saving={saving}
        />
      )}
      {targetModal === 'merch' && (
        <TargetEntryModal
          title="Merch Hedefleri"
          rows={merchTargetRows}
          groups={SELLOUT_GROUPS}
          initialValues={getMerchHedef}
          donem={donem}
          enteredBy={currentProfile.id}
          onSave={handleSave}
          onClose={() => setTargetModal(null)}
          saving={saving}
          showDestekCol={true}
          destekInitial={(key) => destekFlags[key] ?? false}
          gizleInitial={(key) => gizleFlags[key] ?? false}
          onSaveDestek={async (flags) => {
            await authFetch('/api/merch-destek-flag', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ donem, flags }),
            })
            const dmap: Record<string, boolean> = {}
            const gmap: Record<string, boolean> = {}
            flags.forEach(f => { dmap[f.merch_name] = f.destek_var; gmap[f.merch_name] = f.gizle })
            setDestekFlags(prev => ({ ...prev, ...dmap }))
            setGizleFlags(prev => ({ ...prev, ...gmap }))
          }}
        />
      )}
    </div>
  )
}

// ─── Generic Sellout Table ─────────────────────────────────────
interface GrupCell { h: number; v: number; p: number; prim?: number }
interface TableRowData {
  label: string
  sublabel?: string
  sublabel2?: string   // cari/şube satırı
  color?: string       // satır başındaki renk nokta
  labelColor?: string  // label text rengi
  groups: GrupCell[]
  tH: number; tV: number; tP: number
  tPrim?: number
}
interface FooterData {
  groups: GrupCell[]
  tH: number; tV: number; tP: number; tPrim?: number
}

function SelloutTable({
  rows, footer, showPrim, kategoriPrimi, showRowNo,
}: {
  rows: TableRowData[]
  footer?: FooterData
  showPrim: boolean
  kategoriPrimi?: Record<string, number>
  showRowNo?: boolean
}) {
  const COLS_PER_GROUP = showPrim ? 4 : 3  // Hed | Gerç | % | [Prim]
  // Satır no kolonu varsa "Kişi" sütunu 2.5rem (left-10) sağa kaydırılır
  const kisiLeft = showRowNo ? 'left-10' : 'left-0'

  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">Veri yok</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="text-xs border-collapse w-full tabular-nums">
        {/* ─ Tüm header satırları tek <thead> içinde → sticky top-0 çalışır ─ */}
        <thead className="sticky top-0 z-20">
          {/* Row 1: Kategori Primi */}
          {showPrim && kategoriPrimi && (
            <tr className="bg-gray-50 border-b border-gray-200">
              {showRowNo && <th className="sticky left-0 z-30 bg-gray-50 border-r border-gray-200 px-2 py-1 w-10" />}
              <th className={clsx('sticky z-30 bg-gray-50 border-r border-gray-200 px-2 py-1', kisiLeft)} />
              {SELLOUT_GROUPS.map(g => (
                <th
                  key={g}
                  colSpan={COLS_PER_GROUP}
                  className="text-center px-1 py-1 text-[10px] text-gray-400 font-medium border-r border-gray-200 whitespace-nowrap"
                >
                  Kat. Primi: ₺{(kategoriPrimi[g] ?? 0).toLocaleString('tr-TR')}
                </th>
              ))}
              <th colSpan={showPrim ? 4 : 3} className="text-center px-1 py-1 text-[11px] font-bold text-gray-600 border-l border-gray-200 whitespace-nowrap">
                Kat. Primi: ₺{SELLOUT_GROUPS.reduce((s, g) => s + (kategoriPrimi[g] ?? 0), 0).toLocaleString('tr-TR')}
              </th>
            </tr>
          )}
          {/* Row 2: Group names */}
          <tr className="bg-brand-700 text-white">
            {showRowNo && <th className="sticky left-0 z-30 bg-brand-700 text-center px-2 py-2 border-r border-brand-600 w-10">#</th>}
            <th className={clsx('sticky z-30 bg-brand-700 text-left px-2 py-2 border-r border-brand-600', kisiLeft)}>Kişi</th>
            {SELLOUT_GROUPS.map(g => (
              <th key={g} colSpan={COLS_PER_GROUP} className="text-center px-1 py-1.5 border-r border-brand-600 leading-tight">
                {g}
              </th>
            ))}
            <th colSpan={showPrim ? 4 : 3} className="text-center px-1 py-1.5 leading-tight">Toplam</th>
          </tr>
          {/* Row 3: Column labels */}
          <tr className="bg-brand-600/80 text-white text-[10px]">
            {showRowNo && <th className="sticky left-0 z-30 bg-brand-600 border-r border-brand-500 px-2 py-1 w-10" />}
            <th className={clsx('sticky z-30 bg-brand-600 border-r border-brand-500 px-2 py-1', kisiLeft)} />
            {SELLOUT_GROUPS.map(g => (
              <React.Fragment key={`header-${g}`}>
                <th className="text-center px-1 py-1 border-r border-brand-500">Hed.</th>
                <th className="text-center px-1 py-1 border-r border-brand-500">Gerç.</th>
                <th className="text-center px-1 py-1 border-r border-brand-500">%</th>
                {showPrim && <th className="text-center px-1 py-1 border-r border-brand-500">Prim</th>}
              </React.Fragment>
            ))}
            <th className="text-center px-1 py-1 border-r border-brand-500">Hed.</th>
            <th className="text-center px-1 py-1 border-r border-brand-500">Gerç.</th>
            <th className="text-center px-1 py-1 border-r border-brand-500">%</th>
            {showPrim && <th className="text-center px-1 py-1">Prim</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={clsx('border-b border-gray-100 hover:bg-gray-50', i % 2 === 1 && 'bg-gray-50/50')}>
              {showRowNo && (
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-2 py-2 text-center text-gray-400 tabular-nums w-10">{i + 1}</td>
              )}
              {/* Name */}
              <td className={clsx('sticky z-10 bg-white border-r border-gray-200 px-2 py-2', kisiLeft)}>
                <div className="flex items-center gap-2">
                  {r.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  )}
                  <div>
                    <p
                      className="font-medium whitespace-nowrap"
                      style={{ color: r.labelColor || '#1f2937' }}
                    >
                      {r.label}
                    </p>
                    {r.sublabel  && <p className="text-[10px] text-gray-400 leading-tight">{r.sublabel}</p>}
                    {r.sublabel2 && <p className="text-[8px] text-gray-400 leading-tight">{r.sublabel2}</p>}
                  </div>
                </div>
              </td>

              {/* Group cells */}
              {r.groups.map((g, gi) => (
                <React.Fragment key={`${i}-${gi}`}>
                  <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-100 text-gray-600">{g.h ? g.h.toLocaleString('tr-TR') : '—'}</td>
                  <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-100 font-semibold text-gray-800">{g.v.toLocaleString('tr-TR')}</td>
                  <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-100">
                    {g.h > 0 ? <PctBadge val={g.p} /> : <span className="text-gray-300">—</span>}
                  </td>
                  {showPrim && (
                    <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-100 text-gray-700">
                      {(g.prim ?? 0) > 0 ? `₺${fmtCur(g.prim!)}` : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                </React.Fragment>
              ))}

              {/* Totals */}
              <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-200 text-gray-600 font-medium">{r.tH ? r.tH.toLocaleString('tr-TR') : '—'}</td>
              <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-200 font-bold text-gray-800">{r.tV.toLocaleString('tr-TR')}</td>
              <td className="text-center px-1.5 py-1.5 whitespace-nowrap border-r border-gray-200">
                {r.tH > 0 ? <PctBadge val={r.tP} /> : <span className="text-gray-300">—</span>}
              </td>
              {showPrim && (
                <td className="text-center px-1.5 py-1.5 whitespace-nowrap text-brand-700 font-semibold">
                  {(r.tPrim ?? 0) > 0 ? `₺${fmtCur(r.tPrim!)}` : <span className="text-gray-300">—</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>

        {/* Footer totals */}
        {footer && (
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              {showRowNo && <td className="sticky left-0 z-10 bg-gray-100 border-r border-gray-200 px-2 py-2 w-10" />}
              <td className={clsx('sticky z-10 bg-gray-100 border-r border-gray-200 px-2 py-2 text-gray-700 text-xs', kisiLeft)}>TOPLAM</td>
              {footer.groups.map((g, gi) => (
                <React.Fragment key={`f-${gi}`}>
                  <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200 text-gray-600">{g.h ? g.h.toLocaleString('tr-TR') : '—'}</td>
                  <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200 text-gray-800">{g.v.toLocaleString('tr-TR')}</td>
                  <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200">
                    {g.h > 0 ? <PctBadge val={g.p} /> : <span className="text-gray-300">—</span>}
                  </td>
                  {showPrim && (
                    <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200 text-brand-700">
                      {(g.prim ?? 0) > 0 ? `₺${fmtCur(g.prim!)}` : '—'}
                    </td>
                  )}
                </React.Fragment>
              ))}
              <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200 text-gray-700">{footer.tH ? footer.tH.toLocaleString('tr-TR') : '—'}</td>
              <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200 text-gray-800">{footer.tV.toLocaleString('tr-TR')}</td>
              <td className="text-center px-1.5 py-2 whitespace-nowrap border-r border-gray-200">
                {footer.tH > 0 ? <PctBadge val={footer.tP} /> : '—'}
              </td>
              {showPrim && (
                <td className="text-center px-1.5 py-2 whitespace-nowrap text-brand-700">
                  {(footer.tPrim ?? 0) > 0 ? `₺${fmtCur(footer.tPrim!)}` : '—'}
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
