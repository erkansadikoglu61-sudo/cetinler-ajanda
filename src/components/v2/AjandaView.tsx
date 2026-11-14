'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, MapPin, Search, Check, Trash2, Pencil, Store, Clock, AlertCircle,
  MessageSquare, Send, Target,
} from 'lucide-react'
import clsx from 'clsx'
import { supabase, type Task, type TaskNote } from '@/lib/supabase'
import { TASK_TYPES } from '@/lib/constants'
import { checkinKonumu } from '@/lib/checkin'
import { sadeAd } from '@/lib/v2/nokta'
import { donemdeAktif } from '@/lib/sellout'
import { ziyaretHedefi } from '@/lib/ziyaretHedef'
import { TalepModal } from './Talepler'

// v2 Ajanda — haftalık görünüm + görev penceresi.
// Görev penceresinin şube listesi Şubelerim ile aynı kaynaktan gelir
// (/api/v2/gorev-subeleri); listede olmayan şube için "Eksik şube bildir".
// Görev kaydı v1 ile aynı tablo ve biçimde (customer = "Cari / Şube").

export interface AjandaKisi { id: string; ad: string; rol: string }

interface Props {
  /** Görevleri görünen kişiler (ilk eleman: bakılan kullanıcı) */
  kisiler: AjandaKisi[]
  /** Oturumdaki gerçek kullanıcı */
  oturum: { id: string; rol: string }
  /** Bakılan kullanıcının rolü (Bayi Ziyareti kısıtı vb.) */
  benRol: string
  gorunum: string
}

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const AYLAR_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function isoGun(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function haftaBasi(d: Date): Date {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const gun = (t.getDay() + 6) % 7   // Pazartesi = 0
  t.setDate(t.getDate() - gun)
  return t
}
function gunEkle(d: Date, n: number): Date {
  const t = new Date(d)
  t.setDate(t.getDate() + n)
  return t
}
function trTarih(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// ─── Şube seçici ───────────────────────────────────────────────
interface SubeGrup { cariAdi: string; subeler: { key: string; subeAdi: string; subeKod: string }[] }
const subeCache = new Map<string, SubeGrup[]>()

function SubeSecici({ kisiId, gorunum, deger, onChange, onEksik }: {
  kisiId: string
  gorunum: string
  deger: string
  onChange: (v: string) => void
  onEksik: () => void
}) {
  const [gruplar, setGruplar] = useState<SubeGrup[] | null>(subeCache.get(kisiId) ?? null)
  const [hata, setHata] = useState('')
  const [arama, setArama] = useState('')
  const [acik, setAcik] = useState(false)

  useEffect(() => {
    const c = subeCache.get(kisiId)
    if (c) { setGruplar(c); return }
    setGruplar(null)
    setHata('')
    const qs = new URLSearchParams({ kisi: kisiId })
    if (gorunum) qs.set('gorunum', gorunum)
    fetch(`/api/v2/gorev-subeleri?${qs}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Şubeler alınamadı')
        subeCache.set(kisiId, j.gruplar)
        setGruplar(j.gruplar)
      })
      .catch(e => setHata(e instanceof Error ? e.message : String(e)))
  }, [kisiId, gorunum])

  const sonuclar = useMemo(() => {
    const q = sadeAd(arama)
    const out: { value: string; cari: string; sube: string }[] = []
    for (const g of gruplar ?? []) {
      for (const s of g.subeler) {
        if (q && !sadeAd(`${g.cariAdi} ${s.subeAdi} ${s.subeKod}`).includes(q)) continue
        out.push({ value: `${g.cariAdi.trim()} / ${s.subeAdi.trim()}`, cari: g.cariAdi, sube: s.subeAdi })
        if (out.length >= 60) return out
      }
    }
    return out
  }, [gruplar, arama])

  const toplam = (gruplar ?? []).reduce((t, g) => t + g.subeler.length, 0)

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setAcik(a => !a)}
        className="w-full flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-sm">
        <Store size={15} className="text-gray-400 shrink-0" />
        <span className={clsx('flex-1 truncate', !deger && 'text-gray-400')}>{deger || 'Şube seçin'}</span>
        {deger && (
          <span role="button" onClick={e => { e.stopPropagation(); onChange('') }} className="text-gray-400"><X size={14} /></span>
        )}
      </button>
      {acik && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="relative border-b border-gray-100">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={arama} onChange={e => setArama(e.target.value)}
              placeholder={gruplar ? `${toplam} şube içinde ara…` : 'Yükleniyor…'}
              className="w-full pl-8 pr-3 py-2 text-sm focus:outline-none" />
          </div>
          {hata && <p className="px-3 py-2 text-xs text-red-600">{hata}</p>}
          {!gruplar && !hata && <div className="m-3 h-6 rounded bg-gray-100 animate-pulse" />}
          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {sonuclar.map(s => (
              <li key={s.value}>
                <button type="button" onClick={() => { onChange(s.value); setAcik(false); setArama('') }}
                  className={clsx('w-full px-3 py-2 text-left hover:bg-gray-50', deger === s.value && 'bg-brand-50')}>
                  <span className="block text-sm text-gray-800 truncate">{s.sube || '—'}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{s.cari}</span>
                </button>
              </li>
            ))}
            {gruplar && sonuclar.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Eşleşen şube yok.</li>}
          </ul>
          <button type="button" onClick={onEksik}
            className="w-full flex items-center justify-center gap-1.5 border-t border-gray-100 px-3 py-2 text-xs font-medium text-brand-600 hover:bg-gray-50">
            <AlertCircle size={13} /> Listede yok mu? Eksik şube bildir
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Görev penceresi ───────────────────────────────────────────
function GorevModal({ gorev, varsayilanTarih, kisiler, oturum, benRol, gorunum, onClose, onKaydet }: {
  gorev: Task | null
  varsayilanTarih: string
  kisiler: AjandaKisi[]
  oturum: Props['oturum']
  benRol: string
  gorunum: string
  onClose: () => void
  onKaydet: () => void
}) {
  const yeni = !gorev
  const baskasinaAcabilir = ['admin', 'bsy', 'sup'].includes(oturum.rol) || ['bsy', 'sup'].includes(benRol)
  const secilebilir = yeni && baskasinaAcabilir ? kisiler : kisiler.filter(k => k.id === (gorev?.pid ?? kisiler[0]?.id))
  const [pid, setPid] = useState(gorev?.pid ?? kisiler[0]?.id ?? oturum.id)
  const kisiRol = kisiler.find(k => k.id === pid)?.rol ?? benRol
  const turler = ['sup', 'jr'].includes(kisiRol)
    ? TASK_TYPES.filter(t => t !== 'Bayi Ziyareti' || t === gorev?.type)
    : [...TASK_TYPES]
  const [tur, setTur] = useState<string>(gorev?.type ?? turler[0])
  const [tarih, setTarih] = useState(gorev?.date ?? varsayilanTarih)
  const [bitis, setBitis] = useState(gorev?.date ?? varsayilanTarih)
  const [saat, setSaat] = useState(gorev?.time?.slice(0, 5) ?? '09:00')
  const [musteri, setMusteri] = useState(gorev?.customer ?? '')
  const [aciklama, setAciklama] = useState(gorev?.description ?? '')
  const [talep, setTalep] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')
  const izin = tur === 'İzin'

  const kaydet = async () => {
    setKaydediliyor(true)
    setHata('')
    let desc = aciklama
    if (izin && bitis && bitis !== tarih) desc = `${trTarih(tarih)} - ${trTarih(bitis)}${aciklama ? '\n' + aciklama : ''}`
    const ortak = { pid, date: tarih, time: izin ? null : (saat || null), type: tur, customer: musteri || null, description: desc || null }
    const { error } = yeni
      ? await supabase.from('tasks').insert({
          ...ortak, checkin_ts: null, checkin_lat: null, checkin_lng: null, checkin_by: null, checkin_address: null,
          created_by: oturum.id,
        })
      : await supabase.from('tasks').update(ortak).eq('id', gorev!.id)
    setKaydediliyor(false)
    if (error) { setHata(error.message); return }
    onKaydet()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">{yeni ? 'Yeni görev' : 'Görevi düzenle'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>

        {secilebilir.length > 1 && (
          <label className="block space-y-1">
            <span className="text-xs text-gray-500">Kişi</span>
            <select value={pid} onChange={e => { setPid(e.target.value); setMusteri('') }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white">
              {secilebilir.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-gray-500">Tür</span>
          <select value={tur} onChange={e => setTur(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white">
            {turler.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-gray-500">{izin ? 'Başlangıç' : 'Tarih'}</span>
            <input type="date" value={tarih} onChange={e => setTarih(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          {izin ? (
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">Bitiş</span>
              <input type="date" value={bitis} min={tarih} onChange={e => setBitis(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
          ) : (
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">Saat</span>
              <input type="time" value={saat} onChange={e => setSaat(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </label>
          )}
        </div>

        {!izin && (
          <div className="space-y-1">
            <span className="text-xs text-gray-500">Cari / Şube</span>
            <SubeSecici kisiId={pid} gorunum={gorunum} deger={musteri} onChange={setMusteri} onEksik={() => setTalep(true)} />
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-gray-500">Açıklama</span>
          <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={2}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none" />
        </label>

        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <button onClick={kaydet} disabled={kaydediliyor || !tarih}
          className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
      {talep && (
        <TalepModal tip="eksik_sube" ilgiliId={pid} onClose={() => setTalep(false)}
          onGonderildi={({ cari, sube }) => { if (cari || sube) setMusteri([cari, sube].filter(Boolean).join(' / ')) }} />
      )}
    </div>
  )
}

// ─── Görev notları ─────────────────────────────────────────────
function GorevNotlari({ gorevId, oturumId }: { gorevId: string; oturumId: string }) {
  const [notlar, setNotlar] = useState<TaskNote[] | null>(null)
  const [metin, setMetin] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const yukle = useCallback(async () => {
    const { data } = await supabase
      .from('task_notes')
      .select('*, profiles(full_name)')
      .eq('task_id', gorevId)
      .order('created_at', { ascending: true })
    setNotlar((data ?? []) as TaskNote[])
  }, [gorevId])

  useEffect(() => { yukle() }, [yukle])

  const ekle = async () => {
    if (!metin.trim()) return
    setGonderiliyor(true)
    const { error } = await supabase.from('task_notes').insert({ task_id: gorevId, author_id: oturumId, text: metin.trim() })
    setGonderiliyor(false)
    if (!error) { setMetin(''); yukle() }
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><MessageSquare size={13} /> Notlar</p>
      {notlar === null && <div className="h-4 rounded bg-gray-100 animate-pulse" />}
      {notlar && notlar.length === 0 && <p className="text-xs text-gray-400">Henüz not yok.</p>}
      <ul className="space-y-1.5 max-h-40 overflow-y-auto">
        {(notlar ?? []).map(n => (
          <li key={n.id} className="rounded-lg bg-gray-50 px-3 py-1.5">
            <p className="text-[11px] text-gray-400">
              {n.profiles?.full_name ?? ''} · {new Date(n.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{n.text}</p>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={metin} onChange={e => setMetin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ekle() }}
          placeholder="Not ekle…" className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <button onClick={ekle} disabled={gonderiliyor || !metin.trim()}
          className="rounded-xl bg-brand-500 px-3 text-white disabled:opacity-50"><Send size={15} /></button>
      </div>
    </div>
  )
}

// ─── Görev detayı ──────────────────────────────────────────────
function GorevDetay({ gorev, kisiAdi, oturum, onClose, onDuzenle, onDegisti }: {
  gorev: Task
  kisiAdi: string
  oturum: Props['oturum']
  onClose: () => void
  onDuzenle: () => void
  onDegisti: () => void
}) {
  const [islem, setIslem] = useState<'' | 'checkin' | 'sil'>('')
  const [uyari, setUyari] = useState('')
  const kendi = gorev.pid === oturum.id
  const duzenleyebilir = kendi || oturum.rol === 'admin'

  const checkIn = async () => {
    setIslem('checkin')
    setUyari('')
    const k = await checkinKonumu()
    const { error } = await supabase.from('tasks').update({
      checkin_ts: new Date().toISOString(), checkin_lat: k.lat, checkin_lng: k.lng,
      checkin_by: oturum.id, checkin_address: k.checkin_address,
    }).eq('id', gorev.id)
    setIslem('')
    if (error) { setUyari(error.message); return }
    if (!k.hasLocation) setUyari('Konum izni verilmedi; check-in konumsuz kaydedildi.')
    onDegisti()
  }

  const sil = async () => {
    if (!confirm('Görev silinsin mi?')) return
    setIslem('sil')
    const { error } = await supabase.from('tasks').delete().eq('id', gorev.id)
    setIslem('')
    if (error) { setUyari(error.message); return }
    onDegisti()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{trTarih(gorev.date)}{gorev.time ? ` · ${gorev.time.slice(0, 5)}` : ''} · {kisiAdi}</p>
            <h3 className="text-base font-semibold text-gray-800">{gorev.type}</h3>
            {gorev.customer && <p className="text-sm text-gray-700">{gorev.customer}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>
        {gorev.description && <p className="text-sm text-gray-600 whitespace-pre-line">{gorev.description}</p>}

        {gorev.checkin_ts ? (
          <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
            <p className="flex items-center gap-1.5 font-medium"><Check size={15} /> Check-in {new Date(gorev.checkin_ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
            {gorev.checkin_address && <p className="text-xs mt-0.5">{gorev.checkin_address}</p>}
            {gorev.checkin_lat != null && gorev.checkin_lng != null && (
              <a href={`https://maps.google.com/?q=${gorev.checkin_lat},${gorev.checkin_lng}`} target="_blank" rel="noreferrer"
                className="text-xs underline flex items-center gap-1 mt-1"><MapPin size={11} /> Haritada gör</a>
            )}
          </div>
        ) : kendi && (
          <button onClick={checkIn} disabled={!!islem}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white disabled:opacity-60">
            <MapPin size={16} /> {islem === 'checkin' ? 'Konum alınıyor…' : 'Check-in yap'}
          </button>
        )}
        {uyari && <p className="text-xs text-amber-700">{uyari}</p>}

        {duzenleyebilir && (
          <div className="flex gap-2">
            <button onClick={onDuzenle} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm text-gray-700">
              <Pencil size={14} /> Düzenle
            </button>
            <button onClick={sil} disabled={!!islem} className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600">
              <Trash2 size={14} /> Sil
            </button>
          </div>
        )}

        <GorevNotlari gorevId={gorev.id} oturumId={oturum.id} />
      </div>
    </div>
  )
}

