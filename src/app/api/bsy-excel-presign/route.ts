import { requireRole, ROLLER } from '@/lib/apiAuth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET   = 'bsy-excel'
const OBJ_NAME = 'SAHA.xlsx'

export async function POST(req: Request) {
  const yetki = await requireRole(req, ROLLER.ADMIN_BSY)
  if (yetki instanceof NextResponse) return yetki
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(OBJ_NAME, { upsert: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: data.path })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
