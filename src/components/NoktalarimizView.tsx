'use client'

import { useMemo, useState, useEffect } from 'react'
import { Search, X, ChevronRight, RefreshCw, User, Users, ShoppingBag, Store, ChevronDown, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useSellout, SelloutRow } from '@/hooks/useSellout'
import { Profile, BsySupervisor, supabase } from '@/lib/supabase'
import { normalizeName } from '@/lib/sellout'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'

// field_personnel'dan gelen Jr atama özeti
interface FpJrEntry {
  sube_adi:      string | null
  cari_adi:      string | null
  jr_profile_id: string | null
}

// field_personnel'dan gelen Destek Personeli
interface FpDestekEntry {
  sube_adi:    string | null
  cari_adi:    string | null
  merch_adi:   string | null
  merch_grubu: string | null
}

// ─── Tipler ────────────────────────────────────────────────────
interface SubeItem {
  subeKod:          string
  subeAdi:          string
  cariIsim:         string
  sups:             Profile[]
  jrs:              Profile[]
  cetinlerMerch:    string[]
  bayiMerch:        string[]
  destekPersoneli:  string[]
  bsyIds:           string[]
}

interface Props {
  currentProfile: Profile
  team:           Profile[]
  bsyLinks:       BsySupervisor[]
}

// ─── Görünür supervisor adlarını hesapla ───────────────────────
function visibleSupNames(
  currentProfile: Profile,
  team:           Profile[],
  bsyLinks:       BsySupervisor[],
): Set<string> {
  const names = new Set<string>()
  if (currentProfile.role === 'admin') {
    team.forEach(p => names.add(normalizeName(p.full_name)))
    return names
  }
  if (currentProfile.role === 'bsy') {
    // BSY: bsyLinks üzerinden de ekle (fallback)
    const linkedSupIds = bsyLinks
      .filter(l => l.bsy_id === currentProfile.id)
      .map(l => l.sup_id)
    team.filter(p => linkedSupIds.includes(p.id)).forEach(sup => {
      names.add(normalizeName(sup.full_name))
      team.filter(p => p.manager_id === sup.id).forEach(jr => names.add(normalizeName(jr.full_name)))
    })
    return names
  }
  if (currentProfile.role === 'sup') {
    names.add(normalizeName(currentProfile.full_name))
    team.filter(p => p.manager_id === currentProfile.id).forEach(jr => names.add(normalizeName(jr.full_name)))
    return names
  }
  names.add(normalizeName(currentProfile.full_name))
  return names
}

