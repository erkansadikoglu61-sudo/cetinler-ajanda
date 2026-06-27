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
    .select('id, merch_adi, merch_grubu, yil, ay, created_at')
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
    const { sube_adi, cari_adi, merch_adi, yil, ay } = body

    if (!sube_adi || !cari_adi || !merch_adi) {
      return NextResponse.json(
        { error: 'sube_adi, cari_adi ve merch_adi gerekli' },
        { status: 400 }
      )
    }

    // Yıl/Ay kontrolü - sadece mevcut ay ve sonrası
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const targetYear = yil ?? currentYear
    const targetMonth = ay ?? currentMonth

    // Geçmiş tarih kontrolü
    if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
      return NextResponse.json(
        { error: 'Geçmiş aylara destek personeli eklenemez' },
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
      .eq('yil', targetYear)
      .eq('ay', targetMonth)
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
        yil: targetYear,
        ay: targetMonth,
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
    const yil = sp.get('yil') ? parseInt(sp.get('yil')!) : null
    const ay = sp.get('ay') ? parseInt(sp.get('ay')!) : null

    if (!id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
    }

    // Tarih kontrolü
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    if (yil && ay) {
      // Geçmiş tarih kontrolü
      if (yil < currentYear || (yil === currentYear && ay < currentMonth)) {
        return NextResponse.json(
          { error: 'Geçmiş aylardaki destek personeli silinemez' },
          { status: 400 }
        )
      }
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
