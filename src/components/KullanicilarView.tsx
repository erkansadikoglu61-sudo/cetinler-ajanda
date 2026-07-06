'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, X, ChevronDown, RefreshCw, User, Users, Check,
} from 'lucide-react'
import clsx from 'clsx'
import { supabase, Profile, BsySupervisor } from '@/lib/supabase'
import { normalizeName } from '@/lib/sellout'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'

// ─── Tipler ────────────────────────────────────────────────────────────────

interface FieldPerson {
  id:            string
  merch_adi:     string
  merch_grubu:   string | null
  cari_adi:      string | null
  sube_adi:      string | null
  jr_adi:        string | null   // Excel'den gelen orijinal ad
  sup_adi:       string | null
  bsy_adi:       string | null
  jr_profile_id: string | null
}

interface Props {
  currentProfile: Profile
  team:           Profile[]
  bsyLinks:       BsySupervisor[]
}

// ─── Yardımcı: FilterSelect ────────────────────────────────────────────────

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value:    string
  onChange: (v: string) => void
  placeholder: string
  options:  { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          'appearance-none pl-2.5 pr-6 py-1.5 text-xs rounded-xl border font-medium focus:outline-none focus:border-brand-400 transition-colors max-w-[180px] truncate',
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

// ─── Yardımcı: grup rengi ──────────────────────────────────────────────────

function grupBadge(grup: string | null) {
  if (grup === 'Çetinler Merch') return 'bg-emerald-100 text-emerald-700'
  if (grup === 'Bayi Merch')     return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

// ─── Kişi Detay / Atama Paneli ─────────────────────────────────────────────

interface PersonDetailProps {
  person:    FieldPerson
  myJrs:     Profile[]
  team:      Profile[]
  assigning: string | null      // field person id being saved
  onToggleJr: (personId: string, jrProfileId: string | null) => Promise<void>
  onClose:   () => void
}

function PersonDetail({ person, myJrs, team, assigning, onToggleJr, onClose }: PersonDetailProps) {
  const assignedJr = person.jr_profile_id
    ? team.find(p => p.id === person.jr_profile_id)
    : null
  const busy = assigning === person.id

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

        {/* Başlık */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: '#6366f1' }}
            >
              {person.merch_adi.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 leading-tight">{person.merch_adi}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {person.cari_adi} — {person.sube_adi}
              </p>
              {person.merch_grubu && (
                <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-medium', grupBadge(person.merch_grubu))}>
                  {person.merch_grubu}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* İçerik */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">

          {/* Mevcut atama */}
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-violet-700">
              <Users size={13} />
              Mevcut Jr. Süpervizör
            </div>
            {assignedJr ? (
              <div className="flex items-center gap-2 mt-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: assignedJr.color }}
                >
                  {assignedJr.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span className="text-xs font-medium text-violet-800">{assignedJr.full_name}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Atanmamış</p>
            )}
          </div>

          {/* Jr. atama seçimi */}
          {myJrs.length > 0 && (
            <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-3">
              <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-violet-700">
                <Users size={13} />
                Jr. Süpervizör Ata / Kaldır
                {busy && <RefreshCw size={11} className="ml-1 animate-spin text-violet-400" />}
              </div>
              <div className="space-y-1.5">
                {myJrs.map(jr => {
                  const isAssigned = person.jr_profile_id === jr.id
                  return (
                    <button
                      key={jr.id}
                      disabled={busy}
                      onClick={() => onToggleJr(person.id, isAssigned ? null : jr.id)}
                      className={clsx(
                        'group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                        isAssigned
                          ? 'bg-violet-100 text-violet-800 border-violet-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700',
                        busy && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ backgroundColor: jr.color }}
                      >
                        {jr.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span className="flex-1 text-left">{jr.full_name}</span>
                      {isAssigned ? (
                        <>
                          <Check size={13} className="flex-shrink-0 group-hover:hidden text-violet-600" />
                          <X     size={13} className="flex-shrink-0 hidden group-hover:block text-red-500" />
                        </>
                      ) : (
                        <User size={13} className="flex-shrink-0 text-gray-300 group-hover:text-violet-500" />
                      )}
                    </button>
                  )
                })}

                {/* Atamayı kaldır */}
                {person.jr_profile_id && (
                  <button
                    disabled={busy}
                    onClick={() => onToggleJr(person.id, null)}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all mt-2 disabled:opacity-50"
                  >
                    <X size={12} />
                    Jr. Süpervizörü Kaldır
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Ana Bileşen ────────────────────────────────────────────────────────────

export function KullanicilarView({ currentProfile, team, bsyLinks }: Props) {
  const [personnel,     setPersonnel]     = useState<FieldPerson[]>([])
  const [loading,       setLoading]       = useState(true)
  const [syncing,       setSyncing]       = useState(false)
  const [syncMsg,       setSyncMsg]       = useState<string | null>(null)
  const [search,        setSearch]        = useState('')
  const [filterGrup,    setFilterGrup]    = useState('')
  const [filterSup,     setFilterSup]     = useState('')
  const [filterJr,      setFilterJr]      = useState('')
  const [filterCari,    setFilterCari]    = useState('')
  const [selectedPerson, setSelectedPerson] = useState<FieldPerson | null>(null)
  const [assigning,     setAssigning]     = useState<string | null>(null)

  const isAdmin      = currentProfile.role === 'admin'
  const isSup        = currentProfile.role === 'sup'
  const isAdminOrBsy = currentProfile.role === 'admin' || currentProfile.role === 'bsy'

  // ── Veri yükleme ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      // PHP'den güncel merch detaylarını çek
      const res = await fetch('/api/merch-detay')
      const json = await res.json()

      if (res.ok && json.data) {
        // PHP formatından field_personnel formatına dönüştür
        const converted: FieldPerson[] = json.data.map((m: any) => ({
          id: m.merch_id || `${m.merch_adi}-${m.cari_kod}`,
          merch_adi: m.merch_adi,
          merch_grubu: m.merch_grubu,
          cari_adi: m.cari_adi,
          sube_adi: m.sube_adi,
          jr_adi: m.jr_adi || null,
          sup_adi: m.sup_adi,
          bsy_adi: m.bsy_adi || m.bsy_kod,
          jr_profile_id: null,
        }))

        // Debug: API'den gelen unique değerler
        const allGrups = new Set(converted.map(p => p.merch_grubu).filter(Boolean))
        const allSups = new Set(converted.map(p => p.sup_adi).filter(Boolean))
        const allJrs = new Set(converted.map(p => p.jr_adi).filter(Boolean))

        console.log('📊 merch_grubu unique değerler:', [...allGrups])
        console.log('📊 Çetinler Merch olan kayıt sayısı:', converted.filter(p => p.merch_grubu === 'Çetinler Merch').length)
        console.log('📊 Bayi Merch olan kayıt sayısı:', converted.filter(p => p.merch_grubu === 'Bayi Merch').length)
        console.log('📊 İlk 3 Çetinler Merch kaydı:',
          converted
            .filter(p => p.merch_grubu === 'Çetinler Merch')
            .slice(0, 3)
            .map(p => `${p.merch_adi} (grup="${p.merch_grubu}")`)
        )

        setPersonnel(converted)
      } else {
        console.error('Merch detay API error:', json.error)
        setPersonnel([])
      }
    } catch (e) {
      console.error('Load error:', e)
      setPersonnel([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Rol bazlı filtre ──────────────────────────────────────────────────────
  const visiblePersonnel = useMemo<FieldPerson[]>(() => {
    if (currentProfile.role === 'admin') return personnel

    if (currentProfile.role === 'bsy') {
      // bsy_adi kolonu hem kod (IB2) hem tam ad (Okan Oğuz) formatında olabilir
      const bsyNameLower = currentProfile.full_name.toLocaleLowerCase('tr')
      const bsyKod       = BSY_NAME_TO_KOD[bsyNameLower] ?? ''
      const filtered = personnel.filter(p => {
        if (!p.bsy_adi) return false
        const v = p.bsy_adi.toLocaleLowerCase('tr')
        return v === bsyKod.toLocaleLowerCase('tr') || v === bsyNameLower
      })
      if (filtered.length > 0) return filtered
      // Fallback: bsyLinks üzerinden supervisor adına göre
      const linkedSupIds = bsyLinks
        .filter(l => l.bsy_id === currentProfile.id)
        .map(l => l.sup_id)
      const linkedSupNames = new Set(
        team.filter(p => linkedSupIds.includes(p.id)).map(p => normalizeName(p.full_name))
      )
      return personnel.filter(p => p.sup_adi && linkedSupNames.has(normalizeName(p.sup_adi)))
    }

    if (currentProfile.role === 'sup') {
      return personnel.filter(
        p => p.sup_adi && normalizeName(p.sup_adi) === normalizeName(currentProfile.full_name)
      )
    }

    if (currentProfile.role === 'jr') {
      return personnel.filter(p => p.jr_profile_id === currentProfile.id)
    }

    return []
  }, [personnel, currentProfile, team, bsyLinks])

  // ── Sup'ın Jr'ları ────────────────────────────────────────────────────────
  const myJrs = useMemo(
    () => isSup
      ? team.filter(p => p.role === 'jr' && p.manager_id === currentProfile.id)
      : [],
    [isSup, currentProfile, team]
  )

  // ── Filtre seçenekleri (cascade) ──────────────────────────────────────────
  const supOptions = useMemo(() => {
    // Tüm jr_adi'leri topla
    const jrSet = new Set(
      visiblePersonnel.map(p => p.jr_adi).filter(Boolean) as string[]
    )

    // sup_adi'leri topla ama:
    // 1. jr_adi listesinde olanları çıkar
    // 2. "Atilla Yılmaz" çıkar (BSY)
    const supSet = new Set(
      visiblePersonnel
        .map(p => p.sup_adi)
        .filter((sup): sup is string => Boolean(sup))
        .filter(sup => !jrSet.has(sup)) // Jr listesinde olmayanlar
        .filter(sup => sup !== 'Atilla Yılmaz') // BSY olanı çıkar
    )

    return [...supSet].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [visiblePersonnel])

  const jrOptions = useMemo(() => {
    // Jr Supervizör listesi veriden çek (jr_adi dolu olanlar)
    // "Atilla" ile başlayanları çıkar
    const s = new Set(
      visiblePersonnel
        .map(p => p.jr_adi)
        .filter((jr): jr is string => Boolean(jr))
        .filter(jr => !jr.toLowerCase().startsWith('atilla'))
    )
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [visiblePersonnel])

  const cariOptions = useMemo(() => {
    const base = filterSup
      ? visiblePersonnel.filter(p => p.sup_adi === filterSup)
      : visiblePersonnel
    const s = new Set(base.map(p => p.cari_adi).filter(Boolean) as string[])
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [visiblePersonnel, filterSup])

  // ── Uygulanan filtreler ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = visiblePersonnel

    // Grup filtresi
    if (filterGrup) {
      res = res.filter(p => p.merch_grubu === filterGrup)
    }

    // Supervizör filtresi
    if (filterSup) {
      res = res.filter(p => p.sup_adi === filterSup)
    }

    // Jr. Supervizör filtresi
    if (filterJr) {
      res = res.filter(p => p.jr_adi === filterJr)
    }

    // Cari filtresi
    if (filterCari) {
      res = res.filter(p => p.cari_adi === filterCari)
    }

    // Arama
    if (search) {
      const q = search.toLowerCase()
      res = res.filter(p =>
        p.merch_adi.toLowerCase().includes(q) ||
        (p.cari_adi ?? '').toLowerCase().includes(q) ||
        (p.sube_adi ?? '').toLowerCase().includes(q)
      )
    }

    return res
  }, [visiblePersonnel, filterGrup, filterSup, filterJr, filterCari, search])

  // ── Jr atama / kaldırma ───────────────────────────────────────────────────
  // Her değişiklik jr_assignment_history'e loglanır (effective_month = bu ayın 1'i).
  // Böylece önceki aylardaki atamalar değişmez — sadece bu ay ve sonrası etkilenir.
  const handleToggleJr = useCallback(async (personId: string, jrProfileId: string | null) => {
    setAssigning(personId)
    try {
      const person = personnel.find(p => p.id === personId)
      if (!person) return

      const oldJrId = person.jr_profile_id

      // field_personnel tablosunu güncelle
      const { error } = await supabase
        .from('field_personnel')
        .update({ jr_profile_id: jrProfileId })
        .eq('id', personId)
      if (error) {
        console.error('Jr atama hatası:', error)
        return
      }

      // Geçmiş logu — effective_month: bu ayın ilk günü
      const now = new Date()
      const effectiveMonth =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { error: logErr } = await supabase
        .from('jr_assignment_history')
        .insert({
          field_person_id:   personId,
          merch_adi:         person.merch_adi,
          sube_adi:          person.sube_adi,
          cari_adi:          person.cari_adi,
          old_jr_profile_id: oldJrId,
          new_jr_profile_id: jrProfileId,
          effective_month:   effectiveMonth,
          changed_by:        currentProfile.id,
        })
      if (logErr) console.error('Geçmiş log hatası:', logErr)

      // Lokal state güncelle
      setPersonnel(prev =>
        prev.map(p => p.id === personId ? { ...p, jr_profile_id: jrProfileId } : p)
      )
      setSelectedPerson(prev =>
        prev?.id === personId ? { ...prev, jr_profile_id: jrProfileId } : prev
      )
    } catch (err) {
      console.error('handleToggleJr beklenmedik hata:', err)
    } finally {
      setAssigning(null)
    }
  }, [personnel, currentProfile.id])

  const activeFilters = [filterGrup, filterSup, filterJr, filterCari].filter(Boolean).length

  // ── Yenile (PHP'den tekrar çek) ──────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    await load()
    setSyncMsg('✓ Liste güncellendi')
    setSyncing(false)
    setTimeout(() => setSyncMsg(null), 4000)
  }, [load])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Üst Bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">Kullanıcılar</span>
        <button onClick={load} disabled={loading || syncing} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        {isAdmin && (
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Güncelleniyor…' : 'Güncelle'}
          </button>
        )}
        {syncMsg && (
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full border',
            syncMsg.startsWith('✓') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
          )}>{syncMsg}</span>
        )}
        <div className="flex-1" />
        {!loading && (
          <span className="text-[10px] text-gray-400">
            {filtered.length} / {visiblePersonnel.length} kişi
          </span>
        )}
      </div>

      {/* Arama + Filtreler */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsim, cari veya şube ara…"
            className="w-full text-xs border border-gray-200 rounded-xl pl-8 pr-8 py-2 focus:outline-none focus:border-brand-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Grup */}
          <FilterSelect
            value={filterGrup}
            onChange={setFilterGrup}
            placeholder="Grup"
            options={[
              { value: 'Çetinler Merch',   label: 'Çetinler Merch'   },
              { value: 'Bayi Merch',        label: 'Bayi Merch'        },
              { value: 'Destek Personeli',  label: 'Destek Personeli'  },
            ]}
          />

          {/* Süpervizör — admin ve BSY */}
          {isAdminOrBsy && supOptions.length > 0 && (
            <FilterSelect
              value={filterSup}
              onChange={v => { setFilterSup(v); setFilterJr(''); setFilterCari('') }}
              placeholder="Süpervizör"
              options={supOptions.map(s => ({ value: s, label: s }))}
            />
          )}

          {/* Jr. Supervizör — admin ve BSY */}
          {isAdminOrBsy && jrOptions.length > 0 && (
            <FilterSelect
              value={filterJr}
              onChange={v => { setFilterJr(v); setFilterCari('') }}
              placeholder="Jr. Supervizör"
              options={jrOptions.map(j => ({ value: j, label: j }))}
            />
          )}

          {/* Cari */}
          {cariOptions.length > 0 && (
            <FilterSelect
              value={filterCari}
              onChange={setFilterCari}
              placeholder="Cari"
              options={cariOptions.map(c => ({ value: c, label: c }))}
            />
          )}

          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterGrup(''); setFilterSup(''); setFilterJr(''); setFilterCari('') }}
              className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
            >
              <X size={11} /> Temizle ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full gap-2 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin" /> Yükleniyor…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <User size={32} className="opacity-30" />
            <p className="text-sm">
              {search || activeFilters ? 'Eşleşen kullanıcı bulunamadı' : 'Kullanıcı verisi yok'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map(person => {
              const assignedJr = person.jr_profile_id
                ? team.find(p => p.id === person.jr_profile_id)
                : null
              return (
                <button
                  key={person.id}
                  onClick={() => isSup ? setSelectedPerson(person) : undefined}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 bg-white transition-colors text-left',
                    isSup ? 'hover:bg-blue-50/30 cursor-pointer' : 'cursor-default'
                  )}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-xs">
                    {person.merch_adi.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{person.merch_adi}</p>
                      {person.merch_grubu && (
                        <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-medium', grupBadge(person.merch_grubu))}>
                          {person.merch_grubu}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {[person.cari_adi, person.sube_adi].filter(Boolean).join(' — ')}
                    </p>
                    {assignedJr && (
                      <p className="text-[10px] text-violet-600 font-medium mt-0.5">
                        Jr: {assignedJr.full_name}
                      </p>
                    )}
                  </div>

                  {/* Chevron — sadece sup */}
                  {isSup && (
                    <ChevronDown size={14} className="flex-shrink-0 text-gray-300 -rotate-90" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detay / Atama Paneli */}
      {selectedPerson && isSup && (
        <PersonDetail
          person={selectedPerson}
          myJrs={myJrs}
          team={team}
          assigning={assigning}
          onToggleJr={handleToggleJr}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  )
}
