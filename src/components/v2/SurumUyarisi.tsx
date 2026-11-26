'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// Açık v2 penceresi (masaüstü / telefon uygulaması) canlıya çıkan yeni sürümü
// fark eder: 2 dakikada bir, pencereye dönüldüğünde ve sekme değiştirildiğinde kontrol edilir.
const BU_SURUM = process.env.YAPI_SURUMU ?? ''
const ARALIK = 2 * 60 * 1000
let sonKontrol = 0

async function yeniSurumVarMi(): Promise<boolean> {
  if (!BU_SURUM || Date.now() - sonKontrol < 20 * 1000) return false
  sonKontrol = Date.now()
  try {
    const r = await fetch('/api/v2/surum', { cache: 'no-store' })
    if (!r.ok) return false
    const { surum } = await r.json() as { surum?: string }
    return !!surum && surum !== BU_SURUM
  } catch { return false }   // çevrimdışı vb. — sonra tekrar denenir
}

/** tetik: değiştiğinde (ör. sekme) ayrıca kontrol edilir */
export function SurumUyarisi({ tetik }: { tetik?: string }) {
  const [yeni, setYeni] = useState(false)

  useEffect(() => { yeniSurumVarMi().then(v => { if (v) setYeni(true) }) }, [tetik])

  useEffect(() => {
    if (!BU_SURUM) return
    const kontrol = async () => {
      if (await yeniSurumVarMi()) setYeni(true)
    }
    const zamanlayici = setInterval(kontrol, ARALIK)
    const gorunur = () => { if (document.visibilityState === 'visible') kontrol() }
    document.addEventListener('visibilitychange', gorunur)
    window.addEventListener('focus', gorunur)
    return () => {
      clearInterval(zamanlayici)
      document.removeEventListener('visibilitychange', gorunur)
      window.removeEventListener('focus', gorunur)
    }
  }, [])

  if (!yeni) return null
  return (
    <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-xl">
        <span>Yeni sürüm hazır</span>
        <button onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium hover:bg-brand-600">
          <RefreshCw size={13} /> Yenile
        </button>
        <button onClick={() => setYeni(false)} className="text-xs text-white/60 hover:text-white">Sonra</button>
      </div>
    </div>
  )
}
