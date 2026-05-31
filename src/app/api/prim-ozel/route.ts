import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// GET /api/prim-ozel?yil=&ay=
export async function GET(req: Request) {
  const sp  = new URL(req.url).searchParams
  const yil = parseInt(sp.get('yil') ?? String(new Date().getFullYear()))
  const ay  = parseInt(sp.get('ay')  ?? String(new Date().getMonth() + 1))

  const { data, error } = await sb()
    .from('prim_ozel')
    .select('*')
    .eq('yil', yil)
    .eq('ay', ay)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// POST /api/prim-ozel  — yeni satır ekle
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { error, data } = await sb()
      .from('prim_ozel')
      .insert({
        stok_kodu:     body.stokKodu,
        yil:           body.yil,
        ay:            body.ay,
        tarih:         body.tarih     || null,
        cari_adi:      body.cariAdi   || null,
        sube_adi:      body.subeAdi   || null,
        bayi_merch:    body.bayiMerch    ?? null,
        kosullu_destek: body.kosulluDestek ?? null,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ row: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/prim-ozel?id=  — güncelle
export async function PUT(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
  try {
    const body = await req.json()
    const { error } = await sb()
      .from('prim_ozel')
      .update({
        stok_kodu:      body.stokKodu,
        tarih:          body.tarih     || null,
        cari_adi:       body.cariAdi   || null,
        sube_adi:       body.subeAdi   || null,
        bayi_merch:     body.bayiMerch    ?? null,
        kosullu_destek: body.kosulluDestek ?? null,
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/prim-ozel?id=
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
  const { error } = await sb().from('prim_ozel').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
