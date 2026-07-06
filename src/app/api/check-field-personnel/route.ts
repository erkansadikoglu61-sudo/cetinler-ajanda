import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error, count } = await supabase
      .from('field_personnel')
      .select('merch_adi, merch_grubu, sup_adi, cari_adi', { count: 'exact' })
      .order('merch_adi')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // İlk harf grupları
    const groupByFirstLetter = new Map<string, number>()
    data?.forEach(row => {
      const firstLetter = row.merch_adi?.[0]?.toUpperCase() || '?'
      groupByFirstLetter.set(firstLetter, (groupByFirstLetter.get(firstLetter) || 0) + 1)
    })

    const letterGroups = Array.from(groupByFirstLetter.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
      .map(([letter, count]) => ({ letter, count }))

    return NextResponse.json({
      totalCount: count,
      letterGroups,
      lastRecords: data?.slice(-10) || [],
      firstRecords: data?.slice(0, 10) || []
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
