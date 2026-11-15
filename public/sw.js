// Çetinler Ajanda — bildirim service worker (web push)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { govde: event.data && event.data.text() } }
  const baslik = d.baslik || 'Çetinler Ajanda'
  event.waitUntil(self.registration.showNotification(baslik, {
    body: d.govde || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: d.url || '/v2' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/v2'
  event.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const p of pencereler) {
      if (p.url.includes(url) && 'focus' in p) return p.focus()
    }
    return self.clients.openWindow(url)
  })())
})
