'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Zayıf mobil bağlantıda getSession (token yenileme) asılı kalabiliyor —
    // 8 sn içinde dönmezse /app'e geç; orada bağlantı hatası ekranı / önbellek devreye girer.
    let done = false
    const fallback = setTimeout(() => { if (!done) { done = true; router.replace('/app') } }, 8000)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (done) return
        done = true
        router.replace(session ? '/app' : '/login')
      })
      .catch(() => { if (!done) { done = true; router.replace('/login') } })
      .finally(() => clearTimeout(fallback))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-700">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
