'use client'

import { useState, useEffect } from 'react'
import { requestNotificationPermission } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function TestPushPage() {
  const { profile } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Yükleniyor...')
  const [autoRun, setAutoRun] = useState(false)

  // Sayfa yüklenince otomatik çalış
  useEffect(() => {
    if (profile && !autoRun) {
      setAutoRun(true)
      handleRequestPermission()
    }
  }, [profile])

  const handleRequestPermission = async () => {
    setStatus('İzin isteniyor...')
    console.log('🔔 Push izni isteniyor...')

    try {
      const pushToken = await requestNotificationPermission()
      console.log('📱 Token alındı:', pushToken ? 'Başarılı' : 'Başarısız')

      if (pushToken) {
        setToken(pushToken)
        setStatus('✅ Token alındı!')

        if (profile?.id) {
          console.log('💾 Token Supabase\'e kaydediliyor...')
          const { error } = await supabase
            .from('profiles')
            .update({ push_token: pushToken })
            .eq('id', profile.id)

          if (error) {
            setStatus('❌ Token kaydedilemedi: ' + error.message)
            console.error('❌ Supabase hatası:', error)
          } else {
            setStatus('✅ Token Supabase\'e kaydedildi!')
            console.log('✅ Push token kaydedildi!')
          }
        }
      } else {
        setStatus('❌ Token alınamadı veya izin reddedildi')
        console.log('❌ Token alınamadı')
      }
    } catch (error: any) {
      setStatus('❌ Hata: ' + error.message)
      console.error('❌ Push izni hatası:', error)
    }
  }

  const handleSendTestNotification = async () => {
    if (!token) {
      setStatus('❌ Önce push token alın')
      return
    }

    setStatus('Test notification gönderiliyor...')
    try {
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushTokens: [token],
          title: 'Test Notification',
          body: 'Bu bir test bildirimidir! 🎉',
          data: { test: true },
        }),
      })

      const result = await response.json()

      if (result.success) {
        setStatus('✅ Test notification gönderildi!')
      } else {
        setStatus('❌ Gönderilemedi: ' + result.error)
      }
    } catch (error: any) {
      setStatus('❌ Hata: ' + error.message)
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">🔔 Push Notification Test</h1>

        {profile ? (
          <div className="mb-4 p-4 bg-blue-50 rounded">
            <p><strong>Kullanıcı:</strong> {profile.full_name}</p>
            <p><strong>ID:</strong> {profile.id}</p>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-red-50 rounded">
            <p>⚠️ Giriş yapmanız gerekiyor</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleRequestPermission}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
          >
            1️⃣ Push İzni Al ve Token Kaydet
          </button>

          <button
            onClick={handleSendTestNotification}
            disabled={!token}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            2️⃣ Test Notification Gönder
          </button>
        </div>

        {status && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <p className="font-mono text-sm">{status}</p>
          </div>
        )}

        {token && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-500 mb-2">Push Token:</p>
            <p className="font-mono text-xs break-all">{token}</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-bold mb-2">📋 Test Adımları:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>İlk butona tıklayın (Push izni istenir)</li>
            <li>Tarayıcı popup'ında "İzin Ver" / "Allow" deyin</li>
            <li>Token alındı mesajını bekleyin</li>
            <li>İkinci butona tıklayın (Test notification gönderilir)</li>
            <li>Bildirim almanız lazım! 🎉</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
