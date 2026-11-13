// v2 — tek "şube → kullanıcılar" modeli (sunucu). B2B cari-şube + merch-detay +
// Supabase destek personeli birleştirilir; 10 dk bellek önbelleği.
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'
import { V2Nokta, V2Kisi, noktaAnahtari, sadeAd } from '@/lib/v2/nokta'
import { namesMatch } from '@/lib/sellout'

const CARI_SUBE_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_bsy_cari_sube.php'
const MERCH_URL     = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_detay.php'

export interface MerchKaydi {
  ad: string
  merchId: string
  tip: string
  cariAdi: string
  subeAdi: string
  iban: string
}

export interface NoktaModel {
  noktalar: V2Nokta[]
  merchKayitlari: MerchKaydi[]
  eslesmeyenDestek: { ad: string; cariAdi: string; subeAdi: string }[]
  zaman: number
}

let modelCache: NoktaModel | null = null
const MODEL_TTL = 10 * 60 * 1000

function ekleKisi(liste: V2Kisi[], k: V2Kisi) {
  if (!liste.some(x => namesMatch(x.ad, k.ad))) liste.push(k)
}
function ekleAd(liste: string[], ad: string) {
  if (ad && !liste.some(x => namesMatch(x, ad))) liste.push(ad)
}

export async function noktaModeli(yenile = false): Promise<NoktaModel> {
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
  const eslesmeyenDestek: NoktaModel['eslesmeyenDestek'] = []
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

