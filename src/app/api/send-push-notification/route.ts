import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { pushTokens, title, body, data } = await req.json()

    if (!pushTokens || !Array.isArray(pushTokens) || pushTokens.length === 0) {
      return NextResponse.json(
        { error: 'pushTokens gerekli (array)' },
        { status: 400 }
      )
    }

    // Firebase Admin SDK'yı dinamik import
    const { initializeApp, getApps, cert } = await import('firebase-admin/app')
    const { getMessaging } = await import('firebase-admin/messaging')

    // Firebase Admin başlatılmamışsa başlat
    if (getApps().length === 0) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null

      if (!serviceAccount) {
        return NextResponse.json(
          { error: 'Firebase yapılandırması eksik' },
          { status: 500 }
        )
      }

      initializeApp({
        credential: cert(serviceAccount),
      })
    }

    // Boş tokenları filtrele
    const validTokens = pushTokens.filter((token: string) => token && token.trim())

    if (validTokens.length === 0) {
      return NextResponse.json(
        { error: 'Geçerli push token bulunamadı' },
        { status: 400 }
      )
    }

    // FCM mesajını oluştur ve gönder
    const messaging = getMessaging()

    // Data alanındaki tüm değerleri string'e çevir (Firebase requirement)
    const stringData: Record<string, string> = {}
    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        stringData[key] = String(data[key])
      })
    }

    const results = await Promise.allSettled(
      validTokens.map((token: string) =>
        messaging.send({
          notification: {
            title: title || 'Yeni Bildirim',
            body: body || '',
          },
          data: stringData,
          token,
        })
      )
    )

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failureCount = results.filter((r) => r.status === 'rejected').length

    console.log(`✅ Push notification: ${successCount} başarılı, ${failureCount} başarısız`)

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failureCount,
      totalTokens: validTokens.length,
    })
  } catch (error: any) {
    console.error('❌ Push notification hatası:', error.message)
    return NextResponse.json(
      { error: error.message || 'Push notification gönderilemedi' },
      { status: 500 }
    )
  }
}
