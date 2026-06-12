import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

// Firebase config - .env.local dosyasından alınacak
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Firebase app'i başlat
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Messaging instance
let messaging: ReturnType<typeof getMessaging> | null = null

export const getFirebaseMessaging = async () => {
  if (typeof window === 'undefined') return null

  const supported = await isSupported()
  if (!supported) return null

  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

// Push token al
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const messaging = await getFirebaseMessaging()
    if (!messaging) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Bildirim izni reddedildi')
      return null
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    })

    return token
  } catch (error) {
    console.error('Push token alınırken hata:', error)
    return null
  }
}

// Foreground mesajları dinle
export const onMessageListener = async () => {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return

  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload)
    })
  })
}
