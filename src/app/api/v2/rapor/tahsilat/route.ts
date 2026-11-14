import { NextResponse } from 'next/server'
import { bsyDonemdeGorunur } from '@/lib/bsy'
import { namesMatch } from '@/lib/sellout'
import { v2Istek, donemGecerli, buDonem, HERKESI_GOREN } from '@/lib/v2/sunucu'
import { GET as tahsilatGet, type TahsilatResponse } from '@/app/api/tahsilat/route'

// v2 Raporlar — Tahsilat: BSY bazında açık hesap, hedef (%90), gerçekleşen ve cari detayı.
// Hesap v1 "Ciro ve Tahsilat Takip" ile aynı motordan (/api/tahsilat, SAHA.xlsx).
// Yönetici / İK / Yönetim: tüm BSY'ler; BSY: yalnızca kendisi. Ayrılan BSY dönem sonrası gizli.
// GET ?donem=YYYY-MM[&gorunum=<profil id>]

export const maxDuration = 300

export async function GET(req: Request) {
  const ctx = await v2Istek(req, ['admin', 'ik', 'manager', 'bsy'])
  if (ctx instanceof NextResponse) return ctx
  const sp = new URL(req.url).searchParams
  const donem = donemGecerli(sp.get('donem')) ? sp.get('donem')! : buDonem()
  const [yil, ay] = donem.split('-').map(Number)

  try {
    const res = await tahsilatGet(new Request(`http://v2.local/api/tahsilat?yil=${yil}&ay=${ay}`))
    const json = await res.json() as TahsilatResponse
    const herkes = HERKESI_GOREN.includes(ctx.ben.role)
    const izinli = (bsyAdi: string) =>
      bsyDonemdeGorunur(bsyAdi, yil, ay) && (herkes || namesMatch(bsyAdi, ctx.ben.full_name))
    const rows = (json.rows ?? []).filter(r => izinli(r.bsyAdi))
    const detay = (json.detay ?? []).filter(d => izinli(d.bsyAdi) && d.ay === ay)
    return NextResponse.json({ donem, rows, detay })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
