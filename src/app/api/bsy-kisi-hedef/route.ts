import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BrandKey, BsyKisiHedefRecord, BsyKisiExtraRecord } from '@/lib/bsy'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// GET /api/bsy-kisi-hedef?yil=2026&ay=5
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yil = parseInt(searchParams.get('yil') ?? '0')
  const ay  = parseInt(searchParams.get('ay')  ?? '0')

  if (!yil || !ay) {
    return NextResponse.json({ error: 'yil ve ay gerekli' }, { status: 400 })
  }

  const sb = getAdmin()
  const [hedefRes, extraRes] = await Promise.all([
    sb.from('bsy_kisi_hedef').select('*').eq('yil', yil).eq('ay', ay),
    sb.from('bsy_kisi_extra').select('*').eq('yil', yil).eq('ay', ay),
  ])

  if (hedefRes.error) return NextResponse.json({ error: hedefRes.error.message }, { status: 500 })
  if (extraRes.error) return NextResponse.json({ error: extraRes.error.message }, { status: 500 })

  const hedefRows: BsyKisiHedefRecord[] = (hedefRes.data ?? []).map((r: Record<string, unknown>) => ({
    yil:           r.yil as number,
    ay:            r.ay as number,
    bsyAdi:        r.bsy_adi as string,
    brand:         r.brand as BrandKey,
    hedefCiro:     (r.hedef_ciro as number) ?? 0,
    hakedilenPrim: r.hakedilen_prim as number | null,
  }))

  const extraRows: BsyKisiExtraRecord[] = (extraRes.data ?? []).map((r: Record<string, unknown>) => ({
    yil:         r.yil as number,
    ay:          r.ay as number,
    bsyAdi:      r.bsy_adi as string,
    markaCarp:   r.marka_carp as number | null,
    tahsiatCarp: r.tahsiat_carp as number | null,
  }))

  return NextResponse.json({ hedefRows, extraRows })
}

// POST /api/bsy-kisi-hedef
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { yil, ay, hedefRows, extraRows } = body as {
      yil:       number
      ay:        number
      hedefRows: { bsyAdi: string; brand: BrandKey; hedefCiro: number; hakedilenPrim?: number | null }[]
      extraRows: { bsyAdi: string; markaCarp?: number | null; tahsiatCarp?: number | null }[]
    }

    if (!yil || !ay) {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
    }

    const sb = getAdmin()

    if (hedefRows?.length) {
      const rows = hedefRows.map(r => ({
        yil,
        ay,
        bsy_adi:        r.bsyAdi,
        brand:          r.brand,
        hedef_ciro:     r.hedefCiro,
        hakedilen_prim: r.hakedilenPrim ?? null,
      }))
      const { error } = await sb
        .from('bsy_kisi_hedef')
        .upsert(rows, { onConflict: 'yil,ay,bsy_adi,brand' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (extraRows?.length) {
      const rows = extraRows.map(r => ({
        yil,
        ay,
        bsy_adi:      r.bsyAdi,
        marka_carp:   r.markaCarp ?? null,
        tahsiat_carp: r.tahsiatCarp ?? null,
      }))
      const { error } = await sb
        .from('bsy_kisi_extra')
        .upsert(rows, { onConflict: 'yil,ay,bsy_adi' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
