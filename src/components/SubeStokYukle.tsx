'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Trash2 } from 'lucide-react'
import { satirlariOku, type StokSatir } from '@/lib/subeStok'

// Sellout ▸ Şube Takibi — Stok yükle / Sevk yükle (yalnızca yönetici).
// Dosya tarayıcıda okunur, sunucu şubeleri B2B şubeleriyle eşler; önce önizleme,
// onaydan sonra kayıt.

interface Ozet {
  toplamSatir: number
  eslesenSatir: number
  subeSayisi: number
  toplamAdet: number
  tarihsiz: number
  eslesmeyen: { sube: string; satir: number }[]
  onizleme: boolean
}

export interface SevkYukleme { yukleme_id: string; created_at: string; satir: number; adet: number; ilkTarih: string; sonTarih: string }

const bugun = () => new Date().toISOString().slice(0, 10)
const trTarih = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '')

export function SubeStokYukle({ tip, cariler, varsayilanCari, yuklemeler, onClose, onKaydedildi }: {
  tip: 'stok' | 'sevk'
  cariler: string[]
  varsayilanCari: string
  yuklemeler: SevkYukleme[]
  onClose: () => void
  onKaydedildi: () => void
}) {
  const [cari, setCari] = useState(varsayilanCari)
  const [tarih, setTarih] = useState(bugun())
  const [dosyaAdi, setDosyaAdi] = useState('')
  const [satirlar, setSatirlar] = useState<StokSatir[] | null>(null)
  const [kolonlar, setKolonlar] = useState<Record<string, string>>({})
  const [ozet, setOzet] = useState<Ozet | null>(null)
  const [hata, setHata] = useState('')
  const [islem, setIslem] = useState(false)

  const gonder = async (onizleme: boolean, liste = satirlar) => {
    if (!liste) return
    setIslem(true)
    setHata('')
    try {
      const r = await fetch('/api/sube-stok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tip, satirlar: liste, cari: cari || undefined, onizleme,
          ...(tip === 'stok' ? { milat: tarih } : { tarih }),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'İşlem başarısız')
      setOzet(j as Ozet)
      if (!onizleme) onKaydedildi()
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setIslem(false)
    }
  }

  const dosyaSec = async (f: File | undefined) => {
    if (!f) return
    setHata(''); setOzet(null); setSatirlar(null); setDosyaAdi(f.name)
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
      const o = satirlariOku(raw, tip)
      if (o.hata) { setHata(o.hata); return }
      if (o.satirlar.length === 0) { setHata('Dosyada okunacak satır bulunamadı.'); return }
      setSatirlar(o.satirlar)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 space-y-3 text-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">{tip === 'stok' ? 'Stok yükle' : 'Sevk yükle'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">
          {tip === 'stok'
            ? 'Excel: şube (veya şube kodu), stok/ürün kodu, kalan ve bekleyen kolonları. Dosyadaki şubelerin önceki stok kayıtları bu dosyayla değiştirilir; seçtiğiniz tarih milat olur (o günden SONRAKİ satış ve sevkler hesaba katılır).'
            : 'Excel: şube (veya şube kodu), stok/ürün kodu ve adet kolonları; tarih kolonu yoksa aşağıdaki tarih kullanılır. Her yükleme ayrı kaydedilir, yanlış yüklemeyi aşağıdan geri alabilirsiniz.'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Cari (dosyada cari kolonu yoksa)</span>
            <select value={cari} onChange={e => setCari(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white">
              <option value="">— seçiniz —</option>
              {cariler.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">{tip === 'stok' ? 'Milat (sayım) tarihi' : 'Sevk tarihi'}</span>
            <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          </label>
        </div>

        <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-3 py-4 cursor-pointer hover:bg-gray-50">
          <Upload size={16} className="text-gray-400" />
          <span className="text-xs text-gray-600">{dosyaAdi || 'Excel dosyası seçin (.xlsx)'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => dosyaSec(e.target.files?.[0])} />
        </label>

        {Object.keys(kolonlar).length > 0 && (
          <p className="text-[11px] text-gray-500">
            Okunan kolonlar: {Object.entries(kolonlar).map(([a, h]) => `${ALAN_ADI[a] ?? a} = "${h}"`).join(' · ')}
          </p>
        )}

        {ozet && (
          <div className="rounded-xl bg-gray-50 px-3 py-2 space-y-1 text-xs">
            <p>
              <b>{ozet.eslesenSatir}</b> / {ozet.toplamSatir} satır eşleşti · <b>{ozet.subeSayisi}</b> şube ·
              toplam <b>{ozet.toplamAdet.toLocaleString('tr-TR')}</b> adet
            </p>
            {ozet.tarihsiz > 0 && <p className="text-amber-700">{ozet.tarihsiz} satırda tarih yok; atlandı.</p>}
            {ozet.eslesmeyen.length > 0 && (
              <details>
                <summary className="cursor-pointer text-amber-700">{ozet.eslesmeyen.length} şube eşleşmedi (kaydedilmez)</summary>
                <ul className="mt-1 max-h-32 overflow-y-auto list-disc ml-4 text-gray-600">
                  {ozet.eslesmeyen.map(e => <li key={e.sube}>{e.sube || '(boş)'} — {e.satir} satır</li>)}
                </ul>
                <p className="mt-1 text-gray-500">Dosyaya şube kodu kolonu ekleyin ya da üstten cariyi seçip tekrar deneyin.</p>
              </details>
            )}
            {!ozet.onizleme && <p className="font-medium text-green-700">Kaydedildi ✓</p>}
          </div>
        )}

        {hata && <p className="text-xs text-red-600">{hata}</p>}

        <div className="flex gap-2">
          {satirlar && ozet?.onizleme && (
            <button onClick={() => gonder(true)} disabled={islem} className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600">
              Tekrar eşleştir
            </button>
          )}
          <button onClick={() => gonder(false)} disabled={islem || !satirlar || !ozet?.onizleme || ozet.eslesenSatir === 0}
            className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-medium text-white disabled:opacity-40">
            {islem ? 'İşleniyor…' : `${ozet?.eslesenSatir ?? 0} satırı kaydet`}
          </button>
        </div>

        {tip === 'sevk' && yuklemeler.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-1">
            <p className="text-xs font-medium text-gray-600">Önceki sevk yüklemeleri</p>
            <ul className="divide-y divide-gray-50">
              {yuklemeler.map(y => (
                <li key={y.yukleme_id} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="flex-1 text-gray-600">
                    {trTarih(y.created_at)} yüklendi · {y.satir} satır · {y.adet.toLocaleString('tr-TR')} adet
                    · sevk {trTarih(y.ilkTarih)}{y.sonTarih !== y.ilkTarih ? `–${trTarih(y.sonTarih)}` : ''}
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
