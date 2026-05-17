import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET() {
  const sb = getAdmin()
  const { data, error } = await sb.from('bsy_parametreler').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const { rows } = await req.json() as {
      rows: { key: string; label: string; value: number }[]
    }
    const sb = getAdmin()
    const { error } = await sb
      .from('bsy_parametreler')
      .upsert(rows.map(r => ({ key: r.key, label: r.label, value: r.value })),
        { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
