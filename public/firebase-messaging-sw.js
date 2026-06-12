// Firebase Cloud Messaging Service Worker

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase config
firebase.initializeApp({
  apiKey: 'AIzaSyCOuUZcD-1qEFDMpQ-HTdKNO8wwYcjrtiM',
  authDomain: 'cetinler-ajanda.firebaseapp.com',
  projectId: 'cetinler-ajanda',
  storageBucket: 'cetinler-ajanda.firebasestorage.app',
  messagingSenderId: '852197071934',
  appId: '1:852197071934:web:1fb9a29f18c86137fe856f',
})

const messaging = firebase.messaging()

// Background mesajları dinle
messaging.onBackgroundMessage((payload) => {
  console.log('Background mesaj alındı:', payload)

  const notificationTitle = payload.notification?.title || 'Yeni Bildirim'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: payload.data,
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})
