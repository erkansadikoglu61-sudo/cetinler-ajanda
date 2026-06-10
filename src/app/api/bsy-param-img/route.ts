import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - Görseli al
export async function GET() {
  try {
    // Signed URL kullan (1 saat geçerli)
    const { data, error } = await supabase.storage
      .from('bsy-excel')
      .createSignedUrl('parametreler.png', 3600)

    if (error) {
      return NextResponse.json({ url: null }, { status: 200 })
    }

    return NextResponse.json({ url: data.signedUrl })
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

    // Signed URL döndür
    const { data: signedData, error: signError } = await supabase.storage
      .from('bsy-excel')
      .createSignedUrl('parametreler.png', 3600)

    if (signError) throw signError

    return NextResponse.json({ url: signedData.signedUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Yükleme hatası'
    }, { status: 500 })
  }
}
