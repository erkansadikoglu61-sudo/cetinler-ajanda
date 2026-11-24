'use client'

import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Trash2, Image as ImageIcon, FileSpreadsheet, Plus } from 'lucide-react'
import clsx from 'clsx'
import { satirlariOku, siparisMetniOku, type StokSatir } from '@/lib/subeStok'

// Sellout ▸ Şube Takibi — Stok yükle / Sevk yükle (yalnızca yönetici).
// Sevk: sipariş onay e-postasının GÖRSELİ (tarayıcıda OCR) ya da metni, veya Excel.
// Dosya/görsel tarayıcıda okunur, sunucu şubeleri B2B şubeleriyle eşler;
// önce önizleme, onaydan sonra kayıt.

interface Ozet {
  toplamSatir: number
  eslesenSatir: number
  subeSayisi: number
  toplamAdet: number
  tarihsiz: number
  oncekiBelgeler?: string[]
  acikSevkler?: { yukleme_id: string; sube_key: string; sube_adi: string; belge_no: string | null; tarih: string; adet: number }[]
  eslesmeyen: { sube: string; satir: number }[]
  onizleme: boolean
}

export interface SevkYukleme {
  yukleme_id: string; created_at: string; satir: number; adet: number; ilkTarih: string; sonTarih: string
  cariler?: string[]; subeler?: { sube: string; adet: number }[]; belgeler?: string[]
}

/** Cari kısaltması: ilk kelime (2–3 harfse ikinci kelime de) */
function cariKisaAd(cari: string): string {
  const w = cari.trim().split(/\s+/)
  return (w[0]?.length ?? 0) <= 3 && w[1] ? `${w[0]} ${w[1]}` : (w[0] ?? '')
}

interface Kart {
  id: string
  kaynak: string
  durum: 'okunuyor' | 'hazir' | 'hata'
  hata?: string
  siparisNo: string
  cariAdi: string
  subeAdi: string
  tarih: string
  toplam: number | null
  satirlar: { stokKodu: string; stokAdi: string; adet: number }[]
}

const bugun = () => new Date().toISOString().slice(0, 10)
const trTarih = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '')
const yeniId = () => Math.random().toString(36).slice(2)

// OCR işçisi (tesseract.js) — ilk kullanımda yüklenir, pencere açık kaldıkça tekrar kullanılır
type OcrWorker = { recognize: (img: Blob) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> }

