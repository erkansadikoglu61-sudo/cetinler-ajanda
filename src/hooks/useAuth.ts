'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, Profile } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
// Profil önbelleği localStorage'da tutulur (sessionStorage değil): iOS'ta ana
// ekrana eklenen uygulama her açılışta sessionStorage'ı sıfırlıyor; zayıf
// mobil bağlantıda profil sorgusu da düşünce kullanıcı oturumu açık olduğu
// halde giriş ekranına atılıyordu. Önbellek yalnızca aynı kullanıcı için kullanılır
// ve arka planda her açılışta yenilenir.
const CACHE_KEY = 'caj_profile_v2'
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 gün

// Mobil ağda tek bir isteğin sonsuza kadar asılı kalmaması için
const REQUEST_TIMEOUT_MS = 12_000

function readCache(uid?: string): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { d, t } = JSON.parse(raw) as { d: Profile; t: number }
    if (Date.now() - t > CACHE_MAX_AGE) { localStorage.removeItem(CACHE_KEY); return null }
    if (uid && d.id !== uid) return null
    return d
  } catch { return null }
}

function writeCache(p: Profile) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ d: p, t: Date.now() })) } catch {}
}

function dropCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
  try { sessionStorage.removeItem('caj_profile') } catch {}   // eski sürümün anahtarı
}

function withTimeout<T>(p: PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Profili çeker; zayıf bağlantıya karşı 3 deneme (0 / 1,5 / 3 sn bekleme). */
async function loadProfile(uid: string): Promise<Profile | null> {
  for (let i = 0; i < 3; i++) {
    if (i > 0) await sleep(1500 * i)
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', uid).single()
      )
      if (!error && data) return data as Profile
      // Kayıt yok (PGRST116) → tekrar denemenin anlamı yok
      if (error?.code === 'PGRST116') return null
    } catch { /* zaman aşımı / ağ hatası → tekrar dene */ }
  }
  return null
}

function isNetworkError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return msg.includes('timeout') || msg.includes('fetch') || msg.includes('network') || msg.includes('load failed')
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Oturum var ama profil alınamadı (bağlantı sorunu) — giriş ekranına atmak
  // yerine "Tekrar dene" gösterilir
  const [connectionError, setConnectionError] = useState(false)
  const uidRef = useRef<string | null>(null)

  const fetchProfile = useCallback(async (uid: string): Promise<boolean> => {
    const p = await loadProfile(uid)
    if (p) {
      setProfile(p)
      writeCache(p)
      setConnectionError(false)
      return true
    }
    return false
  }, [])

  const init = useCallback(async () => {
    setLoading(true)
    setConnectionError(false)
    let session = null
    try {
      session = (await withTimeout(supabase.auth.getSession())).data.session
    } catch {
      // getSession zaman aşımı: yerel önbellek varsa onunla devam et
      const cached = readCache()
      if (cached) { setProfile(cached); setLoading(false); return }
      setConnectionError(true); setLoading(false); return
    }

    setUser(session?.user ?? null)
    if (!session?.user) {
      dropCache()
      setProfile(null)
      setLoading(false)
      return
    }
    uidRef.current = session.user.id

    const cached = readCache(session.user.id)
    if (cached) {
      // Önbellek varsa anında göster, arka planda yenile
      setProfile(cached)
      setLoading(false)
      fetchProfile(session.user.id)
      return
    }
    const ok = await fetchProfile(session.user.id)
    if (!ok) setConnectionError(true)
    setLoading(false)
  }, [fetchProfile])

  useEffect(() => {
    init()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Not: Supabase, bu callback içinde doğrudan başka supabase çağrısı
      // yapılırsa kilitlenebiliyor (özellikle mobilde uygulamaya geri dönülüp
      // token yenilenirken) — işi bir sonraki tura erteliyoruz.
      setTimeout(() => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          uidRef.current = null
          setUser(null)
          dropCache()
          setProfile(null)
          return
        }
        setUser(session.user)
        // Token yenilemede profil değişmez; yalnızca kullanıcı değiştiyse çek
        if (uidRef.current !== session.user.id) {
          uidRef.current = session.user.id
          fetchProfile(session.user.id)
        }
      }, 0)
    })

    return () => listener.subscription.unsubscribe()
  }, [init, fetchProfile])

  const signIn = async (emailRaw: string, password: string): Promise<string | null> => {
    // Mobil klavye büyük harf / sona boşluk ekleyebiliyor
    const email = emailRaw.trim().toLowerCase()
    let result
    try {
      result = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 20_000)
    } catch (e) {
      return isNetworkError(e)
        ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
        : 'Giriş yapılamadı, lütfen tekrar deneyin.'
    }
    const { data, error } = result
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'E-posta veya şifre hatalı.'
      if (msg.includes('email not confirmed')) return 'E-posta adresi henüz onaylanmamış. Yöneticinize başvurun.'
      if (error.status === 429 || msg.includes('rate limit')) return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.'
      if (isNetworkError(error) || !error.status) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
      return 'E-posta veya şifre hatalı.'
    }
    // Login sonrası profili hemen çek ve önbelleğe yaz —
    // böylece /app açıldığında anında yüklenir
    if (data.user) {
      uidRef.current = data.user.id
      const p = await loadProfile(data.user.id)
      if (p) {
        writeCache(p)
        setProfile(p)
      }
    }
    return null
  }

  const signOut = async () => {
    dropCache()
    uidRef.current = null
    try { await withTimeout(supabase.auth.signOut()) } catch { /* yerel oturum yine de temizlenir */ }
    setUser(null)
    setProfile(null)
  }

  const resetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${APP_URL}/auth/reset-password`,
      }))
      if (error) return { success: false, message: 'Şifre sıfırlama e-postası gönderilemedi.' }
    } catch {
      return { success: false, message: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.' }
    }
    return { success: true, message: 'Şifre sıfırlama bağlantısı e-postanıza gönderildi.' }
  }

  return { user, profile, loading, connectionError, retry: init, signIn, signOut, resetPassword }
}
