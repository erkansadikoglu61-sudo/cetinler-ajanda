import { NextResponse } from 'next/server'

// v2 — canlıdaki yapı sürümü (next.config.js YAPI_SURUMU). Açık pencere kendi
// sürümüyle karşılaştırır; farklıysa yenileme şeridi çıkar.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ surum: process.env.YAPI_SURUMU ?? '' }, { headers: { 'Cache-Control': 'no-store' } })
}
