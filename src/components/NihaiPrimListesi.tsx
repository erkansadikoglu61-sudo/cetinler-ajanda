'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, X, Check } from 'lucide-react'
import clsx from 'clsx'
import { useSellout } from '@/hooks/useSellout'
import {
  computeSelloutPrimForMonth, NP_MONTHS_TR,
  type PrimTip, type NihaiPrimRow,
  type NPProfileTarget, type NPMerchTarget, type NPMerchDetay,
} from '@/lib/nihaiPrim'
import { namesMatch, normalizeName } from '@/lib/sellout'
import type { Profile } from '@/lib/supabase'

function fmtCur(n: number) {
  return '₺' + Math.round(n).toLocaleString('tr-TR')
}
const mm = (ay: number) => String(ay).padStart(2, '0')

const TIP_ORDER: Record<PrimTip, number> = {
  'BSY': 0, 'Süpervizör': 1, 'Jr. Süpervizör': 2, 'Çetinler Merch': 3,
}
const TIP_BADGE: Record<PrimTip, string> = {
  'BSY':            'bg-purple-100 text-purple-700',
  'Süpervizör':     'bg-blue-100 text-blue-700',
  'Jr. Süpervizör': 'bg-cyan-100 text-cyan-700',
  'Çetinler Merch': 'bg-amber-100 text-amber-700',
}

interface OdemeRec { odendi: boolean; odeme_tarihi: string | null }

