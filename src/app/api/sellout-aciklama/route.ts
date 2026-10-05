import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sellout sekmeleri (sup / jr / merch) için aylık açıklama notu.
// GET  ?donem=YYYY-MM&sekme=sup|jr|merch → { metin, updated_at }
// POST { donem, sekme, metin, updated_by } → upsert. Yalnızca admin yazar;
//   updated_by profilinin rolü sunucuda doğrulanır.

const SEKMELER = ['sup', 'jr', 'merch']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const donem = sp.get('donem') ?? ''
  const sekme = sp.get('sekme') ?? ''
  if (!/^\d{4}-\d{2}$/.test(donem) || !SEKMELER.includes(sekme)) {
    return NextResponse.json({ error: 'donem/sekme geçersiz' }, { status: 400 })
  }
  const { data, error } = await getSupabase()
    .from('sellout_aciklama')
    .select('metin, updated_at')
    .eq('donem', donem)
    .eq('sekme', sekme)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ metin: data?.metin ?? '', updated_at: data?.updated_at ?? null })
}

export async function POST(req: Request) {
  try {
    const { donem, sekme, metin, updated_by } = await req.json() as {
      donem: string; sekme: string; metin: string; updated_by?: string
    }
    if (!updated_by) return NextResponse.json({ error: 'Yetki bilgisi eksik' }, { status: 401 })
    if (!/^\d{4}-\d{2}$/.test(donem ?? '') || !SEKMELER.includes(sekme)) {
      return NextResponse.json({ error: 'donem/sekme geçersiz' }, { status: 400 })
    }

    const sb = getSupabase()
    const { data: prof } = await sb.from('profiles').select('role').eq('id', updated_by).single()
    if (!prof || prof.role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { error } = await sb
      .from('sellout_aciklama')
      .upsert(
        { donem, sekme, metin: (metin ?? '').trim(), updated_by, updated_at: new Date().toISOString() },
        { onConflict: 'donem,sekme' },
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