export function SubeStokYukle({ tip, cariler, varsayilanCari, yuklemeler, onClose, onKaydedildi }: {
  tip: 'stok' | 'sevk'
  cariler: string[]
  varsayilanCari: string
  yuklemeler: SevkYukleme[]
  onClose: () => void
  onKaydedildi: () => void
}) {
  const [mod, setMod] = useState<'gorsel' | 'excel'>(tip === 'sevk' ? 'gorsel' : 'excel')
  const [cari, setCari] = useState(varsayilanCari)
  const [tarih, setTarih] = useState(bugun())
  const [dosyaAdi, setDosyaAdi] = useState('')
  const [excelSatirlar, setExcelSatirlar] = useState<StokSatir[] | null>(null)
  const [kolonlar, setKolonlar] = useState<Record<string, string>>({})
  const [kartlar, setKartlar] = useState<Kart[]>([])
  const [metin, setMetin] = useState('')
  const [ozet, setOzet] = useState<Ozet | null>(null)
  const [hata, setHata] = useState('')
  const [islem, setIslem] = useState(false)
  const [teslimEdilen, setTeslimEdilen] = useState<Set<string>>(new Set())
  const ocrRef = useRef<Promise<OcrWorker> | null>(null)

  useEffect(() => () => { ocrRef.current?.then(w => w.terminate()).catch(() => {}) }, [])

  // ── Görsel / metin → kartlar ─────────────────────────────────
  const kartGuncelle = (id: string, f: (k: Kart) => Kart) => { setKartlar(ks => ks.map(k => (k.id === id ? f(k) : k))); setOzet(null) }

  const metindenKartlar = (txt: string, kaynak: string): Kart[] =>
    siparisMetniOku(txt).map(s => ({ id: yeniId(), kaynak, durum: 'hazir' as const, ...s, tarih: s.tarih || tarih }))

  const gorselOku = async (dosyalar: File[]) => {
    const resimler = dosyalar.filter(f => f.type.startsWith('image/'))
    if (resimler.length === 0) return
    setHata('')
    setOzet(null)
    const bekleyenler = resimler.map(f => ({ id: yeniId(), f }))
    setKartlar(ks => [...ks, ...bekleyenler.map(b => ({
      id: b.id, kaynak: b.f.name || 'Görsel', durum: 'okunuyor' as const,
      siparisNo: '', cariAdi: '', subeAdi: '', tarih: '', toplam: null, satirlar: [],
    }))])
    if (!ocrRef.current) {
      ocrRef.current = import('tesseract.js').then(m => m.createWorker(['tur', 'eng']) as unknown as Promise<OcrWorker>)
    }
    for (const b of bekleyenler) {
      try {
        const w = await ocrRef.current
        const { data } = await w.recognize(b.f)
        const bulunan = metindenKartlar(data.text, b.f.name || 'Görsel')
        if (bulunan.length === 0) {
          setKartlar(ks => ks.map(k => (k.id === b.id ? { ...k, durum: 'hata', hata: 'Görselde sipariş satırı bulunamadı.' } : k)))
        } else {
          setKartlar(ks => ks.flatMap(k => (k.id === b.id ? bulunan : [k])))
        }
      } catch (e) {
        setKartlar(ks => ks.map(k => (k.id === b.id ? { ...k, durum: 'hata', hata: 'Görsel okunamadı: ' + (e instanceof Error ? e.message : String(e)) } : k)))
      }
    }
  }

  const metniOku = () => {
    const yeni = metindenKartlar(metin, 'Yapıştırılan metin')
    if (yeni.length === 0) { setHata('Metinde sipariş satırı bulunamadı (stok kodu … adet).'); return }
    setHata('')
    setKartlar(ks => [...ks, ...yeni])
    setMetin('')
    setOzet(null)
  }

  // Ctrl+V ile görsel yapıştırma
  useEffect(() => {
    if (tip !== 'sevk' || mod !== 'gorsel') return
    const yapistir = (e: ClipboardEvent) => {
      const dosyalar = [...(e.clipboardData?.items ?? [])]
        .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
        .map(i => i.getAsFile()).filter((f): f is File => !!f)
      if (dosyalar.length) { e.preventDefault(); gorselOku(dosyalar) }
    }
    window.addEventListener('paste', yapistir)
    return () => window.removeEventListener('paste', yapistir)
  })

  const kartSatirlari = (): StokSatir[] =>
    kartlar.filter(k => k.durum === 'hazir').flatMap(k => k.satirlar
      .filter(s => s.stokKodu.trim() && s.adet > 0)
      .map(s => ({
        cariAdi: k.cariAdi || undefined, subeAdi: k.subeAdi || undefined,
        stokKodu: s.stokKodu.trim().toUpperCase(), stokAdi: s.stokAdi || undefined,
        adet: s.adet, tarih: k.tarih || undefined, belgeNo: k.siparisNo || undefined,
      })))

  // ── Sunucuya gönder (önizleme / kayıt) ────────────────────────
  const gonder = async (onizleme: boolean, liste?: StokSatir[]) => {
    const satirlar = liste ?? (mod === 'gorsel' ? kartSatirlari() : excelSatirlar)
    if (!satirlar || satirlar.length === 0) { setHata('Gönderilecek satır yok.'); return }
    setIslem(true)
    setHata('')
    try {
      const r = await fetch('/api/sube-stok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tip, satirlar, cari: cari || undefined, onizleme,
          ...(tip === 'stok' ? { milat: tarih } : { tarih }),
          ...(tip === 'stok' && !onizleme ? {
            sayimdaSevkler: [...teslimEdilen].map(k => { const [yukleme_id, sube_key] = k.split('|'); return { yukleme_id, sube_key } }),
          } : {}),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'İşlem başarısız')
      setOzet(j as Ozet)
      if (!onizleme) { onKaydedildi(); if (mod === 'gorsel') setKartlar([]) }
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setIslem(false)
    }
  }

  const excelSec = async (f: File | undefined) => {
    if (!f) return
    setHata(''); setOzet(null); setExcelSatirlar(null); setDosyaAdi(f.name)
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
      const o = satirlariOku(raw, tip)
      if (o.hata) { setHata(o.hata); return }
      if (o.satirlar.length === 0) { setHata('Dosyada okunacak satır bulunamadı.'); return }
      setExcelSatirlar(o.satirlar)
      setKolonlar(o.kolonlar as Record<string, string>)
      await gonder(true, o.satirlar)
    } catch (e) {
      setHata('Dosya okunamadı: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const geriAl = async (id: string) => {
    if (!confirm('Bu sevk yüklemesi silinsin mi?')) return
    const r = await fetch('/api/sube-stok', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yukleme_id: id }),
    })
    if (r.ok) onKaydedildi()
    else setHata((await r.json()).error || 'Silinemedi')
  }

  const ALAN_ADI: Record<string, string> = {
    subeKod: 'Şube kodu', subeAdi: 'Şube', cariAdi: 'Cari', stokKodu: 'Stok kodu', stokAdi: 'Stok adı',
    kalan: 'Kalan', bekleyen: 'Bekleyen', adet: 'Adet', tarih: 'Tarih',
  }
  const okunuyor = kartlar.some(k => k.durum === 'okunuyor')
  const hazirSatir = mod === 'gorsel' ? kartSatirlari().length : (excelSatirlar?.length ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 space-y-3 text-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">{tip === 'stok' ? 'Stok yükle' : 'Sevk yükle'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>

        {tip === 'sevk' && (
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {([['gorsel', 'Görsel / e-posta', ImageIcon], ['excel', 'Excel', FileSpreadsheet]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => { setMod(k); setOzet(null); setHata('') }}
                className={clsx('flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium',
                  mod === k ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500')}>
                <Icon size={13} /> {l}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          {tip === 'stok'
            ? 'Excel: şube (veya şube kodu), stok/ürün kodu, kalan ve bekleyen kolonları. Dosyadaki şubelerin önceki stok kayıtları bu dosyayla değiştirilir; seçtiğiniz tarih milat olur (o günden SONRAKİ satışlar düşülür). Teslim edilmemiş sevkler stoğa eklenir; bu sayıma girmiş olanları önizlemede işaretleyin.'
            : mod === 'gorsel'
              ? 'Sipariş onay e-postasının ekran görüntüsünü seçin, sürükleyin ya da Ctrl+V ile yapıştırın (birden çok olabilir). Cari, şube, onay tarihi, stok kodu ve adetler okunur; kaydetmeden önce düzeltebilirsiniz. Aynı sipariş no ikinci kez sayılmaz.'
              : 'Excel: şube (veya şube kodu), stok/ürün kodu ve adet kolonları; tarih kolonu yoksa aşağıdaki tarih kullanılır.'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Cari (belgede cari yoksa)</span>
            <select value={cari} onChange={e => { setCari(e.target.value); setOzet(null) }} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white">
              <option value="">— seçiniz —</option>
              {cariler.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">{tip === 'stok' ? 'Milat (sayım) tarihi' : 'Sevk tarihi (belgede yoksa)'}</span>
            <input type="date" value={tarih} onChange={e => { setTarih(e.target.value); setOzet(null) }} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          </label>
        </div>

        {/* ── Excel ── */}
        {mod === 'excel' && (
          <>
            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-3 py-4 cursor-pointer hover:bg-gray-50">
              <Upload size={16} className="text-gray-400" />
              <span className="text-xs text-gray-600">{dosyaAdi || 'Excel dosyası seçin (.xlsx)'}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => excelSec(e.target.files?.[0])} />
            </label>
            {Object.keys(kolonlar).length > 0 && (
              <p className="text-[11px] text-gray-500">
                Okunan kolonlar: {Object.entries(kolonlar).map(([a, h]) => `${ALAN_ADI[a] ?? a} = "${h}"`).join(' · ')}
              </p>
            )}
          </>
        )}

        {/* ── Görsel / metin ── */}
        {mod === 'gorsel' && (
          <>
            <label
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); gorselOku([...e.dataTransfer.files]) }}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-3 py-5 cursor-pointer hover:bg-gray-50">
              <ImageIcon size={18} className="text-gray-400" />
              <span className="text-xs text-gray-600">Görsel seçin, buraya sürükleyin ya da Ctrl+V ile yapıştırın</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => gorselOku([...(e.target.files ?? [])])} />
            </label>
            <details>
              <summary className="cursor-pointer text-xs text-brand-600">ya da e-posta metnini yapıştırın</summary>
              <textarea value={metin} onChange={e => setMetin(e.target.value)} rows={4}
                placeholder="Sipariş no : … Şube : … Stok kodu  Stok adı  Adet …"
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-mono" />
              <button onClick={metniOku} disabled={!metin.trim()} className="mt-1 rounded-lg border border-gray-200 px-3 py-1 text-xs disabled:opacity-40">Metni oku</button>
            </details>

            {kartlar.map(k => {
              const toplamOkunan = k.satirlar.reduce((t, s) => t + (s.adet || 0), 0)
              return (
                <div key={k.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-gray-500">{k.kaynak}{k.siparisNo ? ` · ${k.siparisNo}` : ''}</span>
                    <button onClick={() => { setKartlar(ks => ks.filter(x => x.id !== k.id)); setOzet(null) }} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                  {k.durum === 'okunuyor' && <p className="text-xs text-gray-500 animate-pulse">Görsel okunuyor… (ilk seferde birkaç saniye sürebilir)</p>}
                  {k.durum === 'hata' && <p className="text-xs text-red-600">{k.hata}</p>}
                  {k.durum === 'hazir' && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <input value={k.cariAdi} onChange={e => kartGuncelle(k.id, x => ({ ...x, cariAdi: e.target.value }))} placeholder="Cari"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                        <input value={k.subeAdi} onChange={e => kartGuncelle(k.id, x => ({ ...x, subeAdi: e.target.value }))} placeholder="Şube"
                          className={clsx('rounded-lg border px-2 py-1 text-xs font-medium', k.subeAdi ? 'border-gray-200' : 'border-red-300')} />
                        <input type="date" value={k.tarih} onChange={e => kartGuncelle(k.id, x => ({ ...x, tarih: e.target.value }))}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                      </div>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-50">
                          {k.satirlar.map((s, i) => (
                            <tr key={i}>
                              <td className="py-0.5 pr-2">
                                <input value={s.stokKodu}
                                  onChange={e => kartGuncelle(k.id, x => ({ ...x, satirlar: x.satirlar.map((y, j) => (j === i ? { ...y, stokKodu: e.target.value.toUpperCase() } : y)) }))}
                                  className="w-28 rounded border border-gray-200 px-1.5 py-0.5 font-mono" />
                              </td>
                              <td className="py-0.5 pr-2 text-gray-400 truncate max-w-[260px]">{s.stokAdi}</td>
                              <td className="py-0.5 pr-2 text-right">
                                <input inputMode="numeric" value={s.adet || ''}
                                  onChange={e => kartGuncelle(k.id, x => ({ ...x, satirlar: x.satirlar.map((y, j) => (j === i ? { ...y, adet: parseInt(e.target.value.replace(/\D/g, '')) || 0 } : y)) }))}
                                  className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-right tabular-nums" />
                              </td>
                              <td className="py-0.5 text-right">
                                <button onClick={() => kartGuncelle(k.id, x => ({ ...x, satirlar: x.satirlar.filter((_, j) => j !== i) }))}
                                  className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center gap-2 text-xs">
                        <button onClick={() => kartGuncelle(k.id, x => ({ ...x, satirlar: [...x.satirlar, { stokKodu: '', stokAdi: '', adet: 0 }] }))}
                          className="flex items-center gap-1 text-brand-600"><Plus size={12} /> Satır ekle</button>
                        <span className={clsx('ml-auto tabular-nums', k.toplam !== null && k.toplam !== toplamOkunan ? 'text-red-600 font-medium' : 'text-gray-500')}>
                          Okunan toplam {toplamOkunan}{k.toplam !== null ? ` · belgede ${k.toplam}` : ''}
                          {k.toplam !== null && k.toplam !== toplamOkunan ? ' — kontrol edin' : k.toplam !== null ? ' ✓' : ''}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </>
        )}

        {ozet && (
          <div className="rounded-xl bg-gray-50 px-3 py-2 space-y-1 text-xs">
            <p>
              <b>{ozet.eslesenSatir}</b> / {ozet.toplamSatir} satır eşleşti · <b>{ozet.subeSayisi}</b> şube ·
              toplam <b>{ozet.toplamAdet.toLocaleString('tr-TR')}</b> adet
            </p>
            {ozet.tarihsiz > 0 && <p className="text-amber-700">{ozet.tarihsiz} satırda tarih yok; atlandı.</p>}
            {(ozet.oncekiBelgeler?.length ?? 0) > 0 && (
              <p className="text-amber-700">Daha önce yüklenmiş, atlanan sipariş: {ozet.oncekiBelgeler!.join(', ')}</p>
            )}
            {ozet.eslesmeyen.length > 0 && (
              <details open={mod === 'gorsel'}>
                <summary className="cursor-pointer text-amber-700">{ozet.eslesmeyen.length} şube eşleşmedi (kaydedilmez)</summary>
                <ul className="mt-1 max-h-32 overflow-y-auto list-disc ml-4 text-gray-600">
                  {ozet.eslesmeyen.map(e => <li key={e.sube}>{e.sube || '(boş)'} — {e.satir} satır</li>)}
                </ul>
                <p className="mt-1 text-gray-500">Şube adını B2B&apos;deki gibi düzeltin (ör. &quot;ADANA&quot; → cari seçiliyse yeterli) ya da üstten cariyi seçip tekrar eşleştirin.</p>
              </details>
            )}
            {tip === 'stok' && ozet.onizleme && (ozet.acikSevkler?.length ?? 0) > 0 && (
              <div className="mt-1 rounded-lg border border-amber-200 bg-white p-2 space-y-1">
                <p className="font-medium text-gray-700">Bu şubelerin teslim edilmemiş sevkleri ({ozet.acikSevkler!.length})</p>
                <p className="text-gray-500">İşaretlemedikleriniz sayımda yok kabul edilir ve stoğa eklenmeye devam eder. Teslim edilip bu sayıma girenleri işaretleyin.</p>
                <ul className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                  {ozet.acikSevkler!.map(a => {
                    const k = `${a.yukleme_id}|${a.sube_key}`
                    return (
                      <li key={k} className="py-1">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={teslimEdilen.has(k)}
                            onChange={e => setTeslimEdilen(prev => { const n = new Set(prev); if (e.target.checked) n.add(k); else n.delete(k); return n })} />
                          <span className="flex-1 text-gray-700">{a.sube_adi} · {trTarih(a.tarih)}{a.belge_no ? ` · ${a.belge_no}` : ''}</span>
                          <span className="tabular-nums text-gray-500">{a.adet} adet</span>
                          <span className="text-[10px] text-gray-400">teslim edildi</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {!ozet.onizleme && <p className="font-medium text-green-700">Kaydedildi ✓</p>}
          </div>
        )}

        {hata && <p className="text-xs text-red-600">{hata}</p>}

        <div className="flex gap-2">
          <button onClick={() => gonder(true)} disabled={islem || okunuyor || hazirSatir === 0}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 disabled:opacity-40">
            {ozet?.onizleme ? 'Tekrar eşleştir' : 'Eşleştir'}
          </button>
          <button onClick={() => gonder(false)} disabled={islem || okunuyor || !ozet?.onizleme || ozet.eslesenSatir === 0}
            className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white disabled:opacity-40">
            {islem ? 'İşleniyor…' : `${ozet?.onizleme ? ozet.eslesenSatir : 0} satırı kaydet`}
          </button>
        </div>

        {tip === 'sevk' && yuklemeler.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-1">
            <p className="text-xs font-medium text-gray-600">Önceki sevk yüklemeleri</p>
            <ul className="divide-y divide-gray-50">
              {yuklemeler.map(y => (
                <li key={y.yukleme_id} className="flex items-start gap-2 py-1.5 text-xs">
                  <span className="flex-1 min-w-0">
                    {(y.cariler?.length || y.subeler?.length) ? (
                      <span className="block font-medium text-gray-800"
                        title={[...(y.cariler ?? []), ...(y.subeler ?? []).map(x => `${x.sube}: ${x.adet} adet`)].join('\n')}>
                        {(y.cariler ?? []).map(cariKisaAd).join(', ')}
                        {(y.cariler?.length ?? 0) > 0 && ' · '}
                        {(y.subeler ?? []).map(x => (y.subeler!.length > 1 ? `${x.sube} (${x.adet})` : x.sube)).join(', ')}
                      </span>
                    ) : null}
                    <span className="block text-gray-500">
                      {trTarih(y.created_at)} yüklendi · {y.satir} satır · {y.adet.toLocaleString('tr-TR')} adet
                      · sevk {trTarih(y.ilkTarih)}{y.sonTarih !== y.ilkTarih ? `–${trTarih(y.sonTarih)}` : ''}
                      {(y.belgeler?.length ?? 0) > 0 && ` · belge ${y.belgeler!.join(', ')}`}
                    </span>
                  </span>
                  <button onClick={() => geriAl(y.yukleme_id)} className="text-red-500" title="Geri al"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
