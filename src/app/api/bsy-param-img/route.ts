import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - Görseli al
export async function GET() {
  try {
    const { data } = supabase.storage
      .from('bsy-excel')
      .getPublicUrl('parametreler.png')

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    return NextResponse.json({ error: 'Görsel alınamadı' }, { status: 500 })
  }
}

// POST - Görsel yükle
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from('bsy-excel')
      .upload('parametreler.png', buffer, {
        contentType: file.type,
        upsert: true
      })

    if (error) throw error

    const { data } = supabase.storage
      .from('bsy-excel')
      .getPublicUrl('parametreler.png')

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Yükleme hatası'
    }, { status: 500 })
  }
}
