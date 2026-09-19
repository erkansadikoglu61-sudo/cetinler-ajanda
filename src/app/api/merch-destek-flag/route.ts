import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: Request) {
  const donem = new URL(req.url).searchParams.get('donem') ?? ''
  if (!donem) return NextResponse.json({ flags: [] })
  try {
    // select('*') → "gizle" kolonu henüz migrate edilmemişse de patlamaz
    const { data, error } = await getAdmin()
      .from('merch_destek_flag')
      .select('*')
      .eq('donem', donem)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const flags = (data ?? []).map((r: { merch_name: string; destek_var?: boolean; gizle?: boolean }) => ({
      merch_name: r.merch_name,
      destek_var: r.destek_var ?? false,
      gizle: r.gizle ?? false,
    }))
    return NextResponse.json({ flags })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { donem, flags }: { donem: string; flags: { merch_name: string; destek_var: boolean; gizle?: boolean }[] } = await req.json()
    if (!donem || !flags?.length) return NextResponse.json({ ok: true })
    const sb = getAdmin()
    const rows = flags.map(f => ({ donem, merch_name: f.merch_name, destek_var: f.destek_var, gizle: f.gizle ?? false }))
    let { error } = await sb.from('merch_destek_flag').upsert(rows, { onConflict: 'donem,merch_name' })
    // "gizle" kolonu henüz migrate edilmediyse: sadece destek_var kaydet (regression olmasın)
    if (error && /gizle/i.test(error.message)) {
      const rows2 = flags.map(f => ({ donem, merch_name: f.merch_name, destek_var: f.destek_var }))
      ;({ error } = await sb.from('merch_destek_flag').upsert(rows2, { onConflict: 'donem,merch_name' }))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
