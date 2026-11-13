import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'
import {
  V2Nokta, V2Profil, V2BsyLink, V2Kisi, gorunurNoktalar, noktaAnahtari, sadeAd, altKullanicilar,
} from '@/lib/v2/nokta'
import { namesMatch } from '@/lib/sellout'

// v2 — tek "şube → kullanıcılar" kaynağı.
//  1. export_bsy_cari_sube.php : tüm cari / şube + BSY (ana liste)
//  2. export_merch_detay.php   : şubedeki Sup / Jr / Çetinler Merch / Bayi Merch
//  3. Supabase field_personnel  : Destek Personeli (isimle şube eşleşmesi)
// Görünürlük sunucuda uygulanır (lib/v2/nokta gorunurNoktalar); istemciye
// yalnızca görebildiği noktalar gider. IBAN yalnızca kişinin kendi kaydında döner.

export const maxDuration = 300

const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'
const MERCH_URL     = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

const TUM_ROLLER = ['admin', 'bsy', 'sup', 'jr', 'merch', 'manager', 'ik']

interface MerchKaydi {
  ad: string
  merchId: string
  tip: string
  cariAdi: string
  subeAdi: string
  iban: string
}

interface Model {
  noktalar: V2Nokta[]
  merchKayitlari: MerchKaydi[]
  eslesmeyenDestek: { ad: string; cariAdi: string; subeAdi: string }[]
  zaman: number
}

let modelCache: Model | null = null
const MODEL_TTL = 10 * 60 * 1000

function ekleKisi(liste: V2Kisi[], k: V2Kisi) {
  if (!liste.some(x => namesMatch(x.ad, k.ad))) liste.push(k)
}
function ekleAd(liste: string[], ad: string) {
  if (ad && !liste.some(x => namesMatch(x, ad))) liste.push(ad)
}

async function modelOlustur(yenile: boolean): Promise<Model> {
  if (!yenile && modelCache && Date.now() - modelCache.zaman < MODEL_TTL) return modelCache

  const [csHtml, mdHtml] = await Promise.all([
    fetchPhpHtml(CARI_SUBE_URL, { force: yenile }),
    fetchPhpHtml(MERCH_URL, { force: yenile }),
  ])
  const { rows: csRows } = parseHtmlTableByHeader(csHtml)
  const { rows: mdRows } = parseHtmlTableByHeader(mdHtml)

  const byKey = new Map<string, V2Nokta>()
  // Ad bazlı ikinci indeks: kodu farklı / boş gelen kayıtları aynı noktaya bağlamak için
  const byAd = new Map<string, V2Nokta>()

  const noktaAl = (subeKod: string, cariKod: string, cariAdi: string, subeAdi: string, bsyKod: string, bsyAdi: string) => {
    const key = noktaAnahtari(subeKod, cariAdi, subeAdi)
    const adKey = `${sadeAd(cariAdi)}||${sadeAd(subeAdi)}`
    let n = byKey.get(key) ?? byAd.get(adKey)
    if (!n) {
      n = {
        key, subeKod, subeAdi, cariKod, cariAdi, bsyKod, bsyAdi,
        sups: [], jrs: [], cetinlerMerch: [], bayiMerch: [], destek: [],
      }
      byKey.set(key, n)
      if (!byAd.has(adKey)) byAd.set(adKey, n)
    }
    if (!n.cariKod && cariKod) n.cariKod = cariKod
    if (!n.bsyKod && bsyKod) n.bsyKod = bsyKod
    if (!n.bsyAdi && bsyAdi) n.bsyAdi = bsyAdi
    return n
  }

  for (const r of csRows) {
    const cariAdi = (r['CARI_ADI'] ?? '').trim()
    if (!cariAdi) continue
    noktaAl(
      (r['SUBE_KOD'] ?? '').trim(), (r['CARI_KOD'] ?? '').trim(), cariAdi,
      (r['SUBE_ADI'] ?? '').trim(), (r['BSY_KODU'] ?? '').trim(), (r['BSY_ADI'] ?? '').trim(),
    )
  }

  const merchKayitlari: MerchKaydi[] = []
  for (const r of mdRows) {
    const cariAdi = (r['CARI_ISIM'] ?? '').trim()
    const subeAdi = (r['SUBE_ADI'] ?? '').trim()
    if (!cariAdi && !subeAdi) continue
    const n = noktaAl(
      (r['SUBE_KODU'] ?? '').trim(), (r['CARI_KODU'] ?? '').trim(), cariAdi, subeAdi,
      (r['BSY_KODU'] ?? '').trim(), (r['BSY_ADI'] ?? '').trim(),
    )
    ekleAd(n.sups, (r['SUPERVIZOR'] ?? '').trim())
    ekleAd(n.jrs, (r['JR_SUPERVIZOR'] ?? '').trim())
    const ad = (r['MERCH_ADI'] ?? '').trim()
    if (!ad) continue
    const tip = (r['MERCH_TIPI'] ?? '').trim()
    const tipSade = sadeAd(tip)
    const kisi: V2Kisi = { ad, merchId: (r['MERCH_ID'] ?? '').trim() || undefined }
    if (tipSade.includes('cetinler')) ekleKisi(n.cetinlerMerch, kisi)
    else if (tipSade.includes('destek')) ekleKisi(n.destek, kisi)
    else ekleKisi(n.bayiMerch, kisi)
    merchKayitlari.push({ ad, merchId: kisi.merchId ?? '', tip, cariAdi, subeAdi, iban: (r['IBAN'] ?? '').trim() })
  }

  // Destek Personeli (Supabase field_personnel) — cari + şube adıyla eşleşir
  const eslesmeyenDestek: Model['eslesmeyenDestek'] = []
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    const { data } = await sb
      .from('field_personnel')
      .select('merch_adi, cari_adi, sube_adi')
      .eq('merch_grubu', 'Destek Personeli')
    for (const d of data ?? []) {
      const ad = (d.merch_adi ?? '').trim()
      if (!ad) continue
      const n = byAd.get(`${sadeAd(d.cari_adi ?? '')}||${sadeAd(d.sube_adi ?? '')}`)
      if (n) ekleKisi(n.destek, { ad })
      else eslesmeyenDestek.push({ ad, cariAdi: d.cari_adi ?? '', subeAdi: d.sube_adi ?? '' })
    }
  } catch { /* destek olmadan devam */ }

  modelCache = { noktalar: [...byKey.values()], merchKayitlari, eslesmeyenDestek, zaman: Date.now() }
  return modelCache
}

