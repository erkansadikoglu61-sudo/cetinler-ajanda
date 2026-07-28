import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: Request) {
  const sp     = new URL(req.url).searchParams
  const yil    = sp.get('yil')    ? parseInt(sp.get('yil')!)    : new Date().getFullYear()
  const ay     = sp.get('ay')     ? parseInt(sp.get('ay')!)     : new Date().getMonth() + 1
  const supAdi = sp.get('supAdi') ?? null

  try {
    const sb = getAdmin()
    let query = sb
      .from('destek_hakedis')
      .select('*')
      .eq('yil', yil)
      .eq('ay', ay)

    if (supAdi) {
      // PHP K kolonunda "Ad Soyad SV" formatı gelebilir; profil adı "Ad Soyad" formatında.
      // Her iki varyantı da eşleştirmek için .in() kullan.
      const base = supAdi.replace(/\s+sv\s*$/i, '').trim()
      const variants = Array.from(new Set([supAdi, base, `${base} SV`, `${base} Sv`].filter(Boolean)))
      query = query.in('sup_adi', variants)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rows: data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { yil, ay, cari_adi, sube_adi, cetinler_merch, merch_adi, hakedis, sup_adi } = body

    if (!yil || !ay || !cari_adi || !merch_adi) {
      return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 })
    }

    const sb = getAdmin()
    const { error } = await sb
      .from('destek_hakedis')
      .upsert(
        { yil, ay, cari_adi, sube_adi: sube_adi ?? '', cetinler_merch: cetinler_merch ?? '', merch_adi, hakedis: hakedis ?? 0, sup_adi: sup_adi ?? '', updated_at: new Date().toISOString() },
        { onConflict: 'yil,ay,cari_adi,sube_adi,cetinler_merch,merch_adi' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
