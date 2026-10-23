'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, X, ChevronDown, RefreshCw, User, UserPlus,
} from 'lucide-react'
import clsx from 'clsx'
import * as XLSX from 'xlsx'
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

  const isAdmin      = currentProfile.role === 'admin'

  // ── Çetinler Merch hesapları (admin) ──
  // Eksik hesapları oluşturur; yeni kullanıcı adı + şifreler yalnızca indirilen
  // Excel dosyasına yazılır (hiçbir yerde saklanmaz).
  const [hesapBusy, setHesapBusy] = useState(false)
  const [hesapMsg,  setHesapMsg]  = useState<string | null>(null)
  const merchHesaplari = async () => {
    setHesapMsg(null)
    setHesapBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token ?? ''}` }
      const pr = await fetch('/api/merch-hesaplari', { headers })
      const plan = await pr.json()
      if (!pr.ok) throw new Error(plan.error ?? 'Liste alınamadı')
      const yeni = (plan.hesaplar as { mevcut: boolean }[]).filter(h => !h.mevcut).length
      const mevcut = plan.hesaplar.length - yeni
      if (yeni === 0) { setHesapMsg(`✓ Tüm Çetinler Merch hesapları zaten var (${mevcut})`); return }
      if (!confirm(`${yeni} yeni Çetinler Merch hesabı oluşturulacak (${mevcut} hesap zaten var, dokunulmaz).\n\nKullanıcı adları ve şifreler bir Excel dosyası olarak indirilecek. Devam edilsin mi?`)) return

      const res = await fetch('/api/merch-hesaplari', { method: 'POST', headers })
      const out = await res.json()
      if (!res.ok) throw new Error(out.error ?? 'Oluşturma hatası')
      const olusan = out.olusan as { ad: string; email: string; sifre: string }[]
      if (olusan.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet([
          ['Ad Soyad', 'Kullanıcı Adı (e-posta)', 'Şifre'],
          ...olusan.map(o => [o.ad, o.email, o.sifre]),
        ])
        ws['!cols'] = [{ wch: 28 }, { wch: 42 }, { wch: 14 }]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Çetinler Merch')
        XLSX.writeFile(wb, `Cetinler_Merch_Kullanicilari_${new Date().toISOString().slice(0, 10)}.xlsx`)
      }
      const hata = out.hata as { email: string; mesaj: string }[]
      setHesapMsg(hata.length
        ? `✗ ${olusan.length} oluşturuldu, ${hata.length} hata: ${hata[0].mesaj}`
        : `✓ ${olusan.length} hesap oluşturuldu, Excel indirildi`)
    } catch (e) {
      setHesapMsg('✗ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setHesapBusy(false)
    }
  }
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
        }))

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
      return personnel.filter(p => p.jr_adi && normalizeName(p.jr_adi) === normalizeName(currentProfile.full_name))
    }

    return []
  }, [personnel, currentProfile, team, bsyLinks])

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
        {isAdmin && (
          <button
            onClick={merchHesaplari}
            disabled={hesapBusy}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-50"
          >
            <UserPlus size={11} className={hesapBusy ? 'animate-pulse' : ''} />
            {hesapBusy ? 'Hesaplar oluşturuluyor…' : 'Çetinler Merch Hesaplarını Oluştur'}
          </button>
        )}
        {hesapMsg && (
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full border',
            hesapMsg.startsWith('✓') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
          )}>{hesapMsg}</span>
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
            {filtered.map((person, idx) => {
              return (
                <div
                  // Aynı merch birden çok şubede aynı MERCH_ID ile gelebilir → anahtar benzersiz olmalı,
                  // yoksa React filtre değişince eski satırları ekranda bırakıyor
                  key={`${person.id}|${person.cari_adi ?? ''}|${person.sube_adi ?? ''}|${idx}`}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white text-left"
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
                    {/* Süpervizör / Jr. Süpervizör — B2B (SUPERVIZOR / JR_SUPERVIZOR) tek kaynak;
                        değişiklik B2B'de yapılır, tüm ekranlara oradan yansır */}
                    {(person.sup_adi || person.jr_adi) && (
                      <p className="text-[10px] font-medium mt-0.5">
                        {person.sup_adi && <span className="text-gray-500">Süpervizör: {person.sup_adi.replace(/\s+SV$/i, '')}</span>}
                        {person.sup_adi && person.jr_adi && <span className="text-gray-300"> · </span>}
                        {person.jr_adi && <span className="text-violet-600">Jr: {person.jr_adi}</span>}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
