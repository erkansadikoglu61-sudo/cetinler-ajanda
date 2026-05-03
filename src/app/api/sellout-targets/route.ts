import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const donem = req.nextUrl.searchParams.get('donem')
  if (!donem) return NextResponse.json({ error: 'donem gerekli' }, { status: 400 })

  const sb = getSupabase()
  const [pRes, mRes] = await Promise.all([
    sb.from('sellout_targets_profile').select('*').eq('donem', donem),
    sb.from('sellout_targets_merch').select('*').eq('donem', donem),
  ])

  return NextResponse.json({
    profile_targets: pRes.data ?? [],
    merch_targets:   mRes.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const { type, targets } = await req.json() as {
    type: 'profile' | 'merch'
    targets: Record<string, unknown>[]
  }
  const sb = getSupabase()

  if (type === 'profile') {
    const { error } = await sb
      .from('sellout_targets_profile')
      .upsert(targets, { onConflict: 'donem,profile_id,grup' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (type === 'merch') {
    const { error } = await sb
      .from('sellout_targets_merch')
      .upsert(targets, { onConflict: 'donem,merch_name,grup' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'Geçersiz type' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
