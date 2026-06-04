'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Menu, ChevronLeft, ChevronRight, BarChart2, Plus, X, Trash2,
  MapPin, MessageSquare, Calendar, CalendarDays, CalendarRange,
  FileText, LogOut, Check, TrendingUp, Target, Activity, Store, Users
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns'
import { tr } from 'date-fns/locale'
import clsx from 'clsx'

import { useAuth } from '@/hooks/useAuth'
import { useTeam } from '@/hooks/useTeam'
import { useTasks, useNotes } from '@/hooks/useTasks'
import { Profile, Task } from '@/lib/supabase'
import { TASK_TYPES, VISIT_TYPES, MONTHS_TR, DAYS_SHORT, ROLE_LABELS } from '@/lib/constants'
import { generateVisitReport } from '@/lib/pdf'
import { SelloutView } from '@/components/SelloutView'
import { BsyView } from '@/components/BsyView'
import { BSY_NAME_TO_KOD } from '@/lib/bsy'
import { GenelRaporlarView } from '@/components/GenelRaporlarView'
import { KpiView } from '@/components/KpiView'
import { NoktalarimizView } from '@/components/NoktalarimizView'
import { KullanicilarView } from '@/components/KullanicilarView'
import { SellinSelloutView } from '@/components/SellinSelloutView'
import { AdetPrimTablosu, BayiMerchHakdis } from '@/components/AdetPrimView'
import { AnalizView } from '@/components/AnalizView'
type TabType = 'month' | 'week' | 'day' | 'report' | 'sellout' | 'bsy' | 'kpi' | 'genel-raporlar' | 'noktalar' | 'kullanicilar' | 'sellinout' | 'adet-prim' | 'bayi-merch' | 'analiz'

// Renk hex'ine alpha ekle
function hexWithAlpha(hex: string, alpha: string) {
  return hex + alpha
}

function Avatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const initials = profile.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: profile.color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// GÖREV DETAY SHEET
// ─────────────────────────────────────────────────────
interface TaskSheetProps {
  task: Task | null
  isNew: boolean
  selectedDate: Date
  currentProfile: Profile
  team: Profile[]
  visibleIds: string[]
  onClose: () => void
  onSave: (data: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCheckIn: (taskId: string) => Promise<{ ok: boolean; hasLocation: boolean; hasAddress: boolean }>
}

function TaskSheet({
  task, isNew, selectedDate, currentProfile, team, visibleIds,
  onClose, onSave, onUpdate, onDelete, onCheckIn
}: TaskSheetProps) {
  const { notes, loading: notesLoading, addNote } = useNotes(task?.id ?? null)

  const [pid, setPid] = useState(task?.pid ?? currentProfile.id)
  const [date, setDate] = useState(task?.date ?? format(selectedDate, 'yyyy-MM-dd'))
  const [time, setTime] = useState(task?.time ?? '09:00')
  const [type, setType] = useState(task?.type ?? TASK_TYPES[0])
  const [customer, setCustomer] = useState(task?.customer ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'no_location' | 'no_address' | 'done'>('idle')

  const canEdit = isNew || currentProfile.role === 'admin' || task?.pid === currentProfile.id
  const canAddForOthers = currentProfile.role === 'admin' ||
    currentProfile.role === 'bsy' || currentProfile.role === 'sup'
  const isVisitType = true // tüm türlerde check-in aktif

  const selectablePids = isNew && canAddForOthers
    ? visibleIds
    : [currentProfile.id]

  const handleSave = async () => {
    setSaving(true)
    if (isNew) {
      await onSave({ pid, date, time: time || null, type, customer: customer || null, description: description || null, checkin_ts: null, checkin_lat: null, checkin_lng: null, checkin_by: null, checkin_address: null })
    } else if (task) {
      await onUpdate(task.id, { pid, date, time: time || null, type, customer: customer || null, description: description || null })
    }
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    await onDelete(task.id)
    setDeleting(false)
    onClose()
  }

  const handleCheckIn = async () => {
    if (!task) return
    setCheckingIn(true)
    setLocationStatus('idle')
    const result = await onCheckIn(task.id)
    setCheckingIn(false)
    if (!result.hasLocation) {
      setLocationStatus('no_location')
    } else if (!result.hasAddress) {
      setLocationStatus('no_address')
    } else {
      setLocationStatus('done')
    }
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    await addNote(currentProfile.id, noteText)
    setNoteText('')
  }

  const noteInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full md:w-[480px] md:max-w-full bg-white rounded-t-2xl md:rounded-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Handle */}
        <div className="sticky top-0 bg-white pt-3 pb-2 z-10 border-b border-gray-100">
          <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-2 md:hidden" />
          <div className="flex items-center justify-between px-4">
            <h2 className="font-semibold text-base text-gray-800">
              {isNew ? 'Yeni Görev' : 'Görev Detayı'}
            </h2>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Kişi */}
          {(isNew && canAddForOthers) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kişi</label>
              <select
                value={pid}
                onChange={e => setPid(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              >
                {selectablePids.map(id => {
                  const p = team.find(t => t.id === id)
                  return p ? <option key={id} value={id}>{p.full_name}</option> : null
                })}
              </select>
            </div>
          )}

          {/* Tarih + Saat – tek satır */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Tarih</label>
              <label className="text-sm font-medium text-gray-700">Saat</label>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={!canEdit}
                className="border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {date && (
                <span className="text-sm text-brand-600 font-medium flex-1 truncate">
                  {format(new Date(date + 'T12:00:00'), 'EEEE', { locale: tr })}
                </span>
              )}
              <select
                value={time}
                onChange={e => setTime(e.target.value)}
                disabled={!canEdit}
                className="w-24 flex-shrink-0 border border-gray-300 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                {Array.from({ length: 17 }, (_, h) => h + 7).flatMap(h =>
                  [0, 15, 30, 45].map(m => {
                    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                    return <option key={val} value={val}>{val}</option>
                  })
                )}
              </select>
            </div>
          </div>

          {/* Ziyaret Tipi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ziyaret Tipi</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              disabled={!canEdit}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Müşteri */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri / Şube</label>
            <input
              type="text"
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              disabled={!canEdit}
              placeholder="Müşteri veya şube adı"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="Notlar, açıklama..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
            />
          </div>

          {/* Check-in bölümü */}
          {!isNew && isVisitType && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={14} /> Check-in
              </h3>
              {task?.checkin_ts ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
                  <p className="text-green-700 font-medium text-sm flex items-center gap-1">
                    <Check size={14} /> Check-in yapıldı
                  </p>
                  <p className="text-green-600 text-xs">
                    {format(new Date(task.checkin_ts), 'dd.MM.yyyy HH:mm')}
                  </p>
                  {task.checkin_address ? (
                    <p className="text-green-800 text-xs flex items-start gap-1 mt-1">
                      <MapPin size={11} className="mt-0.5 shrink-0 text-green-600" />
                      <span>{task.checkin_address}</span>
                    </p>
                  ) : task.checkin_lat && task.checkin_lng ? (
                    <a
                      href={`https://maps.google.com/?q=${task.checkin_lat},${task.checkin_lng}`}
                      target="_blank" rel="noreferrer"
                      className="text-blue-500 text-xs underline flex items-center gap-1 mt-1"
                    >
                      <MapPin size={11} /> Haritada gör
                    </a>
                  ) : (
                    <p className="text-amber-600 text-xs flex items-center gap-1 mt-1">
                      ⚠️ Konum kaydedilmedi (izin verilmedi)
                    </p>
                  )}
                </div>
              ) : task?.pid === currentProfile.id ? (
                <div className="space-y-2">
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full flex items-center justify-center gap-2 bg-brand-500 text-white rounded-lg py-2.5 font-medium min-h-[40px] btn-active disabled:opacity-60"
                  >
                    {checkingIn ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Konum alınıyor...</>
                    ) : (
                      <><MapPin size={16} /> Check-in Yap</>
                    )}
                  </button>
                  {locationStatus === 'no_location' && (
                    <p className="text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-1">
                      ⚠️ Konum izni verilmedi. Tarayıcı ayarlarından konum iznini aktif edin ve tekrar deneyin.
                    </p>
                  )}
                  {locationStatus === 'no_address' && (
                    <p className="text-blue-700 text-xs bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-start gap-1">
                      ℹ️ Koordinat kaydedildi, adres dönüştürülemedi.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Henüz check-in yapılmadı.</p>
              )}
            </div>
          )}

          {/* Notlar */}
          {!isNew && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare size={14} /> Notlar
              </h3>
              {notesLoading ? (
                <div className="h-8 shimmer rounded-lg" />
              ) : (
                <div className="space-y-2 mb-3">
                  {notes.length === 0 && (
                    <p className="text-gray-400 text-sm">Henüz not yok.</p>
                  )}
                  {notes.map(n => (
                    <div key={n.id} className="border-l-2 border-brand-500 pl-3 py-1">
                      <p className="text-xs text-gray-400">
                        {n.profiles?.full_name ?? '—'} · {format(new Date(n.created_at), 'dd.MM HH:mm')}
                      </p>
                      <p className="text-sm text-gray-700">{n.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={noteInputRef}
                  type="text"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  placeholder="Not ekle..."
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="bg-brand-500 text-white px-4 rounded-xl font-medium min-h-[46px] disabled:opacity-40"
                >
                  Ekle
                </button>
              </div>
            </div>
          )}

          {/* Aksiyon Butonları */}
          <div className="flex gap-3 pt-2">
            {canEdit ? (
              <>
                {!isNew && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-none flex items-center justify-center gap-1 border border-red-200 text-red-500 rounded-lg px-4 py-2.5 min-h-[40px] btn-active disabled:opacity-60"
                  >
                    <Trash2 size={16} /> Sil
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 min-h-[40px] btn-active"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-brand-500 text-white rounded-lg py-2.5 font-semibold min-h-[40px] btn-active disabled:opacity-60"
                >
                  {saving ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isNew ? 'Kaydediliyor...' : 'Güncelleniyor...'}
                    </span>
                  ) : isNew ? 'Kaydet' : 'Güncelle'}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 min-h-[40px] btn-active"
              >
                Kapat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// SOL SIDEBAR (masaüstü)
// ─────────────────────────────────────────────────────
interface SidebarProps {
  currentProfile: Profile
  team: Profile[]
  visibleIds: string[]
  bsyLinks: { bsy_id: string; sup_id: string }[]
  filterPid: string | null
  taskCounts: Record<string, number>
  onSelect: (pid: string | null) => void
}

function Sidebar({ currentProfile, team, visibleIds, bsyLinks, filterPid, taskCounts, onSelect }: SidebarProps) {
  const [search, setSearch] = useState('')

  const visible = team.filter(p => visibleIds.includes(p.id))
  const filtered = search
    ? visible.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
    : visible

  const bsys = filtered.filter(p => p.role === 'bsy')
  const sups = filtered.filter(p => p.role === 'sup')
  const jrs = filtered.filter(p => p.role === 'jr')
  const admins = filtered.filter(p => p.role === 'admin')

  const renderRow = (p: Profile, indent = false) => (
    <button
      key={p.id}
      onClick={() => onSelect(filterPid === p.id ? null : p.id)}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm',
        indent && 'ml-4',
        filterPid === p.id
          ? 'bg-brand-50 text-brand-700 font-medium'
          : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      <Avatar profile={p} size={28} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium leading-tight">{p.full_name}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{taskCounts[p.id] ?? 0} görev</p>
      </div>
      {filterPid === p.id && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Başlık */}
      <div className="px-3 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ekip</p>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="İsim ara..."
          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500 bg-white"
        />
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* Tümü */}
        <button
          onClick={() => onSelect(null)}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            filterPid === null
              ? 'bg-brand-50 text-brand-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-[9px] flex-shrink-0">
            TÜM
          </div>
          <span className="text-xs font-medium flex-1 text-left">Tüm Ekip</span>
          {filterPid === null && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />}
        </button>

        {/* Admin rolündeyse 2 grup: 1-BSY, 2-SUP+Jr */}
        {currentProfile.role === 'admin' && (
          <>
            {/* GRUP 1: BSY'ler */}
            {bsys.length > 0 && (
              <div className="pt-1">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  1 · Bölge Satış Yöneticileri
                </p>
                {bsys.map(p => renderRow(p))}
              </div>
            )}

            {/* Ayraç */}
            {bsys.length > 0 && sups.length > 0 && (
              <div className="mx-3 my-2 border-t border-gray-200" />
            )}

            {/* GRUP 2: Süpervizörler + Jr'ları */}
            {sups.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  2 · Süpervizörler
                </p>
                {sups.map(sup => (
                  <div key={sup.id}>
                    {renderRow(sup)}
                    {team.filter(jr => jr.role === 'jr' && jr.manager_id === sup.id).map(jr => (
                      <div key={jr.id} className="ml-2 border-l-2 border-gray-100 pl-1">
                        {renderRow(jr)}
                      </div>
                    ))}
                  </div>
                ))}
                {/* Herhangi bir süpervizöre bağlı olmayan Jr'lar */}
                {team.filter(jr => jr.role === 'jr' && !sups.find(s => s.id === jr.manager_id)).map(jr => renderRow(jr))}
              </div>
            )}
          </>
        )}

        {/* BSY rolündeyse: kendisi → bağlı SUP'lar → onların Jr'ları */}
        {currentProfile.role === 'bsy' && (
          <div className="pt-1">
            {renderRow(currentProfile)}
            {(() => {
              const linkedSupIds = bsyLinks
                .filter(l => l.bsy_id === currentProfile.id)
                .map(l => l.sup_id)
              const linkedSups = team.filter(p => p.role === 'sup' && linkedSupIds.includes(p.id))
              return linkedSupIds.length > 0 ? (
                <div className="ml-2 border-l-2 border-gray-100 pl-1 space-y-0.5">
                  {linkedSups.map(sup => (
                    <div key={sup.id}>
                      {renderRow(sup)}
                      {team.filter(p => p.role === 'jr' && p.manager_id === sup.id).map(jr => (
                        <div key={jr.id} className="ml-2 border-l-2 border-gray-50 pl-1">
                          {renderRow(jr)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null
            })()}
          </div>
        )}

        {/* Süpervizör rolündeyse */}
        {currentProfile.role === 'sup' && (
          <div className="pt-1">
            {renderRow(currentProfile)}
            {jrs.filter(jr => jr.manager_id === currentProfile.id).length > 0 && (
              <div className="ml-3 border-l border-gray-200 pl-1">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Jr. Ekibim</p>
                {jrs.filter(jr => jr.manager_id === currentProfile.id).map(jr => renderRow(jr))}
              </div>
            )}
          </div>
        )}

        {/* Jr. Süpervizör */}
        {currentProfile.role === 'jr' && renderRow(currentProfile)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// KİŞİ SEÇİM SHEET
// ─────────────────────────────────────────────────────
interface PersonSheetProps {
  currentProfile: Profile
  team: Profile[]
  visibleIds: string[]
  bsyLinks: { bsy_id: string; sup_id: string }[]
  filterPid: string | null
  taskCounts: Record<string, number>
  onSelect: (pid: string | null) => void
  onClose: () => void
}

function PersonSheet({ currentProfile, team, visibleIds, bsyLinks, filterPid, taskCounts, onSelect, onClose }: PersonSheetProps) {
  const [search, setSearch] = useState('')

  const visible = team.filter(p => visibleIds.includes(p.id))
  const filtered = search
    ? visible.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
    : visible

  const bsys = filtered.filter(p => p.role === 'bsy')
  const sups = filtered.filter(p => p.role === 'sup')
  const jrs = filtered.filter(p => p.role === 'jr')
  const admins = filtered.filter(p => p.role === 'admin')

  const renderRow = (p: Profile, indent = false) => (
    <button
      key={p.id}
      onClick={() => { onSelect(p.id); onClose() }}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left transition-colors',
        indent && 'pl-10',
        filterPid === p.id
          ? 'bg-green-50 border-l-4 border-brand-500'
          : 'border-l-4 border-transparent hover:bg-gray-50'
      )}
    >
      <Avatar profile={p} size={36} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{p.full_name}</p>
        <p className="text-xs text-gray-400">{ROLE_LABELS[p.role]}</p>
      </div>
      <span className="text-xs text-gray-400 font-medium">{taskCounts[p.id] ?? 0} görev</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-lg">Ekip Seçimi</h2>
        <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
      </div>

      <div className="px-4 py-3 border-b">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="İsim ara..."
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Tümü */}
        <button
          onClick={() => { onSelect(null); onClose() }}
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left',
            filterPid === null
              ? 'bg-green-50 border-l-4 border-brand-500'
              : 'border-l-4 border-transparent hover:bg-gray-50'
          )}
        >
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
            TÜM
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800">Tüm Ekip</p>
          </div>
        </button>

        {admins.length > 0 && admins.map(p => renderRow(p))}

        {currentProfile.role === 'admin' && (
          <>
            {bsys.length > 0 && (
              <>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">BSY</p>
                {bsys.map(p => renderRow(p))}
              </>
            )}
            {sups.length > 0 && (
              <>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Süpervizörler</p>
                {sups.map(sup => (
                  <div key={sup.id}>
                    {renderRow(sup)}
                    {jrs.filter(jr => jr.manager_id === sup.id).map(jr => renderRow(jr, true))}
                  </div>
                ))}
              </>
            )}
            {jrs.filter(jr => !sups.find(s => s.id === jr.manager_id)).map(jr => renderRow(jr))}
          </>
        )}

        {currentProfile.role === 'bsy' && (
          <>
            {renderRow(currentProfile)}
            {filtered.filter(p => p.id !== currentProfile.id).length > 0 && (
              <>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Ekibim</p>
                {filtered.filter(p => p.id !== currentProfile.id).map(p => renderRow(p))}
              </>
            )}
          </>
        )}

        {currentProfile.role === 'sup' && (
          <>
            {renderRow(currentProfile)}
            {jrs.filter(p => p.id !== currentProfile.id && p.manager_id === currentProfile.id).length > 0 && (
              <>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Jr. Süpervizörlerim</p>
                {jrs.filter(p => p.manager_id === currentProfile.id).map(p => renderRow(p, true))}
              </>
            )}
          </>
        )}

        {currentProfile.role === 'jr' && renderRow(currentProfile)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// AY GÖRÜNÜMÜ
// ─────────────────────────────────────────────────────
function MonthView({
  year, month, tasks, team, filterPid,
  onDayClick, onTaskClick
}: {
  year: number; month: number; tasks: Task[]; team: Profile[];
  filterPid: string | null;
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}) {
  const firstDay = startOfMonth(new Date(year, month))
  const lastDay = endOfMonth(new Date(year, month))
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })

  // Pazartesi başlangıç (0=Pzt, 6=Paz)
  let startPad = getDay(firstDay) - 1
  if (startPad < 0) startPad = 6

  const profileMap = new Map(team.map(p => [p.id, p]))

  const dayTasks = (date: Date): Task[] =>
    tasks.filter(t =>
      t.date === format(date, 'yyyy-MM-dd') &&
      (!filterPid || t.pid === filterPid)
    )

  const hasNote = (t: Task) => false // notes ayrı query gerekeceği için basit

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Gün başlıkları */}
      <div className="grid grid-cols-7 border-b sticky top-0 bg-white z-10">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Günler */}
      <div className="grid grid-cols-7">
        {/* Boş kutular */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-[68px] border-b border-r border-gray-100" />
        ))}

        {days.map(day => {
          const dt = dayTasks(day)
          const isWeekend = getDay(day) === 0 || getDay(day) === 6
          const today = isToday(day)
          const shown = dt.slice(0, 2)
          const extra = dt.length - 2

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={clsx(
                'min-h-[68px] border-b border-r border-gray-100 p-1 cursor-pointer',
                isWeekend && 'bg-gray-50',
              )}
            >
              <div className="flex justify-end mb-0.5">
                <span
                  className={clsx(
                    'text-xs w-6 h-6 flex items-center justify-center rounded-full',
                    today
                      ? 'bg-brand-500 text-white font-bold'
                      : 'text-gray-700'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-0.5">
                {shown.map(t => {
                  const p = profileMap.get(t.pid)
                  if (!p) return null
                  return (
                    <div
                      key={t.id}
                      onClick={e => { e.stopPropagation(); onTaskClick(t) }}
                      className="text-xs rounded px-1 py-0.5 border-l-2 truncate"
                      style={{
                        backgroundColor: hexWithAlpha(p.color, '22'),
                        borderLeftColor: p.color,
                        color: p.color,
                      }}
                    >
                      {t.checkin_ts && '✓ '}{t.customer ?? t.type}
                    </div>
                  )
                })}
                {extra > 0 && (
                  <div className="text-xs text-gray-400 pl-1">+{extra}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// HAFTA GÖRÜNÜMÜ
// ─────────────────────────────────────────────────────
function WeekView({
  date, tasks, team, filterPid, onTaskClick
}: {
  date: Date; tasks: Task[]; team: Profile[]; filterPid: string | null;
  onTaskClick: (task: Task) => void;
}) {
  const profileMap = new Map(team.map(p => [p.id, p]))

  // Haftanın ilk günü (Pazartesi)
  const day = getDay(date)
  const diff = day === 0 ? -6 : 1 - day
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() + diff)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 08-18

  const tasksForDayHour = (d: Date, h: number) =>
    tasks.filter(t => {
      if (t.date !== format(d, 'yyyy-MM-dd')) return false
      if (filterPid && t.pid !== filterPid) return false
      if (!t.time) return h === 8
      return parseInt(t.time.split(':')[0]) === h
    })

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[560px]">
        {/* Gün başlıkları */}
        <div className="grid grid-cols-8 border-b sticky top-0 bg-white z-10">
          <div className="border-r" />
          {weekDays.map((d, i) => {
            const isWeekend = i >= 5
            return (
              <div
                key={i}
                className={clsx(
                  'text-center py-2 border-r text-xs font-medium',
                  isWeekend ? 'bg-gray-50 text-gray-400' : 'text-gray-600',
                  isToday(d) && 'text-brand-600 font-bold'
                )}
              >
                <div>{DAYS_SHORT[i]}</div>
                <div className={clsx(
                  'w-6 h-6 mx-auto rounded-full flex items-center justify-center',
                  isToday(d) && 'bg-brand-500 text-white'
                )}>
                  {format(d, 'd')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Saatler */}
        {hours.map(h => (
          <div key={h} className="grid grid-cols-8 border-b min-h-[56px]">
            <div className="border-r text-right pr-2 pt-1 text-xs text-gray-400">
              {h}:00
            </div>
            {weekDays.map((d, i) => {
              const isWeekend = i >= 5
              const ts = tasksForDayHour(d, h)
              return (
                <div
                  key={i}
                  className={clsx('border-r p-0.5', isWeekend && 'bg-gray-50')}
                >
                  {ts.map(t => {
                    const p = profileMap.get(t.pid)
                    if (!p) return null
                    return (
                      <div
                        key={t.id}
                        onClick={() => onTaskClick(t)}
                        className="text-xs rounded px-1 py-0.5 border-l-2 truncate cursor-pointer mb-0.5"
                        style={{
                          backgroundColor: hexWithAlpha(p.color, '22'),
                          borderLeftColor: p.color,
                          color: p.color,
                        }}
                      >
                        {t.checkin_ts && '✓ '}{t.customer ?? t.type}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// GÜN GÖRÜNÜMÜ
// ─────────────────────────────────────────────────────
function DayView({
  date, tasks, team, filterPid, onTaskClick
}: {
  date: Date; tasks: Task[]; team: Profile[]; filterPid: string | null;
  onTaskClick: (task: Task) => void;
}) {
  const profileMap = new Map(team.map(p => [p.id, p]))
  const dateStr = format(date, 'yyyy-MM-dd')
  const hours = Array.from({ length: 11 }, (_, i) => i + 8)

  const dayTasks = tasks.filter(t =>
    t.date === dateStr && (!filterPid || t.pid === filterPid)
  )

  const tasksForHour = (h: number) =>
    dayTasks.filter(t => {
      if (!t.time) return h === 8
      return parseInt(t.time.split(':')[0]) === h
    })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold text-gray-800">
          {format(date, 'dd MMMM yyyy', { locale: tr })}
        </p>
        <p className="text-sm text-gray-400">{dayTasks.length} görev</p>
      </div>

      {hours.map(h => {
        const ts = tasksForHour(h)
        return (
          <div key={h} className="flex border-b min-h-[56px]">
            <div className="w-16 flex-shrink-0 text-right pr-3 pt-3 text-xs text-gray-400 border-r">
              {h}:00
            </div>
            <div className="flex-1 p-1 space-y-1">
              {ts.map(t => {
                const p = profileMap.get(t.pid)
                if (!p) return null
                return (
                  <div
                    key={t.id}
                    onClick={() => onTaskClick(t)}
                    className="w-full rounded-lg px-3 py-2 border-l-4 cursor-pointer"
                    style={{
                      backgroundColor: hexWithAlpha(p.color, '15'),
                      borderLeftColor: p.color,
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: p.color }}>
                      {t.checkin_ts && '✓ '}{t.type}
                      {t.customer && ` — ${t.customer}`}
                    </p>
                    <p className="text-xs text-gray-400">{p.full_name}{t.time ? ` · ${t.time}` : ''}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// RAPOR GÖRÜNÜMÜ
// ─────────────────────────────────────────────────────
function ReportView({
  tasks, team, year, month, filterPid, filterName
}: {
  tasks: Task[]; team: Profile[]; year: number; month: number;
  filterPid: string | null; filterName?: string;
}) {
  const visitTasks = tasks.filter(t =>
    VISIT_TYPES.includes(t.type) && (!filterPid || t.pid === filterPid)
  )
  const allTasks = tasks.filter(t => !filterPid || t.pid === filterPid)
  const checkinTasks = visitTasks.filter(t => t.checkin_ts)
  const uniqueCustomers = new Set(visitTasks.map(t => t.customer).filter(Boolean)).size

  const profileMap = new Map(team.map(p => [p.id, p]))

  const customerMap = new Map<string, { visit: number; checkin: number }>()
  visitTasks.forEach(t => {
    const key = t.customer ?? 'Belirtilmemiş'
    const ex = customerMap.get(key) ?? { visit: 0, checkin: 0 }
    ex.visit++
    if (t.checkin_ts) ex.checkin++
    customerMap.set(key, ex)
  })

  const handlePdf = () => {
    const filteredProfiles = filterPid
      ? team.filter(p => p.id === filterPid)
      : team
    generateVisitReport(allTasks, filteredProfiles, year, month, filterName)
  }

  const kpis = [
    { label: 'Toplam Görev', value: allTasks.length, color: 'bg-brand-700' },
    { label: 'Ziyaret', value: visitTasks.length, color: 'bg-brand-600' },
    { label: 'Check-in', value: checkinTasks.length, color: 'bg-brand-500' },
    { label: 'Unique Nokta', value: uniqueCustomers, color: 'bg-green-600' },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      {/* PDF Butonu */}
      <button
        onClick={handlePdf}
        className="w-full flex items-center justify-center gap-2 bg-brand-700 text-white rounded-xl py-3 font-medium min-h-[46px] btn-active"
      >
        <FileText size={16} /> PDF İndir
      </button>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={clsx('rounded-xl p-4 text-white', k.color)}>
            <p className="text-2xl font-bold">{k.value}</p>
            <p className="text-xs opacity-80 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Ziyaret Listesi */}
      {visitTasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Ziyaret Listesi</h3>
          <div className="space-y-2">
            {visitTasks
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(t => {
                const p = profileMap.get(t.pid)
                if (!p) return null
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 rounded-xl p-3 border border-gray-100"
                  >
                    <div
                      className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {t.customer ?? t.type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.full_name} · {format(new Date(t.date), 'dd.MM.yyyy')}{t.time ? ` · ${t.time}` : ''} · {t.type}
                      </p>
                      {t.checkin_ts && (
                        <div className="mt-1 flex items-start gap-1 flex-wrap">
                          <span className="text-xs text-green-700 font-medium flex items-center gap-0.5 whitespace-nowrap">
                            <Check size={10} className="text-green-600" />
                            {format(new Date(t.checkin_ts), 'HH:mm')}
                          </span>
                          {t.checkin_address ? (
                            <span className="text-xs text-gray-500 flex items-start gap-0.5">
                              <MapPin size={10} className="mt-0.5 shrink-0 text-green-500" />
                              {t.checkin_address}
                            </span>
                          ) : t.checkin_lat && t.checkin_lng ? (
                            <a
                              href={`https://maps.google.com/?q=${t.checkin_lat},${t.checkin_lng}`}
                              target="_blank" rel="noreferrer"
                              className="text-xs text-blue-500 underline flex items-center gap-0.5"
                            >
                              <MapPin size={10} /> Haritada gör
                            </a>
                          ) : (
                            <span className="text-xs text-amber-500 flex items-center gap-0.5">
                              <MapPin size={10} /> Konum izni verilmedi
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Şube Özet */}
      {customerMap.size > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Şube Bazlı Özet</h3>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-4 bg-brand-700 text-white text-xs font-medium px-3 py-2">
              <span className="col-span-2">Şube</span>
              <span className="text-center">Ziyaret</span>
              <span className="text-center">CI</span>
            </div>
            {Array.from(customerMap.entries())
              .sort((a, b) => b[1].visit - a[1].visit)
              .map(([name, stats], i) => (
                <div
                  key={name}
                  className={clsx(
                    'grid grid-cols-4 px-3 py-2 text-sm',
                    i % 2 === 0 ? 'bg-white' : 'bg-green-50'
                  )}
                >
                  <span className="col-span-2 truncate text-gray-700">{name}</span>
                  <span className="text-center text-gray-600">{stats.visit}</span>
                  <span className="text-center text-green-600 font-medium">{stats.checkin}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// İSTATİSTİK SHEET
// ─────────────────────────────────────────────────────
// Hedef ziyaret noktaları (isim → hedef)
const VISIT_TARGETS: Record<string, number> = {
  'Nagihan Erdönmez': 60,
  'Duygu Duman':      60,
  'Tuğba Ayata':      60,
  'Merve İnci':       60,
  'Atilla YILMAZ':    40,
  'Burak Alagöz':     60,
  'Gülcan Bayer':     60,
  'Songül Durukan':   60,
  'Sinem Bektaş':     60,
  'Pınar Güler':      60,
}

function StatsSheet({ tasks, team, visibleIds, onClose }: {
  tasks: Task[]; team: Profile[]; visibleIds: string[]; onClose: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  const visibleTasks = tasks.filter(t => visibleIds.includes(t.pid))
  const checkinTasks = visibleTasks.filter(t => t.checkin_ts)

  // KPI: Toplam + Check-in + her görev türü
  const kpis = [
    { label: 'Toplam Görev', value: visibleTasks.length, filter: null, color: 'bg-brand-700' },
    { label: 'Check-in', value: checkinTasks.length, filter: '__checkin__', color: 'bg-brand-600' },
    ...TASK_TYPES.map(type => ({
      label: type,
      value: visibleTasks.filter(t => t.type === type).length,
      filter: type,
      color: 'bg-brand-700',
    })),
  ]

  // Aktif filtreye göre görev listesi
  const filteredTasks = activeFilter === '__checkin__'
    ? checkinTasks
    : activeFilter
      ? visibleTasks.filter(t => t.type === activeFilter)
      : visibleTasks

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:w-[600px] bg-white rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white pt-3 pb-2 z-10 border-b border-gray-100">
          <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-2 md:hidden" />
          <div className="flex items-center justify-between px-4">
            <h2 className="font-semibold text-base">İstatistikler</h2>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 pb-6 space-y-5">
          {/* KPI grid — tıklanabilir filtreler */}
          <div className="grid grid-cols-2 gap-2">
            {kpis.map(k => {
              const isActive = activeFilter === k.filter
              return (
                <button
                  key={k.label}
                  onClick={() => setActiveFilter(isActive ? null : k.filter)}
                  className={clsx(
                    'rounded-xl p-3 text-left transition-all border-2',
                    isActive
                      ? 'bg-brand-600 text-white border-brand-400 shadow-md scale-[0.98]'
                      : 'bg-brand-700 text-white border-transparent hover:border-brand-400'
                  )}
                >
                  <p className="text-2xl font-bold leading-none">{k.value}</p>
                  <p className="text-xs opacity-75 mt-1 leading-tight">{k.label}</p>
                </button>
              )
            })}
          </div>

          {/* Aktif filtre etiketi */}
          {activeFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-brand-50 text-brand-700 font-medium px-2 py-1 rounded-full">
                {activeFilter === '__checkin__' ? 'Check-in yapılanlar' : activeFilter}
              </span>
              <button onClick={() => setActiveFilter(null)} className="text-xs text-gray-400 hover:text-gray-600">
                × Filtreyi kaldır
              </button>
            </div>
          )}

          {/* Hedef Ziyaret Noktası Tablosu */}
          {(() => {
            const targetRows = team
              .filter(p => VISIT_TARGETS[p.full_name] !== undefined && visibleIds.includes(p.id))
              .map(p => ({
                profile: p,
                target: VISIT_TARGETS[p.full_name],
                actual: visibleTasks.filter(t => t.pid === p.id && !!t.checkin_ts).length,
              }))
              .sort((a, b) => b.actual - a.actual)

            if (targetRows.length === 0) return null

            const selectedProfile = selectedPersonId
              ? team.find(p => p.id === selectedPersonId) ?? null
              : null
            const personTasks = selectedPersonId
              ? visibleTasks
                  .filter(t => t.pid === selectedPersonId)
                  .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
              : []

            const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

            return (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">Hedef Ziyaret Noktası</h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Kişi</th>
                        <th className="text-center px-3 py-2 text-gray-500 font-medium">Hedef</th>
                        <th className="text-center px-3 py-2 text-gray-500 font-medium">Gerçekleşen</th>
                        <th className="text-center px-3 py-2 text-gray-500 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetRows.map(({ profile: p, target, actual }) => {
                        const pct = Math.min(Math.round((actual / target) * 100), 100)
                        const isOk = pct >= 80
                        const isSelected = selectedPersonId === p.id
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPersonId(isSelected ? null : p.id)}
                            className={clsx(
                              'border-b border-gray-100 last:border-0 cursor-pointer transition-colors',
                              isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Avatar profile={p} size={22} />
                                <span className={clsx('truncate', isSelected ? 'text-brand-700 font-semibold' : 'text-gray-700')}>{p.full_name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">{target}</td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-800">{actual}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={clsx(
                                'px-1.5 py-0.5 rounded-full font-medium text-[10px]',
                                isOk ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                              )}>
                                %{pct}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Seçili kişinin görev detayları */}
                {selectedProfile && (
                  <div className="rounded-xl border border-brand-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border-b border-brand-100">
                      <Avatar profile={selectedProfile} size={20} />
                      <span className="text-xs font-semibold text-brand-800">{selectedProfile.full_name} — Görevler</span>
                      <button
                        onClick={() => setSelectedPersonId(null)}
                        className="ml-auto text-brand-400 hover:text-brand-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {personTasks.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-3 text-center">Bu ay görev yok.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {personTasks.map(t => {
                          const d = new Date(t.date + 'T00:00:00')
                          const dayName = DAY_NAMES[d.getDay()]
                          const dateLabel = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${dayName}`
                          const checkinTime = t.checkin_ts
                            ? format(new Date(t.checkin_ts), 'HH:mm')
                            : null
                          return (
                            <div key={t.id} className="px-3 py-2.5">
                              {/* Üst satır: tarih, saat, tür, müşteri */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{dateLabel}</span>
                                {t.time && <span className="text-xs text-gray-400">{t.time}</span>}
                                <span className="text-xs text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">{t.type}</span>
                                {t.customer && <span className="text-xs text-gray-500 truncate max-w-[120px]">{t.customer}</span>}
                              </div>
                              {/* Alt satır: check-in bilgisi ve adres */}
                              {checkinTime ? (
                                <div className="mt-1.5 flex items-start gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-green-700 font-medium text-xs whitespace-nowrap">
                                    <Check size={10} className="text-green-600" /> {checkinTime}
                                  </span>
                                  {t.checkin_address ? (
                                    <span className="text-xs text-gray-600 flex items-start gap-1">
                                      <MapPin size={10} className="mt-0.5 shrink-0 text-green-600" />
                                      <span>{t.checkin_address}</span>
                                    </span>
                                  ) : t.checkin_lat && t.checkin_lng ? (
                                    <a
                                      href={`https://maps.google.com/?q=${t.checkin_lat},${t.checkin_lng}`}
                                      target="_blank" rel="noreferrer"
                                      className="text-xs text-blue-500 underline flex items-center gap-1"
                                    >
                                      <MapPin size={10} /> Haritada gör
                                    </a>
                                  ) : (
                                    <span className="text-xs text-amber-500 flex items-center gap-1">
                                      <MapPin size={10} /> Konum izni verilmedi
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1 text-xs text-gray-300">Check-in yapılmadı</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// ANA SAYFA
// ─────────────────────────────────────────────────────
export default function AppPage() {
  const router = useRouter()
  const { profile: currentProfile, loading: authLoading, signOut } = useAuth()
  const { team, bsyLinks, loading: teamLoading, visibleIds, profileById } = useTeam(currentProfile)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [tab, setTab] = useState<TabType>('month')
  const [filterPid, setFilterPid] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(now)

  const ids = visibleIds()
  const { tasks, loading: tasksLoading, addTask, updateTask, deleteTask, checkIn } = useTasks(ids, year, month)

  const [showPersonSheet, setShowPersonSheet] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [taskSheet, setTaskSheet] = useState<{ task: Task | null; isNew: boolean } | null>(null)

  // BSY Hedef Takip sekmesi sadece admin/bsy rollerine görünür
  const isBsyOrAdmin = currentProfile?.role === 'admin'
    || currentProfile?.role === 'bsy'
  const isBsy = currentProfile?.role === 'bsy'
  const isSup = currentProfile?.role === 'sup'

  // Süpervizör ve Jr. Süpervizör → sadece Sellout + Noktalarımız
  const isSupOrJr = currentProfile?.role === 'sup' || currentProfile?.role === 'jr'

  // Primler sayfası filtreleri
  const { primSupervisorFilter, primBsyKod } = useMemo(() => {
    if (!currentProfile) return { primSupervisorFilter: [] as string[], primBsyKod: null as string | null }
    if (currentProfile.role === 'admin') return { primSupervisorFilter: null, primBsyKod: null }
    if (currentProfile.role === 'sup') return { primSupervisorFilter: [currentProfile.full_name], primBsyKod: null }
    if (currentProfile.role === 'bsy') {
      // BSY_NAME_TO_KOD: lowercase isim → kod (KB1, IB1, vb.)
      const bsyKod = BSY_NAME_TO_KOD[currentProfile.full_name.toLocaleLowerCase('tr')] ?? null
      return { primSupervisorFilter: null, primBsyKod: bsyKod }
    }
    return { primSupervisorFilter: [] as string[], primBsyKod: null as string | null }
  }, [currentProfile])

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !currentProfile) {
      router.replace('/login')
    }
  }, [authLoading, currentProfile, router])

  // sup/jr için varsayılan sekme: sellout, bsy için: bsy, admin için: month
  useEffect(() => {
    if (isSupOrJr) setTab('sellout')
    else if (isBsy) setTab('bsy')
    else if (currentProfile?.role === 'admin') setTab('month')
  }, [isSupOrJr, isBsy, currentProfile?.role])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const taskCounts: Record<string, number> = {}
  tasks.forEach(t => {
    taskCounts[t.pid] = (taskCounts[t.pid] ?? 0) + 1
  })

  const filterName = filterPid ? profileById(filterPid)?.full_name : undefined

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setTab('day')
  }

  const handleTaskClick = (task: Task) => {
    setTaskSheet({ task, isNew: false })
  }

  const handleAddTask = () => {
    setTaskSheet({ task: null, isNew: true })
  }

  const handleSaveTask = async (data: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    await addTask(data)
  }

  const handleUpdateTask = async (id: string, data: Partial<Task>) => {
    await updateTask(id, data)
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
  }

  const handleCheckIn = async (taskId: string) => {
    if (!currentProfile) return { ok: false, hasLocation: false, hasAddress: false }
    return checkIn(taskId, currentProfile.id)
  }

  if (authLoading || teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-700">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentProfile) return null

  return (
    <div className="flex h-screen bg-white safe-top">

      {/* Sol Sidebar – sadece masaüstü */}
      <aside className="hidden md:flex flex-col w-56 border-r border-gray-200 bg-gray-50 shrink-0">
        <div className="px-3 py-3 border-b border-gray-200 flex items-center gap-2">
          <Avatar profile={currentProfile} size={28} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{currentProfile.full_name}</p>
            <p className="text-[10px] text-gray-400">{ROLE_LABELS[currentProfile.role]}</p>
          </div>
          <button onClick={async () => { await signOut(); router.replace('/login') }} className="p-1 text-gray-400 hover:text-gray-600" title="Çıkış">
            <LogOut size={14} />
          </button>
        </div>
        <Sidebar
          currentProfile={currentProfile}
          team={team}
          visibleIds={ids}
          bsyLinks={bsyLinks}
          filterPid={filterPid}
          taskCounts={taskCounts}
          onSelect={setFilterPid}
        />
      </aside>

      {/* Sağ: Ana içerik */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Bar */}
        <div className="border-b bg-white sticky top-0 z-20">
          {/* Ana satır */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Mobil: hamburger + filtre adı */}
            <button
              onClick={() => setShowPersonSheet(true)}
              className="p-2 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center md:hidden"
            >
              <Menu size={20} />
            </button>
            <button
              onClick={() => setShowPersonSheet(true)}
              className="text-left text-sm font-medium text-gray-700 truncate md:hidden flex-1"
            >
              {filterPid ? profileById(filterPid)?.full_name : 'Tüm Ekip'}
            </button>

            {/* Masaüstü: Gruplu Tab sekmeleri */}
            <div className="hidden md:flex items-center gap-1 mr-2">
              {/* Takvim grubu (admin) */}
              {currentProfile?.role === 'admin' && (
                <button
                  onClick={() => { if (!['month','week','day'].includes(tab)) setTab('month') }}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    ['month','week','day'].includes(tab) ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <Calendar size={15} /> Takvim
                </button>
              )}
              {/* Rapor (admin) */}
              {currentProfile?.role === 'admin' && (
                <button
                  onClick={() => setTab('report')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    tab === 'report' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <FileText size={15} /> Rapor
                </button>
              )}
              {/* BSY grubu */}
              {isBsyOrAdmin && (
                <button
                  onClick={() => { if (!['bsy','kpi','genel-raporlar'].includes(tab)) setTab('bsy') }}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    ['bsy','kpi','genel-raporlar'].includes(tab) ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <Target size={15} /> BSY
                </button>
              )}
              {/* S.In/Out */}
              {isBsyOrAdmin && (
                <button
                  onClick={() => setTab('sellinout')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    tab === 'sellinout' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <BarChart2 size={15} /> S.In/Out
                </button>
              )}
              {/* Sellout */}
              <button
                onClick={() => setTab('sellout')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  tab === 'sellout' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <TrendingUp size={15} /> Sellout
              </button>
              {/* Noktalarımız grubu */}
              <button
                onClick={() => { if (!['noktalar','kullanicilar'].includes(tab)) setTab('noktalar') }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  ['noktalar','kullanicilar'].includes(tab) ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <Store size={15} /> Noktalarımız
              </button>

              {/* Satış Analizi — admin + BSY */}
              {isBsyOrAdmin && (
                <button
                  onClick={() => setTab('analiz')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    tab === 'analiz' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <BarChart2 size={15} /> Analiz
                </button>
              )}
              {/* Primler — admin + BSY + Süpervizör */}
              {(currentProfile?.role === 'admin' || isBsy || isSup) && (
                <button
                  onClick={() => { if (!['adet-prim','bayi-merch'].includes(tab)) setTab('adet-prim') }}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    ['adet-prim','bayi-merch'].includes(tab) ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <Activity size={15} /> Primler
                </button>
              )}
            </div>

            {/* Ay navigasyon */}
            {['month','week','day'].includes(tab) && (
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="p-2 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                  {MONTHS_TR[month]} {year}
                </span>
                <button onClick={nextMonth} className="p-2 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {currentProfile?.role === 'admin' && (
              <button
                onClick={() => setShowStats(true)}
                className="p-2 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <BarChart2 size={20} />
              </button>
            )}
          </div>

          {/* Alt sekmeler satırı (gruplu sekmelerde gösterilir) */}
          {/* Takvim alt sekmeleri */}
          {currentProfile?.role === 'admin' && ['month','week','day'].includes(tab) && (
            <div className="hidden md:flex items-center gap-1 px-3 pb-1.5">
              {([
                { key: 'month' as const, icon: Calendar,     label: 'Ay' },
                { key: 'week'  as const, icon: CalendarRange, label: 'Hafta' },
                { key: 'day'   as const, icon: CalendarDays,  label: 'Gün' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    tab === key ? 'bg-brand-100 text-brand-700' : 'text-gray-400 hover:bg-gray-100'
                  )}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          )}
          {/* BSY alt sekmeleri */}
          {isBsyOrAdmin && ['bsy','kpi','genel-raporlar'].includes(tab) && (
            <div className="hidden md:flex items-center gap-1 px-3 pb-1.5">
              {([
                { key: 'bsy'            as const, icon: Target,   label: 'Ciro ve Tahsilat Takip' },
                { key: 'kpi'            as const, icon: Activity,  label: 'Özel Hedefler' },
                { key: 'genel-raporlar' as const, icon: BarChart2, label: 'Genel Raporlar' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    tab === key ? 'bg-brand-100 text-brand-700' : 'text-gray-400 hover:bg-gray-100'
                  )}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          )}
          {/* Primler alt sekmeleri (admin) */}
          {(currentProfile?.role === 'admin' || isBsy || isSup) && ['adet-prim','bayi-merch'].includes(tab) && (
            <div className="hidden md:flex items-center gap-1 px-3 pb-1.5">
              {([
                { key: 'adet-prim' as const,  label: 'Adet Prim Tablosu' },
                { key: 'bayi-merch' as const,  label: 'Bayi Merch Prim Hakedişleri' },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    tab === key ? 'bg-brand-100 text-brand-700' : 'text-gray-400 hover:bg-gray-100'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* Noktalarımız alt sekmeleri */}
          {['noktalar','kullanicilar'].includes(tab) && (
            <div className="hidden md:flex items-center gap-1 px-3 pb-1.5">
              {([
                { key: 'noktalar'     as const, icon: Store, label: 'Noktalarımız' },
                { key: 'kullanicilar' as const, icon: Users, label: 'Kullanıcılar' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    tab === key ? 'bg-brand-100 text-brand-700' : 'text-gray-400 hover:bg-gray-100'
                  )}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

      {/* İçerik */}
      {tasksLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'month' && (
            <MonthView
              year={year} month={month} tasks={tasks} team={team}
              filterPid={filterPid} onDayClick={handleDayClick} onTaskClick={handleTaskClick}
            />
          )}
          {tab === 'week' && (
            <WeekView
              date={selectedDate} tasks={tasks} team={team}
              filterPid={filterPid} onTaskClick={handleTaskClick}
            />
          )}
          {tab === 'day' && (
            <DayView
              date={selectedDate} tasks={tasks} team={team}
              filterPid={filterPid} onTaskClick={handleTaskClick}
            />
          )}
          {tab === 'report' && (
            <ReportView
              tasks={tasks} team={team} year={year} month={month}
              filterPid={filterPid} filterName={filterName}
            />
          )}
          {tab === 'sellout' && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <SelloutView
                currentProfile={currentProfile}
                team={team}
                visibleIds={ids}
                active={tab === 'sellout'}
              />
            </div>
          )}
          {tab === 'bsy' && isBsyOrAdmin && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <BsyView
                isAdmin={currentProfile?.role === 'admin'}
                isBsy={isBsy}
                bsyAdi={isBsy ? (currentProfile?.full_name ?? '') : ''}
              />
            </div>
          )}
          {tab === 'sellinout' && isBsyOrAdmin && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <SellinSelloutView currentProfile={currentProfile} active={tab === 'sellinout'} />
            </div>
          )}
          {tab === 'kpi' && isBsyOrAdmin && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <KpiView />
            </div>
          )}
          {tab === 'genel-raporlar' && isBsyOrAdmin && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <GenelRaporlarView />
            </div>
          )}
          {tab === 'noktalar' && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <NoktalarimizView
                currentProfile={currentProfile}
                team={team}
                bsyLinks={bsyLinks}
              />
            </div>
          )}
          {tab === 'kullanicilar' && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <KullanicilarView
                currentProfile={currentProfile}
                team={team}
                bsyLinks={bsyLinks}
              />
            </div>
          )}
          {tab === 'analiz' && isBsyOrAdmin && currentProfile && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <AnalizView currentProfile={currentProfile} active={tab === 'analiz'} />
            </div>
          )}
          {tab === 'adet-prim' && (currentProfile?.role === 'admin' || isBsy || isSup) && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <AdetPrimTablosu isAdmin={currentProfile?.role === 'admin'} />
            </div>
          )}
          {tab === 'bayi-merch' && (currentProfile?.role === 'admin' || isBsy || isSup) && (
            <div className="flex-1 overflow-hidden flex flex-col h-full">
              <BayiMerchHakdis
                supervisorFilter={primSupervisorFilter}
                bsyKodFilter={primBsyKod}
              />
            </div>
          )}
        </>
      )}

      {/* FAB — sadece admin takvim sekmelerinde görünür */}
      {currentProfile?.role === 'admin' && tab !== 'report' && tab !== 'sellout' && tab !== 'bsy' && tab !== 'kpi' && tab !== 'genel-raporlar' && tab !== 'noktalar' && tab !== 'kullanicilar' && tab !== 'sellinout' && tab !== 'adet-prim' && tab !== 'bayi-merch' && tab !== 'analiz' && (
        <button
          onClick={handleAddTask}
          className="fixed bottom-24 md:bottom-6 right-4 w-12 h-12 md:w-14 md:h-14 bg-brand-500 rounded-full shadow-lg flex items-center justify-center text-white z-30 btn-active safe-bottom"
        >
          <Plus size={22} />
        </button>
      )}

      {/* Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-20 safe-bottom">
        <div className={clsx(
          'grid h-16',
          currentProfile?.role === 'jr'   ? 'grid-cols-4'  :
          isSup                            ? 'grid-cols-5'  :
          isBsy                            ? 'grid-cols-9'  :
          currentProfile?.role === 'admin' ? 'grid-cols-13' : 'grid-cols-8'
        )}>
          {([
            ...(currentProfile?.role === 'admin' ? [
              { key: 'month'   as const, icon: Calendar,      label: 'Ay'      },
              { key: 'week'    as const, icon: CalendarRange,  label: 'Hafta'   },
              { key: 'day'     as const, icon: CalendarDays,   label: 'Gün'     },
              { key: 'report'  as const, icon: FileText,       label: 'Rapor'   },
            ] : []),
            ...(isBsyOrAdmin ? [{ key: 'bsy'       as const, icon: Target,    label: 'BSY'     }] : []),
            ...(isBsyOrAdmin ? [{ key: 'sellinout'  as const, icon: BarChart2, label: 'S.In/Out'}] : []),
            { key: 'sellout' as const, icon: TrendingUp, label: 'Sellout' },
            ...(isBsyOrAdmin ? [{ key: 'analiz'    as const, icon: BarChart2, label: 'Analiz'  }] : []),
            ...(isBsyOrAdmin ? [{ key: 'kpi'       as const, icon: Activity,  label: 'KPI'     }] : []),
            ...((currentProfile?.role === 'admin' || isBsy || isSup)
              ? [{ key: 'bayi-merch' as const, icon: Activity, label: 'Primler' }] : []),
            { key: 'noktalar'     as const, icon: Store, label: 'Noktalar'  },
            { key: 'kullanicilar' as const, icon: Users, label: 'Kullanıcı' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                tab === key ? 'text-brand-500' : 'text-gray-400'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
          <button
            onClick={async () => { await signOut(); router.replace('/login') }}
            className="flex flex-col items-center justify-center gap-0.5 text-xs text-gray-400"
          >
            <LogOut size={20} />
            <span className="text-[10px]">Çıkış</span>
          </button>
        </div>
      </div>

      {/* Sheets */}
      {showPersonSheet && currentProfile && (
        <PersonSheet
          currentProfile={currentProfile}
          team={team}
          visibleIds={ids}
          bsyLinks={bsyLinks}
          filterPid={filterPid}
          taskCounts={taskCounts}
          onSelect={setFilterPid}
          onClose={() => setShowPersonSheet(false)}
        />
      )}

      {showStats && (
        <StatsSheet
          tasks={tasks}
          team={team}
          visibleIds={ids}
          onClose={() => setShowStats(false)}
        />
      )}

      {taskSheet && currentProfile && (
        <TaskSheet
          task={taskSheet.task}
          isNew={taskSheet.isNew}
          selectedDate={selectedDate}
          currentProfile={currentProfile}
          team={team}
          visibleIds={ids}
          onClose={() => setTaskSheet(null)}
          onSave={handleSaveTask}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onCheckIn={handleCheckIn}
        />
      )}
      </div>
    </div>
  )
}
