import type { Metadata } from 'next'

// v2'nin kendi uygulama kimliği: bu sayfadan "Ana Ekrana Ekle" yapılınca
// simge doğrudan /v2'yi açar (sitenin genel manifest'i / → v1'i açıyor).
export const metadata: Metadata = {
  title: 'Çetinler Ajanda v2',
  manifest: '/manifest-v2.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ajanda v2',
  },
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return children
}
