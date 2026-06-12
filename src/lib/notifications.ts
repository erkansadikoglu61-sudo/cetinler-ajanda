'use client'

// Basit browser notification - Service Worker yok!
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function sendBrowserNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon.png',
      badge: '/badge.png',
      tag: 'task-notification',
      requireInteraction: false,
    })
  }
}

export function checkNotificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window
}
