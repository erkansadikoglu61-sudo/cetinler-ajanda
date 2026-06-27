import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── GET: Şube bazında destek personelleri ────────────────────────
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const subeAdi = sp.get('sube_adi')
  const cariAdi = sp.get('cari_adi')

  if (!subeAdi || !cariAdi) {
    return NextResponse.json({ error: 'sube_adi ve cari_adi gerekli' }, { status: 400 })
  }

  const sb = getAdmin()
  const { data, error } = await sb
    .from('field_personnel')
    .select('id, merch_adi, merch_grubu, created_at')
    .eq('sube_adi', subeAdi)
    .eq('cari_adi', cariAdi)
    .eq('merch_grubu', 'Destek Personeli')
    .order('merch_adi')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// ─── POST: Yeni destek personeli ekle ─────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { sube_adi, cari_adi, merch_adi } = body

    if (!sube_adi || !cari_adi || !merch_adi) {
      return NextResponse.json(
        { error: 'sube_adi, cari_adi ve merch_adi gerekli' },
        { status: 400 }
      )
    }

    const sb = getAdmin()

    // Aynı kişi zaten var mı kontrol et
    const { data: existing } = await sb
      .from('field_personnel')
      .select('id')
      .eq('sube_adi', sube_adi)
      .eq('cari_adi', cari_adi)
      .eq('merch_adi', merch_adi)
      .eq('merch_grubu', 'Destek Personeli')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Bu destek personeli bu şube için zaten eklenmiş' },
        { status: 409 }
      )
    }

    // Ekle
    const { data, error } = await sb
      .from('field_personnel')
      .insert({
        sube_adi,
        cari_adi,
        merch_adi,
        merch_grubu: 'Destek Personeli',
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── DELETE: Destek personeli sil ─────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const sp = new URL(req.url).searchParams
    const id = sp.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
    }

    const sb = getAdmin()
    const { error } = await sb
      .from('field_personnel')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
