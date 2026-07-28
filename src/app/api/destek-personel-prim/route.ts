import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface DestekPersonelRow {
  merch_adi:           string
  sube_adi:            string
  cari_adi:            string
  cetinler_merch:      string
  sup_adi:             string   // Jr. Sup ise Jr. adı, değilse doğrudan Sup adı
  parent_sup_adi:      string   // Jr. Sup'ın bağlı olduğu Sup adı (yoksa '')
  kategori:            string
  hedef_gerceklesme:   number
  satis_adedi:         number
  kosullu_destek_prim: number
  hak_edis:            number
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
}

function normalize(str: string): string {
  return str.trim().toLowerCase()
    .replace(/i̇/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
}

export async function GET(req: Request) {
  const sp    = new URL(req.url).searchParams
  const yil   = sp.get('yil') ? parseInt(sp.get('yil')!) : new Date().getFullYear()
  const ay    = sp.get('ay')  ? parseInt(sp.get('ay')!)  : new Date().getMonth() + 1
  const bsyKod = sp.get('bsyKod') || null
  const supAdi = sp.get('supAdi') || null

  try {
    const sb = getAdmin()

    // 1. Destek personelleri + profiles (Jr → Sup mapping için)
    const [fpRes, profilesRes] = await Promise.all([
      sb.from('field_personnel').select('merch_adi, sube_adi, cari_adi, merch_grubu').eq('merch_grubu', 'Destek Personeli'),
      sb.from('profiles').select('id, full_name, role, manager_id'),
    ])

    if (fpRes.error) return NextResponse.json({ error: fpRes.error.message }, { status: 500 })
    const destekPersonel = fpRes.data ?? []
    if (!destekPersonel.length) return NextResponse.json({ rows: [] })

    // Jr. Sup ismi → parent Sup ismi haritası (UI gösterimi için)
    const profiles = profilesRes.data ?? []
    const profileById = new Map<string, { name: string; role: string }>(
      profiles.map((p: { id: string; full_name: string; role: string }) => [p.id, { name: p.full_name, role: p.role }])
    )
    const jrToParentSup = new Map<string, string>()
    for (const p of profiles) {
      if (p.role === 'jr' && p.manager_id) {
        const parentName = profileById.get(p.manager_id)?.name ?? ''
        if (parentName) jrToParentSup.set(normalize(p.full_name), parentName)
      }
    }

    // supAdi filtresi için: Sup'ın kendisi + ona bağlı tüm Jr. Sup isimleri
    let allowedSupNorms: Set<string> | null = null
    if (supAdi) {
      const normalizedSupAdi = normalize(supAdi)
      const supProfile = profiles.find((p: { full_name: string }) => normalize(p.full_name) === normalizedSupAdi)
      const jrNames = supProfile
        ? profiles
            .filter((p: { role: string; manager_id: string | null }) => p.role === 'jr' && p.manager_id === supProfile.id)
            .map((p: { full_name: string }) => normalize(p.full_name))
        : []
      allowedSupNorms = new Set([normalizedSupAdi, ...jrNames])
    }

    const phpUrl = process.env.PHP_API_URL
    if (!phpUrl) return NextResponse.json({ rows: [] })

    // 2. PHP'den şube+cari → Çetinler Merch / BSY / Supervisor mapping
    const phpRes = await fetch(
      'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php',
      { cache: 'no-store' }
    )
    if (!phpRes.ok) return NextResponse.json({ rows: [] })

    const html = await phpRes.text()

    const subeCarimierchMap = new Map<string, string>()
    const subeCariBsyMap    = new Map<string, string>()
    const subeCariSupMap    = new Map<string, string>()

    const trMatches = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    for (let i = 1; i < trMatches.length; i++) {
      const cells = [...trMatches[i][1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => decodeHtml(m[1].replace(/<[^>]+>/g, '')).trim())
      if (cells.length < 15) continue

      // [0] MERCH_PERSONEL, [1] CARI_ISIM, [2] SUBE_ADI
      // [9] SUPERVISOR_ADI, [14] MERCH_TIPI, [16] BSY
      const merchAdi     = cells[0]
      const cariAdi      = cells[1]
      const subeAdi      = cells[2]
      const supervisorAdi = cells[9]  ?? ''
      const merchTipi    = cells[14] ?? ''
      const bsy          = cells[16] ?? ''

      if (!subeAdi || !cariAdi) continue
      const key = `${normalize(subeAdi)}||${normalize(cariAdi)}`

      if (merchAdi && merchTipi === 'Çetinler Merch' && !subeCarimierchMap.has(key)) {
        subeCarimierchMap.set(key, merchAdi)
      }
      if (bsy)           subeCariBsyMap.set(key, bsy)
      if (supervisorAdi) subeCariSupMap.set(key, supervisorAdi)
    }

    // 3. Her destek personeli → satır oluştur (son 4 kolon boş)
    const rows: DestekPersonelRow[] = []

    for (const dp of destekPersonel) {
      const subeKey = `${normalize(dp.sube_adi)}||${normalize(dp.cari_adi)}`

      if (bsyKod) {
        if (subeCariBsyMap.get(subeKey) !== bsyKod) continue
      } else if (allowedSupNorms) {
        const phpSupNorm = normalize(subeCariSupMap.get(subeKey) || '')
        if (!allowedSupNorms.has(phpSupNorm)) continue
      }

      const cetinlerMerch = subeCarimierchMap.get(subeKey) || '-'
      const supAdiRaw    = subeCariSupMap.get(subeKey) ?? ''
      const parentSupAdi = jrToParentSup.get(normalize(supAdiRaw)) ?? ''

      rows.push({
        merch_adi:           dp.merch_adi,
        sube_adi:            dp.sube_adi,
        cari_adi:            dp.cari_adi,
        cetinler_merch:      cetinlerMerch,
        sup_adi:             supAdiRaw,
        parent_sup_adi:      parentSupAdi,
        kategori:            '-',
        hedef_gerceklesme:   0,
        satis_adedi:         0,
        kosullu_destek_prim: 0,
        hak_edis:            0,
      })
    }

    rows.sort((a, b) => a.merch_adi.localeCompare(b.merch_adi, 'tr'))

    return NextResponse.json({ rows })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
