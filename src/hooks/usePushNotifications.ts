'use client'

import { useEffect, useState } from 'react'
import { requestNotificationPermission, onMessageListener } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'

export function usePushNotifications(userId: string | null) {
  const [token, setToken] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | null>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : null
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      console.log('🔔 Push: Window yok (SSR)')
      return
    }

    if (!userId) {
      console.log('🔔 Push: User ID yok')
      return
    }

    console.log('🔔 Push: User ID var:', userId)

    // Mevcut izin durumunu kontrol et
    if ('Notification' in window) {
      const currentPerm = Notification.permission
      console.log('🔔 Push: İzin durumu:', currentPerm)
      setPermission(currentPerm)

      // Eğer izin 'default' veya 'granted' ise token al
      if (currentPerm === 'default' || currentPerm === 'granted') {
        console.log('🔔 Push: 2 saniye sonra token alınacak...')
        const timer = setTimeout(() => {
          console.log('🔔 Push: Token alınıyor...')
          registerPushToken()
        }, 2000)
        return () => clearTimeout(timer)
      } else {
        console.log('🔔 Push: İzin reddedilmiş:', currentPerm)
      }
    } else {
      console.log('🔔 Push: Notification API desteklenmiyor')
    }
  }, [userId])

  // Push token al ve kaydet
  const registerPushToken = async () => {
    if (!userId) return

    try {
      const pushToken = await requestNotificationPermission()

      if (pushToken) {
        setToken(pushToken)
        setPermission('granted')

        // Token'ı Supabase'e kaydet
        const { error } = await supabase
          .from('profiles')
          .update({ push_token: pushToken })
          .eq('id', userId)

        if (error) {
          console.error('Push token kaydedilemedi:', error)
        } else {
          console.log('Push token kaydedildi')
        }
      } else {
        setPermission('denied')
      }
    } catch (error) {
      console.error('Push token alınırken hata:', error)
    }
  }

  // Foreground mesajları dinle
  useEffect(() => {
    if (typeof window === 'undefined') return

    const setupListener = async () => {
      try {
        await onMessageListener()
      } catch (error) {
        console.error('Mesaj dinleyici kurulurken hata:', error)
      }
    }

    setupListener()
  }, [])

  return {
    token,
    permission,
    registerPushToken,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
  }
}
