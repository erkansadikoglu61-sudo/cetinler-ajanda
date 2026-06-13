'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, Profile } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CACHE_KEY = 'caj_profile'
const CACHE_TTL = 10 * 60 * 1000 // 10 dakika

function readCache(): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { d, t } = JSON.parse(raw)
    if (Date.now() - t > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null }
    return d as Profile
  } catch { return null }
}

function writeCache(p: Profile) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ d: p, t: Date.now() })) } catch {}
}

function dropCache() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch {}
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()
    if (!error && data) {
      setProfile(data as Profile)
      writeCache(data as Profile)
    }
  }, [])

  useEffect(() => {
    const cached = readCache()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        if (cached) {
          // Cache varsa anında göster, arka planda yenile
          setProfile(cached)
          setLoading(false)
          fetchProfile(session.user.id)
        } else {
          fetchProfile(session.user.id).finally(() => setLoading(false))
        }
      } else {
        if (cached) dropCache()
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        dropCache()
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return 'E-posta veya şifre hatalı.'
    // Login sonrası profili hemen çek ve cache'e yaz —
    // böylece /app açıldığında anında yüklenir
    if (data.user) {
      const { data: pd } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      if (pd) {
        writeCache(pd as Profile)
        setProfile(pd as Profile)
      }
    }
    return null
  }

  const signOut = async () => {
    dropCache()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const resetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/auth/reset-password`,
    })
    if (error) return { success: false, message: 'Şifre sıfırlama e-postası gönderilemedi.' }
    return { success: true, message: 'Şifre sıfırlama bağlantısı e-postanıza gönderildi.' }
  }

  return { user, profile, loading, signIn, signOut, resetPassword }
}
