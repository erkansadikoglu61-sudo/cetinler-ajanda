'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Send, CheckCircle2, Clock, XCircle, MessageSquareWarning } from 'lucide-react'
import clsx from 'clsx'

export type TalepTip = 'eksik_sube' | 'hatali_bilgi'

const TIP_ADI: Record<TalepTip, string> = {
  eksik_sube: 'Eksik şube',
  hatali_bilgi: 'Hatalı bilgi',
}

// ─── Talep oluşturma penceresi ────────────────────────────────
export function TalepModal({ tip, ilgiliId, varsayilanCari = '', varsayilanSube = '', onClose, onGonderildi }: {
  tip: TalepTip
  ilgiliId?: string
  varsayilanCari?: string
  varsayilanSube?: string
  onClose: () => void
  onGonderildi?: (t: { cari: string; sube: string }) => void
}) {
  const [cari, setCari] = useState(varsayilanCari)
  const [sube, setSube] = useState(varsayilanSube)
  const [aciklama, setAciklama] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState('')

  const gonder = async () => {
    setGonderiliyor(true)
    setHata('')
    try {
      const metin = aciklama.trim() || (tip === 'eksik_sube' ? 'Şube listemde yok, eklenmesini rica ederim.' : '')
      const r = await fetch('/api/v2/talepler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tip, cari_adi: cari, sube_adi: sube, aciklama: metin, ilgili_id: ilgiliId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Gönderilemedi')
      onGonderildi?.({ cari: cari.trim(), sube: sube.trim() })
      onClose()
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setGonderiliyor(false)
    }
  }

  const eksik = tip === 'eksik_sube'
  const gecerli = eksik ? !!(cari.trim() || sube.trim()) : !!aciklama.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">{eksik ? 'Eksik şube bildir' : 'Hatalı bilgi bildir'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">
          {eksik
            ? 'Listenizde olmayan şubeyi yazın; yöneticinize ve admine iletilir.'
            : 'Kimlik kartınızda yanlış gördüğünüz bilgiyi (IBAN, cari, şube, bağlı olduğunuz kişi…) yazın; yöneticinize ve admine iletilir.'}
        </p>
        {eksik && (
          <>
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari (ör. EVKUR)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input value={sube} onChange={e => setSube(e.target.value)} placeholder="Şube (ör. Van Merkez)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </>
        )}
        <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={3}
          placeholder={eksik ? 'Not (isteğe bağlı)' : 'Ne yanlış, doğrusu ne olmalı?'}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none" />
        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <button onClick={gonder} disabled={!gecerli || gonderiliyor}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          <Send size={15} /> {gonderiliyor ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </div>
    </div>
  )
}

// ─── Talep listesi ────────────────────────────────────────────
interface Talep {
  id: string
  tip: TalepTip
  olusturan_id: string
  olusturan_adi: string
  ilgili_adi: string
  cari_adi: string | null
  sube_adi: string | null
  aciklama: string
  durum: 'acik' | 'cozuldu' | 'reddedildi'
  cevap: string | null
  cozen_adi: string
  created_at: string
  kapatabilir: boolean
}

function tarih(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function TaleplerListesi({ gorunum, yenile }: { gorunum: string; yenile: number }) {
  const [talepler, setTalepler] = useState<Talep[] | null>(null)
  const [hata, setHata] = useState('')
  const [tabloYok, setTabloYok] = useState(false)
  const [sadeceAcik, setSadeceAcik] = useState(true)
  const [cevaplar, setCevaplar] = useState<Record<string, string>>({})

  const yukle = useCallback(async () => {
    setHata('')
    try {
      const qs = gorunum ? `?gorunum=${encodeURIComponent(gorunum)}` : ''
      const r = await fetch(`/api/v2/talepler${qs}`)
      const j = await r.json()
      if (!r.ok) { setTabloYok(!!j.tabloYok); throw new Error(j.error || 'Talepler alınamadı') }
      setTalepler(j.talepler as Talep[])
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    }
  }, [gorunum])

  useEffect(() => { yukle() }, [yukle, yenile])

  const kapat = async (id: string, durum: Talep['durum']) => {
    const r = await fetch('/api/v2/talepler', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, durum, cevap: cevaplar[id] ?? '' }),
    })
    if (r.ok) yukle()
    else setHata((await r.json()).error || 'Güncellenemedi')
  }

  if (tabloYok) {
    return <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">{hata}</p>
  }
  const liste = (talepler ?? []).filter(t => !sadeceAcik || t.durum === 'acik')
  const acikSayi = (talepler ?? []).filter(t => t.durum === 'acik').length

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
        <MessageSquareWarning size={15} className="text-brand-600" />
        <span className="flex-1 text-sm font-medium text-gray-700">Talepler {acikSayi > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">{acikSayi} açık</span>}</span>
        <button onClick={() => setSadeceAcik(s => !s)} className="text-xs text-brand-600">
          {sadeceAcik ? 'Tümünü göster' : 'Yalnızca açıklar'}
        </button>
      </div>
      {hata && <p className="px-4 py-2 text-xs text-red-600">{hata}</p>}
      {talepler && liste.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Talep yok.</p>}
      <ul className="divide-y divide-gray-50">
        {liste.map(t => (
          <li key={t.id} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className={clsx('rounded px-1.5 py-0.5', t.tip === 'eksik_sube' ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700')}>
                {TIP_ADI[t.tip]}
              </span>
              <span className="text-gray-500 truncate flex-1">{t.olusturan_adi}{t.ilgili_adi && t.ilgili_adi !== t.olusturan_adi ? ` → ${t.ilgili_adi}` : ''} · {tarih(t.created_at)}</span>
              {t.durum === 'acik' && <span className="flex items-center gap-1 text-amber-700"><Clock size={11} /> Açık</span>}
              {t.durum === 'cozuldu' && <span className="flex items-center gap-1 text-green-700"><CheckCircle2 size={11} /> Çözüldü</span>}
              {t.durum === 'reddedildi' && <span className="flex items-center gap-1 text-gray-500"><XCircle size={11} /> Reddedildi</span>}
            </div>
            {(t.cari_adi || t.sube_adi) && (
              <p className="text-sm font-medium text-gray-800">{[t.cari_adi, t.sube_adi].filter(Boolean).join(' / ')}</p>
            )}
            <p className="text-sm text-gray-600 whitespace-pre-line">{t.aciklama}</p>
            {t.cevap && <p className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2">{t.cozen_adi}: {t.cevap}</p>}
            {t.kapatabilir && t.durum === 'acik' && (
              <div className="flex gap-2 pt-1">
                <input value={cevaplar[t.id] ?? ''} onChange={e => setCevaplar(c => ({ ...c, [t.id]: e.target.value }))}
                  placeholder="Cevap (isteğe bağlı)" className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                <button onClick={() => kapat(t.id, 'cozuldu')} className="rounded-lg bg-green-600 px-2 py-1 text-xs text-white">Çözüldü</button>
                <button onClick={() => kapat(t.id, 'reddedildi')} className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-700">Reddet</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