// ─── Aylık ziyaret hedefi ──────────────────────────────────────
function ZiyaretHedefi({ kisiler, yil, ay, yenile }: { kisiler: AjandaKisi[]; yil: number; ay: number; yenile: number }) {
  const donem = `${yil}-${String(ay + 1).padStart(2, '0')}`
  const hedefliler = useMemo(
    () => kisiler.filter(k => ['sup', 'jr'].includes(k.rol) && ziyaretHedefi(k.ad) !== null && donemdeAktif(k.ad, donem)),
    [kisiler, donem],
  )
  const [sayilar, setSayilar] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (hedefliler.length === 0) return
    let iptal = false
    const son = new Date(yil, ay + 1, 0).getDate()
    supabase.from('tasks').select('pid')
      .in('pid', hedefliler.map(k => k.id))
      .gte('date', `${donem}-01`).lte('date', `${donem}-${String(son).padStart(2, '0')}`)
      .not('checkin_ts', 'is', null)
      .then(({ data }) => {
        if (iptal) return
        const m: Record<string, number> = {}
        for (const r of data ?? []) m[r.pid] = (m[r.pid] ?? 0) + 1
        setSayilar(m)
      })
    return () => { iptal = true }
  }, [hedefliler, yil, ay, donem, yenile])

  if (hedefliler.length === 0) return null
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <Target size={13} /> {AYLAR_UZUN[ay]} ziyaret hedefi (check-in)
      </p>
      {hedefliler.map(k => {
        const hedef = ziyaretHedefi(k.ad)!
        const g = sayilar?.[k.id] ?? 0
        const oran = Math.min(g / hedef, 1)
        return (
          <div key={k.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-700 truncate">{k.ad}</span>
              <span className="tabular-nums text-gray-500">{sayilar ? g : '…'} / {hedef}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={clsx('h-full rounded-full', oran >= 1 ? 'bg-green-500' : 'bg-brand-500')} style={{ width: `${oran * 100}%` }} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

// ─── Ana görünüm ───────────────────────────────────────────────
export function AjandaView({ kisiler, oturum, benRol, gorunum }: Props) {
  const [mod, setMod] = useState<'hafta' | 'ay'>('hafta')
  const [hafta, setHafta] = useState(() => haftaBasi(new Date()))
  const [ayBasi, setAyBasi] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [secili, setSecili] = useState(() => isoGun(new Date()))
  const [yenileSayac, setYenileSayac] = useState(0)
  const [kisiFiltre, setKisiFiltre] = useState('')
  const [gorevler, setGorevler] = useState<Task[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [modal, setModal] = useState<{ gorev: Task | null } | null>(null)
  const [detay, setDetay] = useState<Task | null>(null)
  const istekNo = useRef(0)

  const gunler = useMemo(() => {
    if (mod === 'hafta') return Array.from({ length: 7 }, (_, i) => gunEkle(hafta, i))
    const bas = haftaBasi(ayBasi)
    const sonGun = new Date(ayBasi.getFullYear(), ayBasi.getMonth() + 1, 0)
    const adet = Math.ceil(((sonGun.getTime() - bas.getTime()) / 86400000 + 1) / 7) * 7
    return Array.from({ length: adet }, (_, i) => gunEkle(bas, i))
  }, [mod, hafta, ayBasi])
  const idler = useMemo(() => kisiler.map(k => k.id), [kisiler])
  const kisiAdi = useCallback((id: string) => kisiler.find(k => k.id === id)?.ad ?? '', [kisiler])

  const yukle = useCallback(async () => {
    if (idler.length === 0) { setGorevler([]); return }
    const no = ++istekNo.current
    setYukleniyor(true)
    setHata('')
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('pid', idler)
      .gte('date', isoGun(gunler[0]))
      .lte('date', isoGun(gunler[gunler.length - 1]))
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: true })
    if (no !== istekNo.current) return
    setYukleniyor(false)
    if (error) { setHata(error.message); return }
    setGorevler((data ?? []) as Task[])
    setYenileSayac(n => n + 1)
  }, [idler, gunler])

  useEffect(() => { yukle() }, [yukle])

  const filtreli = gorevler.filter(g => !kisiFiltre || g.pid === kisiFiltre)
  const gunGorevleri = filtreli.filter(g => g.date === secili)
  const bugun = isoGun(new Date())
  const ayBaslik = mod === 'ay' ? `${AYLAR_UZUN[ayBasi.getMonth()]} ${ayBasi.getFullYear()}` : (() => {
    const a = gunler[0], b = gunler[6]
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${AYLAR[a.getMonth()]} ${a.getFullYear()}`
      : `${a.getDate()} ${AYLAR[a.getMonth()]} – ${b.getDate()} ${AYLAR[b.getMonth()]} ${b.getFullYear()}`
  })()

  const haftaDegistir = (n: number) => {
    if (mod === 'ay') {
      const y = new Date(ayBasi.getFullYear(), ayBasi.getMonth() + n, 1)
      setAyBasi(y)
      setSecili(isoGun(y))
      return
    }
    const y = gunEkle(hafta, n * 7)
    setHafta(y)
    setSecili(isoGun(y))
  }
  const bugunGit = () => {
    const d = new Date()
    setHafta(haftaBasi(d))
    setAyBasi(new Date(d.getFullYear(), d.getMonth(), 1))
    setSecili(bugun)
  }
  const modDegistir = (m: 'hafta' | 'ay') => {
    const s = new Date(secili + 'T12:00:00')
    setHafta(haftaBasi(s))
    setAyBasi(new Date(s.getFullYear(), s.getMonth(), 1))
    setMod(m)
  }
  const hedefAy = mod === 'ay' ? ayBasi : new Date(secili + 'T12:00:00')

  return (
    <div className="space-y-3">
      {/* Hafta gezinme */}
      <div className="flex items-center gap-2">
        <button onClick={() => haftaDegistir(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
        <span className="flex-1 text-center text-sm font-medium text-gray-700">{ayBaslik}</span>
        <button onClick={() => haftaDegistir(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
        <button onClick={bugunGit}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600">Bugün</button>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(['hafta', 'ay'] as const).map(m => (
          <button key={m} onClick={() => modDegistir(m)}
            className={clsx('flex-1 rounded-lg py-1 text-xs font-medium', mod === m ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}>
            {m === 'hafta' ? 'Hafta' : 'Ay'}
          </button>
        ))}
      </div>

      {mod === 'ay' && (
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400">
          {GUNLER.map(g => <span key={g}>{g}</span>)}
        </div>
      )}
      <div className="grid grid-cols-7 gap-1">
        {gunler.map((d, i) => {
          const iso = isoGun(d)
          const adet = filtreli.filter(g => g.date === iso).length
          const checkin = filtreli.filter(g => g.date === iso && g.checkin_ts).length
          const disarida = mod === 'ay' && d.getMonth() !== ayBasi.getMonth()
          return (
            <button key={iso} onClick={() => setSecili(iso)}
              className={clsx('rounded-xl flex flex-col items-center gap-0.5 border',
                mod === 'hafta' ? 'py-2' : 'py-1',
                secili === iso ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-gray-200 text-gray-700',
                iso === bugun && secili !== iso && 'border-brand-500',
                disarida && secili !== iso && 'opacity-40')}>
              {mod === 'hafta' && <span className={clsx('text-[10px]', secili === iso ? 'text-white/80' : 'text-gray-400')}>{GUNLER[i]}</span>}
              <span className="text-sm font-semibold">{d.getDate()}</span>
              <span className={clsx('text-[10px] h-3 tabular-nums', secili === iso ? 'text-white/90' : 'text-gray-400')}>
                {adet > 0 ? `${checkin}/${adet}` : ''}
              </span>
            </button>
          )
        })}
      </div>

      <ZiyaretHedefi kisiler={kisiler} yil={hedefAy.getFullYear()} ay={hedefAy.getMonth()} yenile={yenileSayac} />

      {kisiler.length > 1 && (
        <select value={kisiFiltre} onChange={e => setKisiFiltre(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="">Tüm ekip ({kisiler.length} kişi)</option>
          {kisiler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      )}

      {hata && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</p>}

      <div className={clsx('space-y-2', yukleniyor && 'opacity-60')}>
        {gunGorevleri.length === 0 && !yukleniyor && (
          <p className="py-8 text-center text-sm text-gray-400">Bu gün için görev yok.</p>
        )}
        {gunGorevleri.map(g => (
          <button key={g.id} onClick={() => setDetay(g)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50">
            <span className="w-12 shrink-0 text-xs tabular-nums text-gray-500 pt-0.5 flex items-center gap-1">
              <Clock size={11} /> {g.time ? g.time.slice(0, 5) : '—'}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-800">{g.type}</span>
              {g.customer && <span className="block text-xs text-gray-600 truncate">{g.customer}</span>}
              {kisiler.length > 1 && <span className="block text-[11px] text-gray-400">{kisiAdi(g.pid)}</span>}
            </span>
            {g.checkin_ts && <span className="shrink-0 rounded-full bg-green-50 p-1 text-green-700"><Check size={13} /></span>}
          </button>
        ))}
      </div>

      {/* Görev ekle */}
      <button onClick={() => setModal({ gorev: null })}
        className="fixed bottom-20 right-4 md:bottom-6 z-30 flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-lg">
        <Plus size={18} /> Görev
      </button>

      {modal && (
        <GorevModal gorev={modal.gorev} varsayilanTarih={secili} kisiler={kisiler} oturum={oturum}
          benRol={benRol} gorunum={gorunum} onClose={() => setModal(null)} onKaydet={yukle} />
      )}
      {detay && (
        <GorevDetay gorev={detay} kisiAdi={kisiAdi(detay.pid)} oturum={oturum}
          onClose={() => setDetay(null)}
          onDuzenle={() => { setModal({ gorev: detay }); setDetay(null) }}
          onDegisti={async () => {
            await yukle()
            const { data } = await supabase.from('tasks').select('*').eq('id', detay.id).maybeSingle()
            setDetay(data ? (data as Task) : null)
          }} />
      )}
    </div>
  )
}
