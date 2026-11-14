'use client'

import { useMemo, useState } from 'react'
import { Search, X, ChevronDown, ChevronRight, Building2, AlertTriangle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { cariyeGoreGrupla, sadeAd } from '@/lib/v2/nokta'
import type { V2GorunurNokta } from '@/lib/v2/nokta'
import { V2Veri } from './types'
import { TalepModal, TaleplerListesi } from './Talepler'

type Filtre = 'tumu' | 'kendi' | 'ekip'

function Kisiler({ baslik, adlar }: { baslik: string; adlar: string[] }) {
  if (adlar.length === 0) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-24 shrink-0 text-gray-400">{baslik}</span>
      <span className="text-gray-700">{adlar.join(', ')}</span>
    </div>
  )
}

function SubeSatiri({ n }: { n: V2GorunurNokta }) {
  const [acik, setAcik] = useState(false)
  const kisiSayisi = n.cetinlerMerch.length + n.bayiMerch.length + n.destek.length
  return (
    <li>
      <button onClick={() => setAcik(a => !a)} className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50">
        {acik ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-gray-800 truncate">{n.subeAdi || '—'}</span>
          <span className="block text-[11px] text-gray-400 truncate">
            {n.subeKod || 'kodsuz'}
            {n.sups.length > 0 && ` · ${n.sups.join(', ')}`}
            {n.jrs.length > 0 && ` · ${n.jrs.join(', ')}`}
          </span>
        </span>
        {n.kapsam === 'ekip' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 shrink-0">Ekip</span>
        )}
        {kisiSayisi > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{kisiSayisi} kişi</span>
        )}
      </button>
      {acik && (
        <div className="px-10 pb-3 space-y-1">
          <Kisiler baslik="BSY" adlar={[n.bsyAdi || n.bsyKod].filter(Boolean)} />
          <Kisiler baslik="Süpervizör" adlar={n.sups} />
          <Kisiler baslik="Jr. Süpervizör" adlar={n.jrs} />
          <Kisiler baslik="Çetinler Merch" adlar={n.cetinlerMerch.map(k => k.ad)} />
          <Kisiler baslik="Bayi Merch" adlar={n.bayiMerch.map(k => k.ad)} />
          <Kisiler baslik="Destek" adlar={n.destek.map(k => k.ad)} />
          {n.kapsam === 'ekip' && n.ekiptenKim && (
            <p className="text-[11px] text-amber-700">Ekibinizden {n.ekiptenKim} üzerinden görünüyor.</p>
          )}
        </div>
      )}
    </li>
  )
}

export function SubelerimView({ veri, gorunum }: { veri: V2Veri; gorunum: string }) {
  const [talep, setTalep] = useState(false)
  const [talepSayac, setTalepSayac] = useState(0)
  const [arama, setArama] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tumu')
  const [acikCariler, setAcikCariler] = useState<Set<string>>(new Set())

  const gruplar = useMemo(() => {
    const q = sadeAd(arama)
    const liste = veri.noktalar.filter(n => {
      if (filtre !== 'tumu' && n.kapsam !== filtre) return false
      if (!q) return true
      const metin = sadeAd([
        n.cariAdi, n.subeAdi, n.subeKod, n.bsyAdi, ...n.sups, ...n.jrs,
        ...n.cetinlerMerch.map(k => k.ad), ...n.bayiMerch.map(k => k.ad), ...n.destek.map(k => k.ad),
      ].join(' '))
      return metin.includes(q)
    })
    return cariyeGoreGrupla(liste)
  }, [veri.noktalar, arama, filtre])

  const aramaVar = sadeAd(arama).length > 0
  const toggle = (k: string) => setAcikCariler(s => {
    const y = new Set(s)
    if (y.has(k)) y.delete(k); else y.add(k)
    return y
  })
  const toplam = gruplar.reduce((t, g) => t + g.noktalar.length, 0)

  return (
    <div className="space-y-3">
      {veri.kontrol && (
        <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <summary className="cursor-pointer flex items-center gap-1.5 font-medium">
            <AlertTriangle size={13} /> Veri kontrolü (yalnızca yönetici)
          </summary>
          <div className="mt-2 space-y-1">
            <p>Toplam şube: {veri.kontrol.toplamNokta} · BSY'siz: {veri.kontrol.bsySiz} · Süpervizörsüz: {veri.kontrol.supSiz} · Şube kodsuz: {veri.kontrol.subeKodsuz}</p>
            {veri.kontrol.eslesmeyenDestek.length > 0 && (
              <div>
                <p className="font-medium mt-1">Şubesi eşleşmeyen destek personeli ({veri.kontrol.eslesmeyenDestek.length}):</p>
                <ul className="list-disc ml-5">
                  {veri.kontrol.eslesmeyenDestek.map((d, i) => (
                    <li key={i}>{d.ad} — {d.cariAdi} / {d.subeAdi}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <TaleplerListesi gorunum={gorunum} yenile={talepSayac} />

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={arama}
          onChange={e => setArama(e.target.value)}
          placeholder="Cari, şube, kişi ara…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        {arama && (
          <button onClick={() => setArama('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={15} /></button>
        )}
      </div>

      {veri.ozet.ekip > 0 && (
        <div className="flex gap-2">
          {([
            ['tumu', `Tümü (${veri.ozet.nokta})`],
            ['kendi', `Benim (${veri.ozet.kendi})`],
            ['ekip', `Ekibim (${veri.ozet.ekip})`],
          ] as [Filtre, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFiltre(k)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium',
                filtre === k ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{gruplar.length} cari · {toplam} şube</p>
        <button onClick={() => setTalep(true)} className="flex items-center gap-1 text-xs font-medium text-brand-600">
          <AlertCircle size={13} /> Eksik şube bildir
        </button>
      </div>

      <div className="space-y-2">
        {gruplar.map(g => {
          const k = sadeAd(g.cariAdi)
          const acik = aramaVar || acikCariler.has(k)
          return (
            <section key={k} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button onClick={() => toggle(k)} className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-gray-50">
                <Building2 size={15} className="text-brand-600 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">{g.cariAdi}</span>
                  {g.noktalar[0]?.bsyAdi && <span className="block text-[11px] text-gray-400">{g.noktalar[0].bsyAdi}</span>}
                </span>
                <span className="text-xs text-gray-500 shrink-0">{g.noktalar.length} şube</span>
                {acik ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
              </button>
              {acik && (
                <ul className="border-t border-gray-100 divide-y divide-gray-50">
                  {g.noktalar.map(n => <SubeSatiri key={n.key} n={n} />)}
                </ul>
              )}
            </section>
          )
        })}
        {gruplar.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Şube bulunamadı.</p>
        )}
      </div>
      {talep && (
        <TalepModal tip="eksik_sube" ilgiliId={veri.kullanici.id} onClose={() => setTalep(false)}
          onGonderildi={() => setTalepSayac(n => n + 1)} />
      )}
    </div>
  )
}