export async function GET(req: Request) {
  const user = await requireRole(req, TUM_ROLLER)
  if (user instanceof NextResponse) return user

  const sp = new URL(req.url).searchParams
  const yenile = sp.get('yenile') === '1'
  // Admin başka bir kullanıcının gözünden bakabilir (v2 kontrolü için)
  const gorunumId = user.role === 'admin' ? (sp.get('gorunum') || user.id) : user.id

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  try {
    const [model, profRes, linkRes] = await Promise.all([
      modelOlustur(yenile),
      sb.from('profiles').select('id, full_name, role, manager_id').order('full_name'),
      sb.from('bsy_supervisors').select('bsy_id, sup_id'),
    ])
    const profiller = (profRes.data ?? []) as V2Profil[]
    const links = (linkRes.data ?? []) as V2BsyLink[]
    const ben = profiller.find(p => p.id === gorunumId)
    if (!ben) return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 })

    const noktalar = gorunurNoktalar(model.noktalar, ben, profiller, links)

    // Hesabım kimlik kartı
    const ust = ben.role === 'sup'
      ? profiller.find(p => p.id === links.find(l => l.sup_id === ben.id)?.bsy_id)
      : ben.manager_id ? profiller.find(p => p.id === ben.manager_id) : undefined
    const merchKaydi = model.merchKayitlari.filter(m => namesMatch(m.ad, ben.full_name))
    const iban = merchKaydi.map(m => m.iban).find(i => /^TR\d{24}$/i.test(i.replace(/\s/g, ''))) ?? ''
    const altlar = altKullanicilar(ben, profiller, links)

    return NextResponse.json({
      kullanici: {
        id: ben.id,
        ad: ben.full_name,
        rol: ben.role,
        ust: ust?.full_name ?? null,
        altlar: altlar.map(a => ({ id: a.id, ad: a.full_name, rol: a.role })),
        iban,
        merchId: merchKaydi.find(m => m.merchId)?.merchId ?? '',
      },
      noktalar,
      ozet: {
        nokta: noktalar.length,
        cari: new Set(noktalar.map(n => sadeAd(n.cariAdi))).size,
        kendi: noktalar.filter(n => n.kapsam === 'kendi').length,
        ekip: noktalar.filter(n => n.kapsam === 'ekip').length,
      },
      // Yalnızca admin: veri tutarlılığı (v2 "karmaşa" listesi)
      kontrol: user.role === 'admin' ? {
        toplamNokta: model.noktalar.length,
        bsySiz: model.noktalar.filter(n => !n.bsyKod && !n.bsyAdi).length,
        supSiz: model.noktalar.filter(n => n.sups.length === 0).length,
        subeKodsuz: model.noktalar.filter(n => !n.subeKod).length,
        eslesmeyenDestek: model.eslesmeyenDestek,
      } : undefined,
      guncelleme: new Date(model.zaman).toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
