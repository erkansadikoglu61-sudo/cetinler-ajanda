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
    const { data, error } = await getAdmin()
      .from('merch_destek_flag')
      .select('merch_name, destek_var')
      .eq('donem', donem)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ flags: data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { donem, flags }: { donem: string; flags: { merch_name: string; destek_var: boolean }[] } = await req.json()
    if (!donem || !flags?.length) return NextResponse.json({ ok: true })
    const rows = flags.map(f => ({ donem, merch_name: f.merch_name, destek_var: f.destek_var }))
    const { error } = await getAdmin()
      .from('merch_destek_flag')
      .upsert(rows, { onConflict: 'donem,merch_name' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
