'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { RefreshCw, X, Save, Target, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

import { useSellout } from '@/hooks/useSellout'
import { useSelloutTargets, ProfileTarget, MerchTarget } from '@/hooks/useSelloutTargets'
import {
  SELLOUT_GROUPS, GRUP_NORMALIZE,
  PRIM_SUP, PRIM_JR, PRIM_MERCH,
  calcPrim, namesMatch, normalizeName,
  fmtCur, currentDonem, donemOptions, donemLabel,
} from '@/lib/sellout'
import { Profile } from '@/lib/supabase'

type SubTab = 'sup' | 'jr' | 'merch' | 'top20' | 'satislar'

// ─── Top-30 yardımcı tipler ───
interface Top20Row { cariIsim: string; subeAdi: string; adet: number }

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
  return [...map.values()].sort((a, b) => b.adet - a.adet)
}

function Top20Table({
  title, subtitle, data, colorMap,
}: {
  title: string
  subtitle?: string
  data: Top20Row[]
  colorMap: Map<string, string>
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
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="px-2 py-1.5 text-center text-gray-400 font-medium text-[10px]">{i + 1}</td>
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
  return hedef > 0 ? Math.round((gerc / hedef) * 100) : 0
}

function PctBadge({ val }: { val: number }) {
  return (
    <span className={clsx(
      'inline-block px-1 py-0.5 rounded text-[10px] font-bold whitespace-nowrap',
      val >= 100 ? 'bg-green-200 text-green-900'
        : val >= 80  ? 'bg-green-100 text-green-800'
        : val >= 60  ? 'bg-yellow-100 text-yellow-800'
        :              'bg-red-100   text-red-700'
    )}>%{val}</span>
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
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    rows.forEach(r => groups.forEach(g => {
      init[`${r.key}||${g}`] = initialValues(r.key, g)
    }))
    return init
  })

  const set = (key: string, grup: string, val: number) =>
    setValues(p => ({ ...p, [`${key}||${grup}`]: val }))

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

export function SelloutView({ currentProfile, team, visibleIds, active }: Props) {
  const [donem, setDonem]         = useState(currentDonem)
  const [subTab, setSubTab]       = useState<SubTab>(() =>
    currentProfile.role === 'bsy' ? 'top20'
    : currentProfile.role === 'jr' ? 'jr'
    : 'sup'
  )
  const [targetModal, setTargetModal] = useState<SubTab | null>(null)
  const [merchSearch, setMerchSearch] = useState('')
  const [adetPrimData, setAdetPrimData] = useState<{ stokKodu: string; bayiMerch: number | null; kosulluDestek: number | null; kategori: string | null }[]>([])
  const [merchHedefData, setMerchHedefData] = useState<{ merch_name: string; grup: string; hedef: number }[]>([])

  const isAdmin = currentProfile.role === 'admin'
  const isSup   = currentProfile.role === 'sup'
  const isJr    = currentProfile.role === 'jr'
  const isBsy   = currentProfile.role === 'bsy'

  const {
    rows: allRows, loading: selloutLoading, fetchedAt, reload: reloadSellout,
  } = useSellout(active)

  // Adet prim verilerini fetch et
  useEffect(() => {
    if (!active) return
    const [yil, ay] = donem.split('-')
    fetch(`/api/adet-prim?yil=${yil}&ay=${ay}`)
      .then(r => r.json())
      .then(d => setAdetPrimData(d.rows || []))
      .catch(() => setAdetPrimData([]))
  }, [active, donem])

  // Merch hedef verilerini fetch et
  useEffect(() => {
    if (!active) return
    fetch(`/api/sellout-targets?donem=${donem}`)
      .then(r => r.json())
      .then(d => setMerchHedefData(d.merch_targets || []))
      .catch(() => setMerchHedefData([]))
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
  const visibleSups = useMemo(
    () => team.filter(p => p.role === 'sup' && visibleIds.includes(p.id)),
    [team, visibleIds]
  )
  const visibleJrs = useMemo(
    () => team.filter(p => p.role === 'jr' && visibleIds.includes(p.id)),
    [team, visibleIds]
  )
  const jrsOf = useCallback(
    (supId: string) => visibleJrs.filter(j => j.manager_id === supId),
    [visibleJrs]
  )

  // ── Gerç aggregation ────────────────────────────────────────
  const getGerc = useCallback(
    (supApiNames: string[], grup: string): number => {
      return periodRows
        .filter(r => {
          const normApi = normalizeName(r.supervisor_adi)
          return supApiNames.some(n => normalizeName(n) === normApi)
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

  // ── Filtered period rows (sadece bağlı supervisorlar) ──
  const filteredPeriodRows = useMemo(() => {
    return periodRows.filter(r => {
      const normApi = normalizeName(r.supervisor_adi || '')
      return allSupNames.some(n => normalizeName(n) === normApi)
    })
  }, [periodRows, allSupNames])

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

  // ── Merch kategori performans hesapla ──
  const merchKategoriPerformans = useMemo(() => {
    // merch_name → { kategori → { hedef, gerçekleşen, oran } }
    const map = new Map<string, Map<string, { hedef: number; gerceklesen: number; oran: number }>>()

    // Hedefleri ekle
    merchHedefData.forEach(h => {
      const merchKey = h.merch_name.toLowerCase()
      if (!map.has(merchKey)) {
        map.set(merchKey, new Map())
      }
      map.get(merchKey)!.set(h.grup, { hedef: h.hedef, gerceklesen: 0, oran: 0 })
    })

    // Gerçekleşenleri topla (sadece Çetinler Merch satışları)
    periodRows.forEach(r => {
      if (r.merch_tipi !== 'Çetinler Merch' || !r.merch_personel || !r.grup_aciklama) return
      const merchKey = r.merch_personel.toLowerCase()
      if (!map.has(merchKey)) {
        map.set(merchKey, new Map())
      }
      const kategoriMap = map.get(merchKey)!
      if (!kategoriMap.has(r.grup_aciklama)) {
        kategoriMap.set(r.grup_aciklama, { hedef: 0, gerceklesen: 0, oran: 0 })
      }
      const existing = kategoriMap.get(r.grup_aciklama)!
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

  // Filtre: MERCH_TIPI === 'Çetinler Merch' olan satırlardan unique kişi listesi
  // Sadece seçili dönemde satışı olan kişiler (toplam satış > 0)
  const uniqueMerch = useMemo(() => {
    const map = new Map<string, { supApiName: string; cariIsim: string; subeAdi: string; totalSales: number }>()
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
    return Array.from(map.entries())
      .filter(([_, v]) => v.totalSales > 0) // Sadece satışı olanlar
      .map(([name, v]) => ({ name, supApiName: v.supApiName, cariIsim: v.cariIsim, subeAdi: v.subeAdi }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [periodRows])

  // Merch visible to current user: supervisor_adi'si mevcut kullanıcının görebileceği
  // bir süpervizör/jr. ismiyle eşleşenler
  const myVisibleSupNames = useMemo(() => {
    if (isAdmin) return allSupNames
    if (isSup) {
      const myJrs = jrsOf(currentProfile.id).map(j => j.full_name)
      return [currentProfile.full_name, ...myJrs]
    }
    if (isJr) return [currentProfile.full_name]
    return []
  }, [isAdmin, isSup, isJr, currentProfile, allSupNames, jrsOf])

  const visibleMerch = useMemo(
    () => uniqueMerch.filter(m =>
      !m.supApiName || myVisibleSupNames.some(n => namesMatch(n, m.supApiName))
    ),
    [uniqueMerch, myVisibleSupNames]
  )

  // ── Sup table data ───────────────────────────────────────────
  const supRows = useMemo(() => {
    const sups = isAdmin ? visibleSups : visibleSups.filter(s => s.id === currentProfile.id)
    return sups.map(sup => {
      const jrs      = jrsOf(sup.id)
      const apiNames = [sup.full_name, ...jrs.map(j => j.full_name)]
      const groups   = SELLOUT_GROUPS.map(g => {
        const h = getProfileHedef(sup.id, g)
        const v = getGerc(apiNames, g)
        const p = pct(h, v)
        const prim = calcPrim(h, v, PRIM_SUP[g])
        return { g, h, v, p, prim }
      })
      const tH = groups.reduce((s, x) => s + x.h, 0)
      const tV = groups.reduce((s, x) => s + x.v, 0)
      const tP = pct(tH, tV)
      const tPrim = groups.reduce((s, x) => s + x.prim, 0)
      return { profile: sup, groups, tH, tV, tP, tPrim }
    })
  }, [visibleSups, isAdmin, currentProfile.id, jrsOf, getProfileHedef, getGerc])

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
    const jrs = (isAdmin || isSup) ? visibleJrs : visibleJrs.filter(j => j.id === currentProfile.id)
    return jrs.map(jr => {
      const sup = team.find(p => p.id === jr.manager_id)
      const groups = SELLOUT_GROUPS.map(g => {
        const h = getProfileHedef(jr.id, g)
        const v = getGerc([jr.full_name], g)
        const p = pct(h, v)
        const prim = calcPrim(h, v, PRIM_JR[g])
        return { g, h, v, p, prim }
      })
      const tH = groups.reduce((s, x) => s + x.h, 0)
      const tV = groups.reduce((s, x) => s + x.v, 0)
      const tP = pct(tH, tV)
      const tPrim = groups.reduce((s, x) => s + x.prim, 0)
      return { profile: jr, sup, groups, tH, tV, tP, tPrim }
    })
  }, [visibleJrs, isAdmin, isSup, currentProfile.id, team, getProfileHedef, getGerc])

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
    if (!merchSearch.trim()) return visibleMerch
    const q = merchSearch.toLowerCase()
    return visibleMerch.filter(m => m.name.toLowerCase().includes(q) || m.supApiName.toLowerCase().includes(q))
  }, [visibleMerch, merchSearch])

  const merchRows = useMemo(() =>
    filteredMerch.map(m => {
      const groups = SELLOUT_GROUPS.map(g => {
        const h = getMerchHedef(m.name, g)
        const v = periodRows
          .filter(r => r.merch_personel === m.name && GRUP_NORMALIZE[r.grup_aciklama] === g)
          .reduce((s, r) => s + r.satilan_adet, 0)
        const p    = pct(h, v)
        const prim = calcPrim(h, v, PRIM_MERCH[g])
        return { g, h, v, p, prim }
      })
      const tH    = groups.reduce((s, x) => s + x.h, 0)
      const tV    = groups.reduce((s, x) => s + x.v, 0)
      const tPrim = groups.reduce((s, x) => s + x.prim, 0)
      return { name: m.name, supApiName: m.supApiName, cariIsim: m.cariIsim, subeAdi: m.subeAdi, groups, tH, tV, tP: pct(tH, tV), tPrim }
    }),
  [filteredMerch, getMerchHedef, periodRows])

  // ── Target entry rows ────────────────────────────────────────
  const supTargetRows = useMemo((): TargetRow[] =>
    (isAdmin ? visibleSups : visibleSups.filter(s => s.id === currentProfile.id))
      .map(s => ({ key: s.id, label: s.full_name, isProfile: true })),
  [visibleSups, isAdmin, currentProfile.id])

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

  // ── Which sub-tabs are visible? ───────────────────────────────
  const showSupTab  = isAdmin || isSup
  const showJrTab   = isAdmin || isSup || isJr
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
        <div className="flex-1" />
        {/* Target entry button */}
        {(isAdmin || isSup) && subTab !== 'sup' && (
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
          <SelloutTable
            rows={supRows.map(r => ({
              label: r.profile.full_name,
              sublabel: `${jrsOf(r.profile.id).length} jr.sup`,
              color: r.profile.color,
              groups: r.groups.map(g => ({ h: g.h, v: g.v, p: g.p, prim: g.prim })),
              tH: r.tH, tV: r.tV, tP: r.tP, tPrim: r.tPrim,
            }))}
            footer={{ groups: supFooter.groupTotals.map(g => ({ h: g.h, v: g.v, p: pct(g.h, g.v), prim: g.prim })), tH: supFooter.totH, tV: supFooter.totV, tP: supFooter.totP, tPrim: supFooter.totPrim }}
            showPrim
            kategoriPrimi={PRIM_SUP}
          />
        )}

        {!selloutLoading && subTab === 'jr' && showJrTab && (
          <SelloutTable
            rows={jrRows.map(r => ({
              label: r.profile.full_name,
              sublabel: r.sup?.full_name,
              color: r.profile.color,
              groups: r.groups.map(g => ({ h: g.h, v: g.v, p: g.p, prim: g.prim })),
              tH: r.tH, tV: r.tV, tP: r.tP, tPrim: r.tPrim,
            }))}
            footer={{ groups: jrFooter.groupTotals.map(g => ({ h: g.h, v: g.v, p: pct(g.h, g.v), prim: g.prim })), tH: jrFooter.totH, tV: jrFooter.totV, tP: jrFooter.totP, tPrim: jrFooter.totPrim }}
            showPrim
            kategoriPrimi={PRIM_JR}
          />
        )}

        {!selloutLoading && subTab === 'merch' && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="Merch veya Jr. Süpervizör ara…"
                value={merchSearch}
                onChange={e => setMerchSearch(e.target.value)}
                className="w-full max-w-xs text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400"
              />
              <span className="text-[10px] text-gray-400">{filteredMerch.length} merch</span>
            </div>
            <SelloutTable
              rows={merchRows.map(r => ({
                label:     r.name,
                sublabel:  r.supApiName,
                sublabel2: [r.cariIsim?.split(' ')[0], r.subeAdi].filter(Boolean).join(' / '),
                groups:    r.groups.map(g => ({ h: g.h, v: g.v, p: g.p, prim: g.prim })),
                tH: r.tH, tV: r.tV, tP: r.tP, tPrim: r.tPrim,
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
              kategoriPrimi={PRIM_MERCH}
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
                />
                <Top20Table
                  title="2 · RMS9200 Stokları"
                  subtitle="RMS9200 ile başlayan stoklarda tüm şubeler"
                  data={top20Rms}
                  colorMap={globalCariColorMap}
                />
                <Top20Table
                  title="3 · Süpürge Grubu"
                  subtitle="Kategori bazında tüm şubeler"
                  data={top20Supurge}
                  colorMap={globalCariColorMap}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Satışlar Tablosu ── */}
        {!selloutLoading && subTab === 'satislar' && (
          <div className="p-2">
            <div className="mb-3 text-[10px] text-gray-400">
              Seçilen dönem için satış kayıtları (sadece bağlı şubeler)
            </div>
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
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[110px] bg-blue-700">Bayi Merch Adet Primi</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[130px] bg-blue-800">Bayi Merch Prim Hakedişi</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[140px] bg-purple-700">Destek Per. Adet Primi</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[140px] bg-green-700">Çet. Merch Kat. Gerç. %</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[160px] bg-green-800">Çet. Merch Gerç.Oranına Göre Prim</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeriodRows.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-gray-400 text-[11px]">
                        Bu dönem için satış verisi yok
                      </td>
                    </tr>
                  ) : (
                    filteredPeriodRows.map((row, idx) => {
                      // Hesaplamalar
                      const primData = adetPrimMap.get(row.stok_kodu || '') || { bayiMerch: 0, kosulluDestek: 0, kategori: '' }
                      const satisAdedi = row.satilan_adet || 0

                      // 1. Bayi Merch Adet Primi
                      const bayiMerchPrimAdet = primData.bayiMerch

                      // 2. Bayi Merch Prim Hakedişi
                      const bayiMerchHakedis = bayiMerchPrimAdet * satisAdedi

                      // 3. Destek Personeli Adet Primi
                      const destekPrimAdet = primData.kosulluDestek

                      // 4. Çetinler Merch Kategori Gerçekleşme Oranı
                      const merchKey = (row.merch_personel || '').toLowerCase()
                      const kategori = row.grup_aciklama || ''
                      const merchKategoriData = merchKategoriPerformans.get(merchKey)?.get(kategori)
                      const cetinlerMerchGercOran = merchKategoriData?.oran || 0

                      // 5. Çetinler Merch Gerç.Oranına Göre Adet Primi
                      const cetinlerMerchPrim = (cetinlerMerchGercOran / 100) * destekPrimAdet * satisAdedi

                      return (
                        <tr
                          key={idx}
                          className={clsx(
                            'border-b border-gray-100 last:border-0',
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
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
                          <td className="px-3 py-2 text-gray-700">{row.supervisor_adi || '—'}</td>
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
                          <td className="px-3 py-2 text-right tabular-nums text-blue-700 font-medium bg-blue-50">
                            {bayiMerchPrimAdet > 0 ? `${bayiMerchPrimAdet.toLocaleString('tr-TR')} ₺` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-800 font-bold bg-blue-100">
                            {bayiMerchHakedis > 0 ? `${bayiMerchHakedis.toLocaleString('tr-TR')} ₺` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-purple-700 font-medium bg-purple-50">
                            {destekPrimAdet > 0 ? `${destekPrimAdet.toLocaleString('tr-TR')} ₺` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 font-medium bg-green-50">
                            {cetinlerMerchGercOran > 0 ? `%${cetinlerMerchGercOran.toFixed(1)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-800 font-bold bg-green-100">
                            {cetinlerMerchPrim > 0 ? `${cetinlerMerchPrim.toLocaleString('tr-TR')} ₺` : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800 text-white font-semibold">
                    <td colSpan={6} className="px-3 py-2.5 text-right">TOPLAM</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {filteredPeriodRows.reduce((sum, r) => sum + (r.satilan_adet || 0), 0).toLocaleString('tr-TR')}
                    </td>
                    <td colSpan={3} className="px-3 py-2.5 text-center text-[10px]">
                      {filteredPeriodRows.length.toLocaleString('tr-TR')} kayıt
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums bg-blue-900">—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums bg-blue-900">
                      {filteredPeriodRows.reduce((sum, r) => {
                        const prim = adetPrimMap.get(r.stok_kodu || '')?.bayiMerch || 0
                        return sum + (prim * (r.satilan_adet || 0))
                      }, 0).toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums bg-purple-900">—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums bg-green-900">—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums bg-green-900">
                      {filteredPeriodRows.reduce((sum, r) => {
                        const primData = adetPrimMap.get(r.stok_kodu || '') || { kosulluDestek: 0 }
                        const merchKey = (r.merch_personel || '').toLowerCase()
                        const kategori = r.grup_aciklama || ''
                        const oran = merchKategoriPerformans.get(merchKey)?.get(kategori)?.oran || 0
                        return sum + ((oran / 100) * primData.kosulluDestek * (r.satilan_adet || 0))
                      }, 0).toLocaleString('tr-TR')} ₺
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
  color?: string
  groups: GrupCell[]
  tH: number; tV: number; tP: number
  tPrim?: number
}
interface FooterData {
  groups: GrupCell[]
  tH: number; tV: number; tP: number; tPrim?: number
}

function SelloutTable({
  rows, footer, showPrim, kategoriPrimi,
}: {
  rows: TableRowData[]
  footer?: FooterData
  showPrim: boolean
  kategoriPrimi?: Record<string, number>
}) {
  const COLS_PER_GROUP = showPrim ? 4 : 3  // Hed | Gerç | % | [Prim]

  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">Veri yok</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="text-xs border-collapse min-w-max w-full">
        {/* ─ Tüm header satırları tek <thead> içinde → sticky top-0 çalışır ─ */}
        <thead className="sticky top-0 z-20">
          {/* Row 1: Kategori Primi */}
          {showPrim && kategoriPrimi && (
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-30 bg-gray-50 border-r border-gray-200 px-3 py-1" />
              {SELLOUT_GROUPS.map(g => (
                <th
                  key={g}
                  colSpan={COLS_PER_GROUP}
                  className="text-center px-2 py-1 text-[10px] text-gray-400 font-medium border-r border-gray-200"
                >
                  Kat. Primi: ₺{(kategoriPrimi[g] ?? 0).toLocaleString('tr-TR')}
                </th>
              ))}
              <th colSpan={showPrim ? 4 : 3} className="text-center px-2 py-1 text-[11px] font-bold text-gray-600 border-l border-gray-200">
                Kat. Primi: ₺{SELLOUT_GROUPS.reduce((s, g) => s + (kategoriPrimi[g] ?? 0), 0).toLocaleString('tr-TR')}
              </th>
            </tr>
          )}
          {/* Row 2: Group names */}
          <tr className="bg-brand-700 text-white">
            <th className="sticky left-0 z-30 bg-brand-700 text-left px-3 py-2 border-r border-brand-600 min-w-[140px]">Kişi</th>
            {SELLOUT_GROUPS.map(g => (
              <th key={g} colSpan={COLS_PER_GROUP} className="text-center px-2 py-2 border-r border-brand-600 whitespace-nowrap">
                {g}
              </th>
            ))}
            <th colSpan={showPrim ? 4 : 3} className="text-center px-2 py-2 whitespace-nowrap">Toplam</th>
          </tr>
          {/* Row 3: Column labels */}
          <tr className="bg-brand-600/80 text-white text-[10px]">
            <th className="sticky left-0 z-30 bg-brand-600 border-r border-brand-500 px-3 py-1" />
            {SELLOUT_GROUPS.map(g => (
              <React.Fragment key={`header-${g}`}>
                <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[45px]">Hed.</th>
                <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[45px]">Gerç.</th>
                <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[40px]">%</th>
                {showPrim && <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[60px]">Prim</th>}
              </React.Fragment>
            ))}
            <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[45px]">Hed.</th>
            <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[45px]">Gerç.</th>
            <th className="text-center px-2 py-1 border-r border-brand-500 min-w-[40px]">%</th>
            {showPrim && <th className="text-center px-2 py-1 min-w-[70px]">Prim</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={clsx('border-b border-gray-100 hover:bg-gray-50', i % 2 === 1 && 'bg-gray-50/50')}>
              {/* Name */}
              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  {r.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  )}
                  <div>
                    <p className="font-medium text-gray-800 whitespace-nowrap">{r.label}</p>
                    {r.sublabel  && <p className="text-[10px] text-gray-400 leading-tight">{r.sublabel}</p>}
                    {r.sublabel2 && <p className="text-[8px] text-gray-400 leading-tight">{r.sublabel2}</p>}
                  </div>
                </div>
              </td>

              {/* Group cells */}
              {r.groups.map((g, gi) => (
                <React.Fragment key={`${i}-${gi}`}>
                  <td className="text-center px-2 py-1.5 border-r border-gray-100 text-gray-600">{g.h ? g.h.toLocaleString('tr-TR') : '—'}</td>
                  <td className="text-center px-2 py-1.5 border-r border-gray-100 font-semibold text-gray-800">{g.v.toLocaleString('tr-TR')}</td>
                  <td className="text-center px-2 py-1.5 border-r border-gray-100">
                    {g.h > 0 ? <PctBadge val={g.p} /> : <span className="text-gray-300">—</span>}
                  </td>
                  {showPrim && (
                    <td className="text-center px-2 py-1.5 border-r border-gray-100 text-gray-700">
                      {(g.prim ?? 0) > 0 ? `₺${fmtCur(g.prim!)}` : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                </React.Fragment>
              ))}

              {/* Totals */}
              <td className="text-center px-2 py-1.5 border-r border-gray-200 text-gray-600 font-medium">{r.tH ? r.tH.toLocaleString('tr-TR') : '—'}</td>
              <td className="text-center px-2 py-1.5 border-r border-gray-200 font-bold text-gray-800">{r.tV.toLocaleString('tr-TR')}</td>
              <td className="text-center px-2 py-1.5 border-r border-gray-200">
                {r.tH > 0 ? <PctBadge val={r.tP} /> : <span className="text-gray-300">—</span>}
              </td>
              {showPrim && (
                <td className="text-center px-2 py-1.5 text-brand-700 font-semibold">
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
              <td className="sticky left-0 z-10 bg-gray-100 border-r border-gray-200 px-3 py-2 text-gray-700 text-xs">TOPLAM</td>
              {footer.groups.map((g, gi) => (
                <React.Fragment key={`f-${gi}`}>
                  <td className="text-center px-2 py-2 border-r border-gray-200 text-gray-600">{g.h ? g.h.toLocaleString('tr-TR') : '—'}</td>
                  <td className="text-center px-2 py-2 border-r border-gray-200 text-gray-800">{g.v.toLocaleString('tr-TR')}</td>
                  <td className="text-center px-2 py-2 border-r border-gray-200">
                    {g.h > 0 ? <PctBadge val={g.p} /> : <span className="text-gray-300">—</span>}
                  </td>
                  {showPrim && (
                    <td className="text-center px-2 py-2 border-r border-gray-200 text-brand-700">
                      {(g.prim ?? 0) > 0 ? `₺${fmtCur(g.prim!)}` : '—'}
                    </td>
                  )}
                </React.Fragment>
              ))}
              <td className="text-center px-2 py-2 border-r border-gray-200 text-gray-700">{footer.tH ? footer.tH.toLocaleString('tr-TR') : '—'}</td>
              <td className="text-center px-2 py-2 border-r border-gray-200 text-gray-800">{footer.tV.toLocaleString('tr-TR')}</td>
              <td className="text-center px-2 py-2 border-r border-gray-200">
                {footer.tH > 0 ? <PctBadge val={footer.tP} /> : '—'}
              </td>
              {showPrim && (
                <td className="text-center px-2 py-2 text-brand-700">
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