export function NihaiPrimListesi({
  currentProfile,
  team,
}: {
  currentProfile: Profile
  team: Profile[]
}) {
  const nowYil = new Date().getFullYear()
  const [yil, setYil] = useState(nowYil)
  const canEdit = currentProfile.role === 'admin' || currentProfile.role === 'ik'

  // ── Sellout (tüm dönemler tek fetch) ──
  const { rows: selloutRows, loading: selloutLoading } = useSellout(true)

  // ── BSY primleri (sunucu, tüm aylar) ──
  const [bsyRows, setBsyRows] = useState<{ bsyAdi: string; aylar: Record<number, number> }[]>([])
  // ── Sellout hedefleri (ay → targets) ──
  const [targetsByAy, setTargetsByAy] = useState<Record<number, { p: NPProfileTarget[]; m: NPMerchTarget[] }>>({})
  const [merchDetay, setMerchDetay] = useState<NPMerchDetay[]>([])
  const [odeme, setOdeme] = useState<Record<string, OdemeRec>>({})
  const [loadingAll, setLoadingAll] = useState(true)

  // Düzenleme modalı
  const [edit, setEdit] = useState<{ tip: PrimTip; ad: string; ay: number; prim: number } | null>(null)
  const [editOdendi, setEditOdendi] = useState(false)
  const [editTarih, setEditTarih] = useState('')
  const [saving, setSaving] = useState(false)

  const okey = (ay: number, tip: string, ad: string) => `${ay}||${tip}||${ad}`

  // Yıl değişince tüm verileri çek
  useEffect(() => {
    let iptal = false
    setLoadingAll(true)
    const load = async () => {
      try {
        const aylar = Array.from({ length: 12 }, (_, i) => i + 1)
        const [bsyRes, odemeRes, mdRes, ...targetRes] = await Promise.all([
          fetch(`/api/nihai-prim-bsy?yil=${yil}`).then(r => r.json()).catch(() => ({ rows: [] })),
          fetch(`/api/nihai-prim-odeme?yil=${yil}`).then(r => r.json()).catch(() => ({ rows: [] })),
          fetch('/api/merch-detay').then(r => r.json()).catch(() => ({ data: [] })),
          ...aylar.map(ay =>
            fetch(`/api/sellout-targets?donem=${yil}-${mm(ay)}`).then(r => r.json()).catch(() => ({ profile_targets: [], merch_targets: [] }))
          ),
        ])
        if (iptal) return
        setBsyRows(bsyRes.rows ?? [])
        setMerchDetay(mdRes.data ?? [])
        const tmap: Record<number, { p: NPProfileTarget[]; m: NPMerchTarget[] }> = {}
        aylar.forEach((ay, i) => {
          tmap[ay] = { p: targetRes[i]?.profile_targets ?? [], m: targetRes[i]?.merch_targets ?? [] }
        })
        setTargetsByAy(tmap)
        const omap: Record<string, OdemeRec> = {}
        for (const r of (odemeRes.rows ?? [])) {
          omap[okey(r.ay, r.kullanici_tipi, r.kullanici_adi)] = { odendi: r.odendi, odeme_tarihi: r.odeme_tarihi }
        }
        setOdeme(omap)
      } finally {
        if (!iptal) setLoadingAll(false)
      }
    }
    load()
    return () => { iptal = true }
  }, [yil])

  // ── Matris: kişi × ay ──
  const rows = useMemo<NihaiPrimRow[]>(() => {
    const map = new Map<string, NihaiPrimRow>()
    const rowKey = (tip: PrimTip, ad: string) => `${tip}||${ad}`

    // BSY
    for (const b of bsyRows) {
      map.set(rowKey('BSY', b.bsyAdi), { tip: 'BSY', ad: b.bsyAdi, aylar: { ...b.aylar } })
    }

    // Sellout (ay bazında hesapla, kişilere dağıt)
    for (let ay = 1; ay <= 12; ay++) {
      const t = targetsByAy[ay]
      if (!t) continue
      const periodRows = selloutRows.filter(r => r.donem === `${yil}-${mm(ay)}`)
      if (periodRows.length === 0 && t.p.length === 0 && t.m.length === 0) continue
      const persons = computeSelloutPrimForMonth({
        periodRows, profileTargets: t.p, merchTargets: t.m, merchDetay, team,
      })
      for (const p of persons) {
        const k = rowKey(p.tip, p.ad)
        let row = map.get(k)
        if (!row) {
          row = {
            tip: p.tip, ad: p.ad, aylar: {},
            selfProfileId: p.selfProfileId, ownerSupAd: p.ownerSupAd, ownerJrAd: p.ownerJrAd,
          }
          map.set(k, row)
        }
        row.aylar[ay] = (row.aylar[ay] ?? 0) + p.prim
      }
    }

    // Sıfır satırları gizle (tüm aylar 0)
    let all = [...map.values()].filter(r =>
      Object.values(r.aylar).some(v => (v ?? 0) > 0)
    )

    // ── Rol görünürlüğü ──
    const role = currentProfile.role
    if (role !== 'admin' && role !== 'ik') {
      const myName = currentProfile.full_name
      const myJrNames = team.filter(p => p.role === 'jr' && p.manager_id === currentProfile.id).map(p => p.full_name)
      const matchesAny = (val: string | undefined, names: string[]) =>
        !!val && names.some(n => namesMatch(n, val))

      all = all.filter(r => {
        if (role === 'bsy') {
          return r.tip === 'BSY' && namesMatch(r.ad, myName)
        }
        if (role === 'sup') {
          if (r.tip === 'Süpervizör') return r.selfProfileId === currentProfile.id || namesMatch(r.ad, myName)
          if (r.tip === 'Jr. Süpervizör') return matchesAny(r.ownerSupAd, [myName])
          if (r.tip === 'Çetinler Merch') {
            return matchesAny(r.ownerSupAd, [myName]) || matchesAny(r.ownerJrAd, myJrNames)
          }
          return false
        }
        if (role === 'jr') {
          if (r.tip === 'Jr. Süpervizör') return r.selfProfileId === currentProfile.id || namesMatch(r.ad, myName)
          if (r.tip === 'Çetinler Merch') return matchesAny(r.ownerJrAd, [myName])
          return false
        }
        return false
      })
    }

    all.sort((a, b) =>
      TIP_ORDER[a.tip] - TIP_ORDER[b.tip] || a.ad.localeCompare(b.ad, 'tr')
    )
    return all
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bsyRows, selloutRows, targetsByAy, merchDetay, team, currentProfile.id, currentProfile.role, yil])

  const yilTotal = (ay: number) =>
    rows.reduce((s, r) => s + (r.aylar[ay] ?? 0), 0)

  const openCell = (r: NihaiPrimRow, ay: number) => {
    const prim = r.aylar[ay] ?? 0
    if (prim <= 0) return
    const rec = odeme[okey(ay, r.tip, r.ad)]
    setEdit({ tip: r.tip, ad: r.ad, ay, prim })
    setEditOdendi(rec?.odendi ?? false)
    setEditTarih(rec?.odeme_tarihi ?? new Date().toISOString().slice(0, 10))
  }

  const saveOdeme = async () => {
    if (!edit) return
    setSaving(true)
    try {
      const res = await fetch('/api/nihai-prim-odeme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yil, ay: edit.ay, kullanici_tipi: edit.tip, kullanici_adi: edit.ad,
          odendi: editOdendi, odeme_tarihi: editOdendi ? editTarih : null,
          updated_by: currentProfile.id,
        }),
      })
      if (res.ok) {
        setOdeme(prev => ({
          ...prev,
          [okey(edit.ay, edit.tip, edit.ad)]: { odendi: editOdendi, odeme_tarihi: editOdendi ? editTarih : null },
        }))
        setEdit(null)
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Kaydedilemedi')
      }
    } finally {
      setSaving(false)
    }
  }

  const loading = loadingAll || selloutLoading
  const yillar = Array.from({ length: 4 }, (_, i) => nowYil - 2 + i)

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-base font-bold">Nihai Prim Listesi</h1>
          <p className="text-[11px] text-purple-100">BSY · Süpervizör · Jr. Süpervizör · Çetinler Merch</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={yil}
            onChange={e => setYil(parseInt(e.target.value))}
            className="text-xs text-gray-800 rounded-lg px-2 py-1.5 outline-none"
          >
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw size={20} className="animate-spin text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Prim hakedişleri hesaplanıyor…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3">
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
            <table className="text-xs border-collapse min-w-max w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-brand-700 text-white">
                  <th className="sticky left-0 z-30 bg-brand-700 text-left px-3 py-2 border-r border-brand-600 min-w-[70px]">Tip</th>
                  <th className="sticky left-[70px] z-30 bg-brand-700 text-left px-3 py-2 border-r border-brand-600 min-w-[160px]">Ad Soyad</th>
                  {NP_MONTHS_TR.map((m, i) => (
                    <th key={i} className="text-right px-3 py-2 border-r border-brand-600 min-w-[92px] whitespace-nowrap">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={14} className="text-center text-gray-400 py-10">Hakedişi olan kayıt bulunamadı.</td></tr>
                )}
                {rows.map((r, ri) => (
                  <tr key={ri} className={clsx('border-b border-gray-100 hover:bg-gray-50', ri % 2 === 1 && 'bg-gray-50/40')}>
                    <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-2 py-1.5">
                      <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap', TIP_BADGE[r.tip])}>
                        {r.tip}
                      </span>
                    </td>
                    <td className="sticky left-[70px] z-10 bg-white border-r border-gray-200 px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">{r.ad}</td>
                    {NP_MONTHS_TR.map((_, i) => {
                      const ay = i + 1
                      const prim = r.aylar[ay] ?? 0
                      const rec = odeme[okey(ay, r.tip, r.ad)]
                      const paid = !!rec?.odendi
                      if (prim <= 0) {
                        return <td key={i} className="text-center px-3 py-1.5 border-r border-gray-100 text-gray-300">—</td>
                      }
                      return (
                        <td
                          key={i}
                          onClick={() => openCell(r, ay)}
                          className={clsx(
                            'px-2 py-1.5 border-r border-gray-100 text-right cursor-pointer transition-colors',
                            paid ? 'bg-green-100 hover:bg-green-200' : 'bg-amber-50 hover:bg-amber-100'
                          )}
                          title={paid
                            ? `Ödendi${rec?.odeme_tarihi ? ' · ' + rec.odeme_tarihi.split('-').reverse().join('.') : ''}`
                            : 'Ödenmedi — düzenlemek için tıklayın'}
                        >
                          <div className={clsx('font-semibold', paid ? 'text-green-800' : 'text-amber-800')}>
                            {fmtCur(prim)}
                          </div>
                          {paid && rec?.odeme_tarihi && (
                            <div className="text-[9px] text-green-700 leading-tight">
                              {rec.odeme_tarihi.split('-').reverse().join('.')}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-purple-50 font-bold sticky bottom-0">
                    <td className="sticky left-0 z-10 bg-purple-50 px-2 py-2 border-r border-purple-200 text-purple-900" />
                    <td className="sticky left-[70px] z-10 bg-purple-50 px-3 py-2 border-r border-purple-200 text-purple-900">Toplam</td>
                    {NP_MONTHS_TR.map((_, i) => {
                      const t = yilTotal(i + 1)
                      return (
                        <td key={i} className="text-right px-2 py-2 border-r border-purple-200 text-purple-900">
                          {t > 0 ? fmtCur(t) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Yeşil = ödendi, sarı = ödenmedi. {canEdit ? 'Tutara tıklayarak ödendi bilgisini ve tarihini girebilirsiniz.' : 'Ödendi bilgisi yalnızca admin ve İnsan Kaynakları tarafından girilir.'}
          </p>
        </div>
      )}

      {/* Ödeme düzenleme modalı */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Ödeme Bilgisi</h3>
              <button onClick={() => setEdit(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="text-gray-600">
                <span className="font-semibold text-gray-800">{edit.ad}</span> · {edit.tip}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{NP_MONTHS_TR[edit.ay - 1]} {yil}</span>
                <span className="font-bold text-purple-700">{fmtCur(edit.prim)}</span>
              </div>

              {canEdit ? (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editOdendi} onChange={e => setEditOdendi(e.target.checked)} />
                    <span className="text-gray-700">Ödendi</span>
                  </label>
                  {editOdendi && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ödeme Tarihi</label>
                      <input
                        type="date"
                        value={editTarih}
                        onChange={e => setEditTarih(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEdit(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">İptal</button>
                    <button onClick={saveOdeme} disabled={saving} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-1">
                      {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Kaydet
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-xs bg-gray-50 rounded-lg p-3">
                  {editOdendi
                    ? `Ödendi${editTarih ? ' · ' + editTarih.split('-').reverse().join('.') : ''}`
                    : 'Henüz ödenmedi. Ödendi bilgisi yalnızca admin ve İnsan Kaynakları tarafından girilir.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
