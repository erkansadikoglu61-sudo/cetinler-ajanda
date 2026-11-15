import { NextResponse } from 'next/server'
import { v2Istek } from '@/lib/v2/sunucu'
import { bildirimGonder, bildirimHazirMi } from '@/lib/v2/bildirim'

// v2 — istemcide gerçekleşen olaylar için bildirim (görev ataması, görev notu, deneme).
// POST { tip: 'gorev' | 'not' | 'test', gorevId? }
//  - gorev: başkasına açılan görev → görevin sahibine
//  - not:   göreve not eklendi → görev sahibine ve görevi açana (notu yazan hariç)
//  - test:  kendine deneme bildirimi
// Olay sunucuda doğrulanır (görev gerçekten var mı, çağıran gerçekten açan/yazan mı).

function trTarih(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export async function POST(req: Request) {
  const ctx = await v2Istek(req)
  if (ctx instanceof NextResponse) return ctx
  const b = await req.json().catch(() => null) as { tip?: string; gorevId?: string } | null
  const ben = ctx.profiller.find(p => p.id === ctx.kullaniciId)
  const adim = ben?.full_name ?? 'Bir kullanıcı'

  if (b?.tip === 'test') {
    if (!bildirimHazirMi()) return NextResponse.json({ error: 'Bildirim anahtarı (VAPID_PRIVATE_KEY) Vercel\'de tanımlı değil.' }, { status: 503 })
    const n = await bildirimGonder(ctx.sb, [ctx.kullaniciId], { baslik: 'Çetinler Ajanda', govde: 'Bildirimler açık ✓', url: '/v2' })
    return NextResponse.json({ ok: true, gonderilen: n })
  }

  if (!b?.gorevId || (b.tip !== 'gorev' && b.tip !== 'not')) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }
  const { data: g } = await ctx.sb.from('tasks')
    .select('id, pid, created_by, date, type, customer').eq('id', b.gorevId).maybeSingle()
  if (!g) return NextResponse.json({ error: 'Görev bulunamadı' }, { status: 404 })

  if (b.tip === 'gorev') {
    if (g.created_by !== ctx.kullaniciId || g.pid === ctx.kullaniciId) return NextResponse.json({ ok: true, gonderilen: 0 })
    const n = await bildirimGonder(ctx.sb, [g.pid], {
      baslik: 'Yeni görev',
      govde: `${adim}: ${g.type}${g.customer ? ' · ' + g.customer : ''} (${trTarih(g.date)})`,
      url: '/v2',
    })
    return NextResponse.json({ ok: true, gonderilen: n })
  }

  // not: notu yazan gerçekten bu kullanıcı mı (son not)
  const { data: not } = await ctx.sb.from('task_notes')
    .select('author_id, text').eq('task_id', g.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!not || not.author_id !== ctx.kullaniciId) return NextResponse.json({ ok: true, gonderilen: 0 })
  const alicilar = [g.pid, g.created_by].filter((x): x is string => !!x && x !== ctx.kullaniciId)
  const n = await bildirimGonder(ctx.sb, alicilar, {
    baslik: `Görev notu · ${g.type}`,
    govde: `${adim}: ${String(not.text).slice(0, 120)}`,
    url: '/v2',
  })
  return NextResponse.json({ ok: true, gonderilen: n })
}
