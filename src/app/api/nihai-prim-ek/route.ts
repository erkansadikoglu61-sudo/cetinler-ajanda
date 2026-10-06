import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Nihai Prim Listesi — Ek (performans) primi.
// GET  ?yil=YYYY → o yılın tüm ek prim kayıtları
// POST { yil, ay, kullanici_tipi, kullanici_adi, tutar, aciklama, updated_by }
//   → upsert (tutar 0/boş → kayıt silinir). Yalnızca admin ve İK yazabilir;
//     updated_by profilinin rolü sunucuda doğrulanır.

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface NihaiPrimEkRow {
  yil: number
  ay: number
  kullanici_tipi: string
  kullanici_adi: string
  tutar: number
  aciklama: string
}

export async function GET(req: Request) {
  const yil = parseInt(new URL(req.url).searchParams.get('yil') ?? String(new Date().getFullYear()))
  const { data, error } = await getSupabase()
    .from('nihai_prim_ek')
    .select('yil, ay, kullanici_tipi, kullanici_adi, tutar, aciklama')
    .eq('yil', yil)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: ((data ?? []) as NihaiPrimEkRow[]).map(r => ({ ...r, tutar: Number(r.tutar) || 0 })) })
}

export async function POST(req: Request) {
  try {
    const b = await req.json()
    const { yil, ay, kullanici_tipi, kullanici_adi, updated_by } = b
    const tutar = Number(b.tutar) || 0
    const aciklama = String(b.aciklama ?? '').trim()

    if (!updated_by) return NextResponse.json({ error: 'Yetki bilgisi eksik' }, { status: 401 })
    if (!yil || !ay || !kullanici_tipi || !kullanici_adi) {
      return NextResponse.json({ error: 'Eksik alan' }, { status: 400 })
    }
    if (tutar < 0) return NextResponse.json({ error: 'Ek prim negatif olamaz' }, { status: 400 })

    const sb = getSupabase()
    const { data: prof } = await sb.from('profiles').select('role').eq('id', updated_by).single()
    if (!prof || (prof.role !== 'admin' && prof.role !== 'ik')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    if (tutar === 0) {
      const { error } = await sb.from('nihai_prim_ek').delete()
        .eq('yil', yil).eq('ay', ay).eq('kullanici_tipi', kullanici_tipi).eq('kullanici_adi', kullanici_adi)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: true })
    }

    const { error } = await sb.from('nihai_prim_ek').upsert(
      { yil, ay, kullanici_tipi, kullanici_adi, tutar, aciklama, updated_by, updated_at: new Date().toISOString() },
      { onConflict: 'yil,ay,kullanici_tipi,kullanici_adi' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
