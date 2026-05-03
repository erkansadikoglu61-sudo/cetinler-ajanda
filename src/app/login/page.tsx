'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

type View = 'login' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, resetPassword } = useAuth()

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      router.replace('/app')
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    const result = await resetPassword(email)
    setLoading(false)
    if (result.success) {
      setInfo(result.message)
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-4 py-8 safe-top safe-bottom">
      {/* Logo & Başlık */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">📅</div>
        <p className="text-white/70 text-sm font-medium tracking-wide uppercase mb-1">Hoş Geldiniz</p>
        <h1 className="text-white font-bold text-3xl leading-tight">Çetinler</h1>
        <p className="text-white/90 text-lg">Saha Ekibi</p>
        <p className="text-white/90 text-lg">Ajandası</p>
      </div>

      {/* Kart */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        {view === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-gray-800 font-semibold text-lg text-center mb-2">Giriş Yap</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="ornek@cetinler.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
                >
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'w-full py-3 rounded-xl font-semibold text-white min-h-[46px] btn-active',
                'bg-gradient-to-r from-brand-700 to-brand-500',
                'disabled:opacity-60'
              )}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Giriş yapılıyor...
                </span>
              ) : 'Giriş Yap'}
            </button>

            <button
              type="button"
              onClick={() => { setView('forgot'); setError(''); setInfo('') }}
              className="w-full text-center text-brand-600 text-sm py-2"
            >
              Şifremi Unuttum
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <h2 className="text-gray-800 font-semibold text-lg text-center mb-2">Şifremi Sıfırla</h2>
            <p className="text-gray-500 text-sm text-center">E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="ornek@cetinler.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            {info && (
              <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">{info}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'w-full py-3 rounded-xl font-semibold text-white min-h-[46px] btn-active',
                'bg-gradient-to-r from-brand-700 to-brand-500',
                'disabled:opacity-60'
              )}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Gönderiliyor...
                </span>
              ) : 'Sıfırlama Bağlantısı Gönder'}
            </button>

            <button
              type="button"
              onClick={() => { setView('login'); setError(''); setInfo('') }}
              className="w-full text-center text-brand-600 text-sm py-2"
            >
              ← Giriş Ekranına Dön
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center gap-2 text-white/60 text-xs">
        <Lock size={12} />
        <span>Güvenli Giriş · Çetinler © 2026</span>
      </div>
    </div>
  )
}