// ─── Sellout satırlarından şube listesi üret ───────────────────
// fpJrMap: normalize("sube||cari") → Set<jr_profile_id>
// Jr. bilgisi artık scraping'den değil field_personnel'dan geliyor
function buildSubeList(
  rows:           SelloutRow[],
  currentProfile: Profile,
  team:           Profile[],
  bsyLinks:       BsySupervisor[],
  fpJrMap:        Map<string, Set<string>>,
  fpDestekMap:    Map<string, string[]>,
): SubeItem[] {
  let visible: SelloutRow[]

  if (currentProfile.role === 'bsy') {
    // BSY: sellout verisindeki bsy koduna göre filtrele
    const bsyKod = BSY_NAME_TO_KOD[currentProfile.full_name.toLocaleLowerCase('tr')] ?? ''
    visible = bsyKod ? rows.filter(r => r.bsy === bsyKod) : []
  } else {
    const allowedNames = visibleSupNames(currentProfile, team, bsyLinks)
    visible = rows.filter(r => allowedNames.has(normalizeName(r.supervisor_adi)))
  }

  const findProfile = (name: string): Profile | undefined =>
    team.find(p => normalizeName(p.full_name) === normalizeName(name))

  const map = new Map<string, {
    subeAdi:  string
    cariIsim: string
    supIds:   Set<string>
    supNames: Set<string>
    cetinler: Set<string>
    bayi:     Set<string>
  }>()

  visible.forEach(r => {
    const key = r.sube_kod || `${r.sube_adi}||${r.cari_isim}`
    if (!map.has(key)) {
      map.set(key, {
        subeAdi:  r.sube_adi,
        cariIsim: r.cari_isim,
        supIds:   new Set(),
        supNames: new Set(),
        cetinler: new Set(),
        bayi:     new Set(),
      })
    }
    const entry = map.get(key)!

    const supProfile = findProfile(r.supervisor_adi)
    if (supProfile) {
      if (supProfile.role === 'sup') {
        entry.supNames.add(supProfile.full_name)
        entry.supIds.add(supProfile.id)
      } else if (supProfile.role === 'jr') {
        // Jr. supervisor_adi olarak görünüyorsa → yöneticisi Sup'u bul
        const manager = team.find(p => p.id === supProfile.manager_id)
        if (manager) {
          entry.supNames.add(manager.full_name)
          entry.supIds.add(manager.id)
        }
      }
    } else if (r.supervisor_adi) {
      entry.supNames.add(r.supervisor_adi)
    }

    if (r.merch_personel) {
      if (r.merch_tipi === 'Çetinler Merch') entry.cetinler.add(r.merch_personel)
      else                                    entry.bayi.add(r.merch_personel)
    }
  })

  return [...map.entries()]
    .map(([subeKod, e]) => {
      // BSY'leri bul
      const bsyIds: string[] = []
      e.supIds.forEach(supId => {
        bsyLinks.filter(l => l.sup_id === supId).forEach(l => {
          if (!bsyIds.includes(l.bsy_id)) bsyIds.push(l.bsy_id)
        })
      })

      // Jr. bilgisi → field_personnel tablosundan (scraping'den değil)
      const fpKey = e.subeAdi.trim() + '||' + e.cariIsim.trim()
      const jrIds = fpJrMap.get(fpKey) ?? new Set<string>()
      const jrs   = [...jrIds]
        .map(id => team.find(p => p.id === id))
        .filter(Boolean) as Profile[]

      // Destek personeli → field_personnel'dan
      const destekPersoneli = fpDestekMap.get(fpKey) ?? []

      return {
        subeKod,
        subeAdi:          e.subeAdi,
        cariIsim:         e.cariIsim,
        sups:             [...e.supNames].map(n => team.find(p => p.full_name === n) ?? { id: '', full_name: n, role: 'sup', color: '#888', manager_id: null, email: null } as Profile),
        jrs,
        cetinlerMerch:    [...e.cetinler].sort(),
        bayiMerch:        [...e.bayi].sort(),
        destekPersoneli:  destekPersoneli.sort(),
        bsyIds,
      }
    })
    .sort((a, b) => a.subeAdi.localeCompare(b.subeAdi, 'tr'))
}

// ─── Avatar ────────────────────────────────────────────────────
function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}>
      {initials}
    </div>
  )
}

// ─── Şube Detay Paneli ─────────────────────────────────────────
interface SubeDetailProps {
  sube:           SubeItem
  onClose:        () => void
  currentProfile: Profile
  onRefresh:      () => void
}

