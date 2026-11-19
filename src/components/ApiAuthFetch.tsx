'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Uygulamanın kendi /api/* isteklerine oturum token'ını otomatik ekler.
// Sunucu tarafında src/proxy.ts token'sız istekleri reddeder (giriş yapmadan
// hiçbir veri görünmez). Modül yüklenir yüklenmez kurulur — bileşenlerin ilk
// fetch'inden önce.
//
// Oturum düşerse (401): oturum bir kez sessizce yenilenip istek tekrarlanır;
// yenilenemezse "oturum-bitti" olayı yayınlanır ve ekranda yeniden giriş uyarısı
// çıkar. Önceden kullanıcı (önbellekteki profil yüzünden) girişli görünüp boş
// ekranlarla kalıyordu.

export const OTURUM_BITTI_OLAYI = 'cetinler:oturum-bitti'

// Aynı anda gelen 401'ler için tek yenileme
let yenileme: Promise<string | null> | null = null
function oturumuYenile(): Promise<string | null> {
  if (!yenileme) {
    yenileme = supabase.auth.refreshSession()
      .then(({ data, error }) => (error ? null : data.session?.access_token ?? null))
      .catch(() => null)
      .finally(() => { setTimeout(() => { yenileme = null }, 5000) })
  }
  return yenileme
}

if (typeof window !== 'undefined' && !(window as unknown as { __apiAuthFetch?: boolean }).__apiAuthFetch) {
  ;(window as unknown as { __apiAuthFetch?: boolean }).__apiAuthFetch = true
  const orig = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let isApi = false
    try {
      const u = new URL(url, window.location.origin)
      isApi = u.origin === window.location.origin && u.pathname.startsWith('/api/')
    } catch { /* geçersiz URL → dokunma */ }
    if (!isApi) return orig(input, init)

    // Tekrar deneme için gövdeli Request nesnesinin kopyası
    const yedek = input instanceof Request ? input.clone() : null
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
      } catch { /* oturum okunamadı → token'sız gider, sunucu 401 döner */ }
    }
    const res = await orig(input, { ...init, headers })
    if (res.status !== 401) return res

    // Giriş sayfasında ya da hiç oturum yokken uyarı/yenileme gerekmez
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
    if (!session) return res

    const yeni = await oturumuYenile()
    if (yeni) {
      headers.set('Authorization', `Bearer ${yeni}`)
      const tekrar = await orig(yedek ?? input, { ...init, headers })
      if (tekrar.status !== 401) return tekrar
    }
    window.dispatchEvent(new Event(OTURUM_BITTI_OLAYI))
    return res
  }
}

/** Oturum düştüğünde ekranda yeniden giriş uyarısı (tüm sayfalarda) */
export default function ApiAuthFetch() {
  const [bitti, setBitti] = useState(false)
  const pathname = usePathname() ?? ''

  useEffect(() => {
    const dinle = () => setBitti(true)
    window.addEventListener(OTURUM_BITTI_OLAYI, dinle)
    return () => window.removeEventListener(OTURUM_BITTI_OLAYI, dinle)
  }, [])

  if (!bitti || pathname.startsWith('/login') || pathname.startsWith('/auth')) return null

  const yenidenGiris = async () => {
    try { localStorage.removeItem('caj_profile_v2') } catch { /* yoksay */ }
    try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* yerel oturum yine de temizlenir */ }
    window.location.href = pathname.startsWith('/v2') ? '/login?sonra=/v2' : '/login'
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl space-y-3">
        <div className="text-3xl">🔒</div>
        <h2 className="text-lg font-semibold text-gray-800">Oturumunuzun süresi doldu</h2>
        <p className="text-sm text-gray-600">Bilgilerinizin yüklenebilmesi için lütfen yeniden giriş yapın.</p>
        <button onClick={yenidenGiris}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600">
          Yeniden giriş yap
        </button>
      </div>
    </div>
  )
}
