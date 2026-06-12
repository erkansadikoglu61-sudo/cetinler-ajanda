import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Firebase Admin SDK test
    const { initializeApp, getApps, cert } = await import('firebase-admin/app')
    const { getMessaging } = await import('firebase-admin/messaging')

    let adminApp
    if (getApps().length === 0) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null

      if (!serviceAccount) {
        return NextResponse.json({ error: 'Service account eksik' }, { status: 500 })
      }

      adminApp = initializeApp({
        credential: cert(serviceAccount),
      })
    } else {
      adminApp = getApps()[0]
    }

    return NextResponse.json({
      status: 'ok',
      firebaseInitialized: true,
      appName: adminApp.name,
      hasMessaging: !!getMessaging,
      env: {
        hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        hasVapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
