import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BrandKey, BRAND_KEYS, BsyHedefRecord } from '@/lib/bsy'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// GET /api/bsy-hedef?yil=2025&ay=4
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yil = parseInt(searchParams.get('yil') ?? '0')
  const ay  = parseInt(searchParams.get('ay')  ?? '0')

  if (!yil || !ay) {
    return NextResponse.json({ error: 'yil ve ay gerekli' }, { status: 400 })
  }

  const sb = getAdmin()
  const { data, error } = await sb
    .from('bsy_hedef')
    .select('*')
    .eq('yil', yil)
    .eq('ay', ay)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // camelCase dönüşüm
  const rows: BsyHedefRecord[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id:         r.id as string,
    yil:        r.yil as number,
    ay:         r.ay as number,
    brand:      r.brand as BrandKey,
    hedefCiro:  r.hedef_ciro as number,
    toplamPrim: r.toplam_prim as number,
    enteredBy:  r.entered_by as string | undefined,
  }))

  return NextResponse.json({ rows })
}

// POST /api/bsy-hedef
// Body: { yil, ay, records: { brand, hedefCiro, toplamPrim }[] }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { yil, ay, records } = body as {
      yil:     number
      ay:      number
      records: { brand: BrandKey; hedefCiro: number; toplamPrim: number }[]
    }

    if (!yil || !ay || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
    }

    const sb = getAdmin()

    // UPSERT: (yil, ay, brand) unique
    const rows = records
      .filter(r => BRAND_KEYS.includes(r.brand))
      .map(r => ({
        yil,
        ay,
        brand:       r.brand,
        hedef_ciro:  r.hedefCiro,
        toplam_prim: r.toplamPrim,
      }))

    const { error } = await sb
      .from('bsy_hedef')
      .upsert(rows, { onConflict: 'yil,ay,brand' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
