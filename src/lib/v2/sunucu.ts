// v2 sunucu yardımcıları: kullanıcı/görünüm çözümü, Supabase istemcisi,
// dönem bazlı sellout satırları (bellek önbellekli).
import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'
import { loadSelloutRows, MERCH_DETAY_URL, type SelloutRow } from '@/lib/selloutData'
import { parseHtmlTableByHeader, fetchPhpHtml } from '@/lib/merchSatis'
import type { NPMerchDetay } from '@/lib/nihaiPrim'
import type { V2Profil, V2BsyLink } from '@/lib/v2/nokta'

export const V2_TUM_ROLLER = ['admin', 'bsy', 'sup', 'jr', 'merch', 'manager', 'ik']

export interface V2Istek {
  sb: SupabaseClient
  /** Oturumdaki gerçek kullanıcı */
  kullaniciId: string
  rol: string
  /** Bakılan kullanıcı (yönetici "Görünüm" seçtiyse o kişi) */
  ben: V2Profil
  profiller: V2Profil[]
  links: V2BsyLink[]
}

/** Oturumu doğrular, profilleri ve hiyerarşiyi yükler. */
export async function v2Istek(req: Request, roller: readonly string[] = V2_TUM_ROLLER): Promise<V2Istek | NextResponse> {
  const user = await requireRole(req, roller)
  if (user instanceof NextResponse) return user
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const [profRes, linkRes] = await Promise.all([
    sb.from('profiles').select('id, full_name, role, manager_id').order('full_name'),
    sb.from('bsy_supervisors').select('bsy_id, sup_id'),
  ])
  const profiller = (profRes.data ?? []) as V2Profil[]
  const links = (linkRes.data ?? []) as V2BsyLink[]
  const gorunum = user.role === 'admin' ? (new URL(req.url).searchParams.get('gorunum') || user.id) : user.id
  const ben = profiller.find(p => p.id === gorunum)
  if (!ben) return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 })
  return { sb, kullaniciId: user.id, rol: user.role, ben, profiller, links }
}

// ── Sellout satırları: tüm dosya bir kez parse edilir, döneme göre bölünür ──
let satirCache: { at: number; byDonem: Map<string, SelloutRow[]> } | null = null
const SATIR_TTL = 10 * 60 * 1000

export async function donemSatirlari(donem: string): Promise<SelloutRow[]> {
  if (!satirCache || Date.now() - satirCache.at > SATIR_TTL) {
    const rows = await loadSelloutRows()
    const byDonem = new Map<string, SelloutRow[]>()
    for (const r of rows) {
      let l = byDonem.get(r.donem)
      if (!l) { l = []; byDonem.set(r.donem, l) }
      l.push(r)
    }
    satirCache = { at: Date.now(), byDonem }
  }
  return satirCache.byDonem.get(donem) ?? []
}

export function donemGecerli(donem: string | null): donem is string {
  return !!donem && /^\d{4}-(0[1-9]|1[0-2])$/.test(donem)
}

export function buDonem(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── B2B merch-detay (Nihai Prim hesabı için sade alanlar) ──
let mdCache: { at: number; rows: NPMerchDetay[] } | null = null
export async function merchDetay(): Promise<NPMerchDetay[]> {
  if (mdCache && Date.now() - mdCache.at < 10 * 60 * 1000) return mdCache.rows
  const { rows } = parseHtmlTableByHeader(await fetchPhpHtml(MERCH_DETAY_URL))
  const out = rows.map(r => ({
    merch_adi: (r['MERCH_ADI'] ?? '').trim(),
    merch_grubu: (r['MERCH_TIPI'] ?? '').trim(),
    sup_adi: (r['SUPERVIZOR'] ?? '').trim(),
    jr_adi: (r['JR_SUPERVIZOR'] ?? '').trim(),
  })).filter(r => r.merch_adi)
  mdCache = { at: Date.now(), rows: out }
  return out
}

export const HERKESI_GOREN = ['admin', 'ik', 'manager']
