'use client'

import { supabase } from '@/lib/supabase'

// Uygulamanın kendi /api/* isteklerine oturum token'ını otomatik ekler.
// Sunucu tarafında src/proxy.ts token'sız istekleri reddeder (giriş yapmadan
// hiçbir veri görünmez). Modül yüklenir yüklenmez kurulur — bileşenlerin ilk
// fetch'inden önce.
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

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
      } catch { /* oturum okunamadı → token'sız gider, sunucu 401 döner */ }
    }
    return orig(input, { ...init, headers })
  }
}

export default function ApiAuthFetch() {
  return null
}
