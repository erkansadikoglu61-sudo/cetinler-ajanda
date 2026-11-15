'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'

// Hesabım — telefona bildirim aç/kapat. iPhone'da web bildirimi yalnızca
// uygulama "Ana Ekrana Ekle" ile eklendiyse çalışır (iOS 16.4+).

type Durum = 'yukleniyor' | 'desteklenmiyor' | 'ios-ana-ekran' | 'engelli' | 'kapali' | 'acik'

function base64ToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

function iosTarayicida(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches
  return ios && !standalone
}

export function BildirimKarti() {
  const [durum, setDurum] = useState<Durum>('yukleniyor')
  const [mesaj, setMesaj] = useState('')
  const [islem, setIslem] = useState(false)

  const kontrol = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setDurum(iosTarayicida() ? 'ios-ana-ekran' : 'desteklenmiyor')
      return
    }
    if (Notification.permission === 'denied') { setDurum('engelli'); return }
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    setDurum(sub && Notification.permission === 'granted' ? 'acik' : 'kapali')
  }, [])

  useEffect(() => { kontrol().catch(() => setDurum('desteklenmiyor')) }, [kontrol])

  const ac = async () => {
    setIslem(true)
    setMesaj('')
    try {
      const izin = await Notification.requestPermission()
      if (izin !== 'granted') { setDurum(izin === 'denied' ? 'engelli' : 'kapali'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const bilgi = await (await fetch('/api/v2/bildirim/abone')).json()
      if (bilgi.tabloYok) throw new Error('Bildirim tablosu henüz oluşturulmadı.')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8(bilgi.publicKey) as BufferSource,
      })
      const r = await fetch('/api/v2/bildirim/abone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), cihaz: navigator.userAgent }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Abonelik kaydedilemedi')
      setDurum('acik')
      if (!bilgi.hazir) setMesaj('Bildirim izni alındı; gönderim, yönetici Vercel ayarını tamamlayınca başlayacak.')
    } catch (e) {
      setMesaj(e instanceof Error ? e.message : String(e))
    } finally {
      setIslem(false)
    }
  }

  const kapat = async () => {
    setIslem(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/v2/bildirim/abone', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setDurum('kapali')
    } finally {
      setIslem(false)
    }
  }

  const dene = async () => {
    setMesaj('')
    const r = await fetch('/api/v2/bildirim/olay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tip: 'test' }),
    })
    const j = await r.json()
    setMesaj(r.ok ? (j.gonderilen > 0 ? 'Deneme bildirimi gönderildi.' : 'Gönderilecek abonelik bulunamadı.') : (j.error || 'Gönderilemedi'))
  }

  if (durum === 'yukleniyor') return null

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
      <div className="flex items-center gap-3">
        {durum === 'acik' ? <BellRing size={18} className="text-brand-600" /> : durum === 'engelli' ? <BellOff size={18} className="text-gray-400" /> : <Bell size={18} className="text-gray-400" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">Telefona bildirim</p>
          <p className="text-xs text-gray-500">
            {durum === 'acik' && 'Açık — yeni görev, görev notu ve talepler bildirilir.'}
            {durum === 'kapali' && 'Kapalı'}
            {durum === 'engelli' && 'Tarayıcı ayarlarında bu site için bildirim izni kapalı.'}
            {durum === 'ios-ana-ekran' && 'iPhone\'da önce Paylaş ▸ "Ana Ekrana Ekle" ile uygulamayı ekleyin, oradan açın.'}
            {durum === 'desteklenmiyor' && 'Bu tarayıcı bildirimleri desteklemiyor.'}
          </p>
        </div>
        {durum === 'kapali' && (
          <button onClick={ac} disabled={islem} className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Aç</button>
        )}
        {durum === 'acik' && (
          <button onClick={kapat} disabled={islem} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600">Kapat</button>
        )}
      </div>
      {durum === 'acik' && (
        <button onClick={dene} className="text-xs text-brand-600">Deneme bildirimi gönder</button>
      )}
      {mesaj && <p className="text-xs text-gray-600">{mesaj}</p>}
    </section>
  )
}
