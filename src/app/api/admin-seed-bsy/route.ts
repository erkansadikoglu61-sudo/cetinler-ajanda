import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BSY_LIST = [
  { full_name: 'Atilla YILMAZ',     color: '#ef4444' },
  { full_name: 'Burak KILIÇ',       color: '#f97316' },
  { full_name: 'Erdem BOZYEL',      color: '#eab308' },
  { full_name: 'Erkan SADIKOĞLU',   color: '#84cc16' },
  { full_name: 'Kemal TUNALI',      color: '#22c55e' },
  { full_name: 'Mehmet KATIRCI',    color: '#14b8a6' },
  { full_name: 'Mustafa CETİNKAYA',color: '#3b82f6' },
  { full_name: 'Mutlu TOPAY',       color: '#8b5cf6' },
  { full_name: 'Okan OĞUZ',         color: '#ec4899' },
  { full_name: 'Orçun SOYUBİTMEZ', color: '#06b6d4' },
]

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Mevcut BSY'leri al
  const { data: existing } = await sb
    .from('profiles')
    .select('full_name')
    .eq('role', 'bsy')

  const existingNames = new Set((existing ?? []).map((r: { full_name: string }) => r.full_name))

  // Eksik olanları ekle
  const toInsert = BSY_LIST.filter(b => !existingNames.has(b.full_name))

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, message: 'Tüm BSYler zaten mevcut', existing: [...existingNames] })
  }

  const { data, error } = await sb
    .from('profiles')
    .insert(toInsert.map(b => ({
      full_name:  b.full_name,
      role:       'bsy',
      color:      b.color,
      manager_id: null,
      email:      null,
    })))
    .select('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok:      true,
    added:   data?.map((r: { full_name: string }) => r.full_name),
    skipped: [...existingNames],
  })
}