function SubeDetail({ sube, onClose, currentProfile, onRefresh }: SubeDetailProps) {
  const [destekList, setDestekList] = useState<string[]>(sube.destekPersoneli)
  const [newMerchName, setNewMerchName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const canEdit = currentProfile.role === 'admin' || currentProfile.role === 'sup' || currentProfile.role === 'jr'

  // Yeni destek personeli ekle
  const handleAdd = async () => {
    if (!newMerchName.trim()) return
    setAdding(true)
    setMsg('')

    try {
      const res = await fetch('/api/destek-personel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sube_adi: sube.subeAdi,
          cari_adi: sube.cariIsim,
          merch_adi: newMerchName.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMsg(`❌ ${data.error || 'Hata oluştu'}`)
        return
      }

      setDestekList([...destekList, newMerchName.trim()].sort())
      setNewMerchName('')
      setMsg('✓ Eklendi')
      setTimeout(() => setMsg(''), 2000)
      onRefresh()
    } catch (e) {
      setMsg('❌ Bağlantı hatası')
    } finally {
      setAdding(false)
    }
  }

  // Destek personeli sil
  const handleDelete = async (merchName: string) => {
    if (!confirm(`${merchName} isimli destek personelini silmek istediğinizden emin misiniz?`)) return

    setDeleting(merchName)
    setMsg('')

    try {
      // Önce ID'yi bul
      const getRes = await fetch(`/api/destek-personel?sube_adi=${encodeURIComponent(sube.subeAdi)}&cari_adi=${encodeURIComponent(sube.cariIsim)}`)
      const getData = await getRes.json()

      const record = getData.data?.find((d: { merch_adi: string }) => d.merch_adi === merchName)
      if (!record) {
        setMsg('❌ Kayıt bulunamadı')
        setDeleting(null)
        return
      }

      const res = await fetch(`/api/destek-personel?id=${record.id}&yil=${record.yil}&ay=${record.ay}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        setMsg(`❌ ${data.error || 'Silinemedi'}`)
        return
      }

      setDestekList(destekList.filter(n => n !== merchName))
      setMsg('✓ Silindi')
      setTimeout(() => setMsg(''), 2000)
      onRefresh()
    } catch (e) {
      setMsg('❌ Bağlantı hatası')
    } finally {
      setDeleting(null)
    }
  }

  const sections = [
    { title: 'Süpervizör',       icon: <User size={14} />,       color: 'blue',    items: sube.sups.map(p => ({ name: p.full_name, color: p.color })), editable: false },
    { title: 'Jr. Süpervizör',   icon: <Users size={14} />,      color: 'violet',  items: sube.jrs.map(p => ({ name: p.full_name, color: p.color })), editable: false },
    { title: 'Çetinler Merch',   icon: <ShoppingBag size={14} />,color: 'emerald', items: sube.cetinlerMerch.map(n => ({ name: n, color: undefined })), editable: false },
    { title: 'Bayi Merch',       icon: <Store size={14} />,      color: 'amber',   items: sube.bayiMerch.map(n => ({ name: n, color: undefined })), editable: false },
    { title: 'Destek Personeli', icon: <User size={14} />,       color: 'sky',     items: destekList.map(n => ({ name: n, color: undefined })), editable: true },
  ]

  const colorMap: Record<string, string> = {
    blue:    'bg-blue-100 text-blue-700 border-blue-200',
    violet:  'bg-violet-100 text-violet-700 border-violet-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-100 text-amber-700 border-amber-200',
    sky:     'bg-sky-100 text-sky-700 border-sky-200',
  }
  const dotMap: Record<string, string> = {
    blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', sky: 'bg-sky-500',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Şube Detayı</p>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">{sube.subeAdi}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{sube.cariIsim}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {msg && (
          <div className={clsx('px-5 py-2 text-xs font-medium border-b',
            msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          )}>
            {msg}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {sections.map(sec => sec.items.length === 0 && !sec.editable ? null : (
            <div key={sec.title} className={clsx('rounded-xl border p-3', colorMap[sec.color])}>
              <div className="flex items-center gap-1.5 mb-2 font-semibold text-xs">
                {sec.icon}{sec.title}
                <span className="ml-auto bg-white/60 rounded-full px-1.5 py-0.5 text-[10px]">{sec.items.length}</span>
              </div>

              <div className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/70 rounded-lg px-2.5 py-1.5">
                    {item.color
                      ? <Avatar name={item.name} color={item.color} size={24} />
                      : <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', dotMap[sec.color])} />}
                    <span className="text-xs font-medium text-gray-800 flex-1">{item.name}</span>

                    {/* Sil butonu - sadece Destek Personeli için */}
                    {sec.editable && canEdit && (
                      <button
                        onClick={() => handleDelete(item.name)}
                        disabled={deleting === item.name}
                        className="p-1 rounded hover:bg-red-100 text-red-600 disabled:opacity-50 transition-colors"
                        title="Sil"
                      >
                        {deleting === item.name ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    )}
                  </div>
                ))}

                {/* Ekle formu - sadece Destek Personeli için */}
                {sec.editable && canEdit && (
                  <div className="flex gap-2 pt-2 border-t border-sky-200">
                    <input
                      type="text"
                      value={newMerchName}
                      onChange={e => setNewMerchName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                      placeholder="Yeni destek personeli adı..."
                      className="flex-1 text-xs px-2.5 py-1.5 border border-sky-300 rounded-lg focus:outline-none focus:border-sky-500 bg-white"
                      disabled={adding}
                    />
                    <button
                      onClick={handleAdd}
                      disabled={adding || !newMerchName.trim()}
                      className="px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-medium transition-colors"
                    >
                      {adding ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                      Ekle
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sections.every(s => s.items.length === 0 && !s.editable) && (
            <p className="text-xs text-gray-400 text-center py-8">Bilgi bulunamadı.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Basit select bileşeni ─────────────────────────────────────
function FilterSelect({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          'appearance-none pl-2.5 pr-6 py-1.5 text-xs rounded-xl border font-medium focus:outline-none focus:border-brand-400 transition-colors',
          value
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'border-gray-200 bg-white text-gray-500'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Ana Bileşen ───────────────────────────────────────────────
export function NoktalarimizView({ currentProfile, team, bsyLinks }: Props) {
  const { rows, loading, error, reload } = useSellout(true)

  const [search,       setSearch]       = useState('')
  const [filterTip,   setFilterTip]    = useState('')   // '' | 'cetinler' | 'bayi'
  const [filterMerch, setFilterMerch]  = useState('')   // merch adı
  const [filterBsy,   setFilterBsy]    = useState('')   // bsy profile id
  const [filterSup,   setFilterSup]    = useState('')   // sup profile id
  const [selected,     setSelected]    = useState<SubeItem | null>(null)
  const [importing,    setImporting]   = useState(false)
  const [importMsg,    setImportMsg]   = useState('')

  // ── field_personnel'dan Jr. atamaları yükle ────────────────────
  const [fpJrEntries,    setFpJrEntries]    = useState<FpJrEntry[]>([])
  const [fpDestekEntries, setFpDestekEntries] = useState<FpDestekEntry[]>([])
  const [fpRefreshKey, setFpRefreshKey] = useState(0)

  const loadFieldPersonnel = () => {
    supabase
      .from('field_personnel')
      .select('sube_adi, cari_adi, jr_profile_id')
      .then(({ data }) => setFpJrEntries(data ?? []))
    supabase
      .from('field_personnel')
      .select('sube_adi, cari_adi, merch_adi, merch_grubu')
      .eq('merch_grubu', 'Destek Personeli')
      .then(({ data }) => setFpDestekEntries(data ?? []))
  }

  useEffect(() => {
    loadFieldPersonnel()
  }, [fpRefreshKey])

  const handleRefresh = () => {
    setFpRefreshKey(k => k + 1)
    reload()
  }

  // Bulk import destek personeli
  const handleBulkImport = async () => {
    if (!confirm('97 adet destek personelini sisteme eklemek istediğinizden emin misiniz?\n\nBu işlem sadece yeni kayıtları ekler, mevcut kayıtları değiştirmez.')) {
      return
    }

    setImporting(true)
    setImportMsg('')

    try {
      const res = await fetch('/api/destek-personel/bulk-import', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setImportMsg(`❌ ${data.error || 'Hata oluştu'}`)
        return
      }

      setImportMsg(`✓ ${data.inserted} yeni kayıt eklendi, ${data.skipped} kayıt zaten mevcuttu`)
      setTimeout(() => setImportMsg(''), 5000)
      handleRefresh()
    } catch (e) {
      setImportMsg('❌ Bağlantı hatası')
    } finally {
      setImporting(false)
    }
  }

  // normalize("sube||cari") → Set<jr_profile_id>
  const fpJrMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    fpJrEntries.forEach(fp => {
      if (!fp.jr_profile_id) return
      const key = (fp.sube_adi ?? '').trim() + '||' + (fp.cari_adi ?? '').trim()
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(fp.jr_profile_id)
    })
    return map
  }, [fpJrEntries])

  // normalize("sube||cari") → string[] (destek personeli adları)
  const fpDestekMap = useMemo(() => {
    const map = new Map<string, string[]>()
    fpDestekEntries.forEach(fp => {
      if (!fp.merch_adi) return
      const key = (fp.sube_adi ?? '').trim() + '||' + (fp.cari_adi ?? '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(fp.merch_adi)
    })
    return map
  }, [fpDestekEntries])

  // BSY değişince Sup filtresini sıfırla (cascade tutarlılığı)
  const handleBsyChange = (v: string) => { setFilterBsy(v); setFilterSup('') }

  const subeList = useMemo(
    () => buildSubeList(rows, currentProfile, team, bsyLinks, fpJrMap, fpDestekMap),
    [rows, currentProfile, team, bsyLinks, fpJrMap, fpDestekMap]
  )

  // BSY listesi
  const bsyProfiles = useMemo(
    () => team.filter(p => p.role === 'bsy').sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')),
    [team]
  )

  // ── Cascade filtre: her adım bir sonrakinin seçeneklerini daraltır ──

  // 1) BSY filtresi — bsyLinks üzerinden doğrudan hesapla
  const afterBsy = useMemo(() => {
    if (!filterBsy) return subeList
    // Seçili BSY'ye bağlı tüm sup ID'leri
    const linkedSupIds = new Set(
      bsyLinks.filter(l => l.bsy_id === filterBsy).map(l => l.sup_id)
    )
    // O sup'lara bağlı jr ID'leri
    const linkedJrIds = new Set(
      team
        .filter(p => p.role === 'jr' && p.manager_id && linkedSupIds.has(p.manager_id))
        .map(p => p.id)
    )
    return subeList.filter(s =>
      s.sups.some(p => p.id && linkedSupIds.has(p.id)) ||
      s.jrs.some(p => p.id && linkedJrIds.has(p.id))
    )
  }, [subeList, filterBsy, bsyLinks, team])

  // Süpervizör seçenekleri — afterBsy içinden dinamik olarak (cascade)
  const supOptions = useMemo(() => {
    const map = new Map<string, string>() // id → full_name
    afterBsy.forEach(s => {
      s.sups.forEach(p => { if (p.id) map.set(p.id, p.full_name) })
    })
    return [...map.entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'))
  }, [afterBsy])

  // 2) Süpervizör filtresi
  const afterSup = useMemo(() => {
    if (!filterSup) return afterBsy
    return afterBsy.filter(s => s.sups.some(p => p.id === filterSup))
  }, [afterBsy, filterSup])

  // 3) Merch Tipi filtresi
  const afterTip = useMemo(() => {
    if (!filterTip) return afterSup
    return afterSup.filter(s =>
      filterTip === 'cetinler' ? s.cetinlerMerch.length > 0 : s.bayiMerch.length > 0
    )
  }, [afterSup, filterTip])

  // Merch Adı seçenekleri → sadece mevcut tip+bsy filtresi sonucundaki isimler
  const availableMerchNames = useMemo(() => {
    const s = new Set<string>()
    afterTip.forEach(sb => {
      if (!filterTip || filterTip === 'cetinler') sb.cetinlerMerch.forEach(n => s.add(n))
      if (!filterTip || filterTip === 'bayi')     sb.bayiMerch.forEach(n => s.add(n))
    })
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [afterTip, filterTip])

  // 3) Merch Adı filtresi
  const afterMerch = useMemo(() => {
    if (!filterMerch) return afterTip
    return afterTip.filter(s =>
      s.cetinlerMerch.includes(filterMerch) || s.bayiMerch.includes(filterMerch)
    )
  }, [afterTip, filterMerch])

  // 4) Metin arama
  const filtered = useMemo(() => {
    if (!search) return afterMerch
    const q = search.toLowerCase()
    return afterMerch.filter(s =>
      s.subeAdi.toLowerCase().includes(q) || s.cariIsim.toLowerCase().includes(q)
    )
  }, [afterMerch, search])

  const isAdminOrBsy = currentProfile.role === 'admin' || currentProfile.role === 'bsy'

  const activeFilterCount = [
    filterTip,
    filterMerch,
    currentProfile.role === 'admin' ? filterBsy : '',
    isAdminOrBsy ? filterSup : '',
  ].filter(Boolean).length

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Üst Bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">Noktalarımız</span>
        <button onClick={reload} disabled={loading} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* Admin bulk import butonu */}
        {currentProfile.role === 'admin' && (
          <button
            onClick={handleBulkImport}
            disabled={importing}
            className="text-[10px] px-2 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
          >
            {importing ? <RefreshCw size={10} className="animate-spin" /> : <Plus size={10} />}
            Destek Personeli Yükle
          </button>
        )}

        {importMsg && (
          <span className={clsx('text-[10px] px-2 py-1 rounded-md font-medium',
            importMsg.startsWith('✓') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          )}>
            {importMsg}
          </span>
        )}

        <div className="flex-1" />
        {!loading && (
          <span className="text-[10px] text-gray-400">{filtered.length} / {subeList.length} şube</span>
        )}
      </div>

      {/* ── Arama + Filtreler ────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2 space-y-2">
        {/* Arama */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Şube veya cari ara…"
            className="w-full text-xs border border-gray-200 rounded-xl pl-8 pr-8 py-2 focus:outline-none focus:border-brand-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filtre satırı */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Merch Tipi */}
          <FilterSelect
            value={filterTip}
            onChange={setFilterTip}
            placeholder="Merch Tipi"
            options={[
              { value: 'cetinler', label: 'Çetinler Merch' },
              { value: 'bayi',     label: 'Bayi Merch'     },
            ]}
          />

          {/* Merch Adı */}
          <FilterSelect
            value={filterMerch}
            onChange={setFilterMerch}
            placeholder="Merch Adı"
            options={availableMerchNames.map(n => ({ value: n, label: n }))}
          />

          {/* BSY Adı — sadece admin görebilir */}
          {currentProfile.role === 'admin' && bsyProfiles.length > 0 && (
            <FilterSelect
              value={filterBsy}
              onChange={handleBsyChange}
              placeholder="BSY Adı"
              options={bsyProfiles.map(p => ({ value: p.id, label: p.full_name }))}
            />
          )}

          {/* Süpervizör — admin ve BSY görebilir */}
          {isAdminOrBsy && supOptions.length > 0 && (
            <FilterSelect
              value={filterSup}
              onChange={setFilterSup}
              placeholder="Süpervizör"
              options={supOptions}
            />
          )}

          {/* Filtreleri temizle */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterTip(''); setFilterMerch(''); setFilterBsy(''); setFilterSup('') }}
              className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
            >
              <X size={11} />
              Temizle ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Liste ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        )}
        {!loading && error && (
          <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <Store size={32} className="opacity-30" />
            <p className="text-sm">{search || activeFilterCount ? 'Eşleşen şube bulunamadı' : 'Henüz şube verisi yok'}</p>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map(sube => (
              <button
                key={sube.subeKod}
                onClick={() => setSelected(sube)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-blue-50/30 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Store size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{sube.subeAdi}</p>
                  <p className="text-[11px] text-gray-500 truncate">{sube.cariIsim}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sube.sups.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                        {sube.sups.map(p => p.full_name.split(' ')[0]).join(', ')}
                      </span>
                    )}
                    {sube.jrs.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
                        Jr: {sube.jrs.map(p => p.full_name.split(' ')[0]).join(', ')}
                      </span>
                    )}
                    {sube.cetinlerMerch.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                        {sube.cetinlerMerch.length} Çetinler
                      </span>
                    )}
                    {sube.bayiMerch.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                        {sube.bayiMerch.length} Bayi
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Şube Detay ──────────────────────────────────────── */}
      {selected && (
        <SubeDetail
          sube={selected}
          onClose={() => setSelected(null)}
          currentProfile={currentProfile}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
