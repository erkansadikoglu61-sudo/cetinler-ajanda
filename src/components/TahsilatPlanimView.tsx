'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function fmtCur(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Cari ismini akıllı şekilde kısalt
function kisaltCariIsim(isim: string): string {
  const kelimeler = isim.trim().split(/\s+/)
  if (kelimeler.length === 0) return isim

  const ilkKelime = kelimeler[0]

  // İlk kelime 5 harften az ise ilk 2 kelimeyi göster
  if (ilkKelime.length < 5 && kelimeler.length > 1) {
    return kelimeler.slice(0, 2).join(' ')
  }

  // İlk kelimeyi döndür
  return ilkKelime
}

interface TahsilatPlanimRow {
  cariKod:   string
  cariIsim:  string
  bsyAdi?:   string  // Admin için BSY bilgisi
  onceki:    number
  kasim:     number
  aralik:    number
  ocak:      number
  subat:     number
  mart:      number
  nisan:     number
  mayis:     number
  haziran:   number
  toplam:    number
  tahsilatHaftasi?: string
  tahsilatTuru?: string
}

// Hafta seçeneklerini dinamik oluştur (Pazartesi-Pazar, bugünden itibaren 8 hafta)
function getHaftaSecenekleri(ay: number): string[] {
  const bugun = new Date()

  // Bu haftanın pazartesini bul
  const gunIndex = bugun.getDay() // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const pazartesiFarki = gunIndex === 0 ? -6 : 1 - gunIndex // Pazar ise -6, yoksa 1-günIndex

  const buHaftaPazartesi = new Date(bugun)
  buHaftaPazartesi.setDate(bugun.getDate() + pazartesiFarki)

  const haftalar: string[] = []

  // 5 hafta oluştur
  for (let i = 0; i < 5; i++) {
    const haftaBaslangic = new Date(buHaftaPazartesi)
    haftaBaslangic.setDate(buHaftaPazartesi.getDate() + (i * 7))

    const haftaBitis = new Date(haftaBaslangic)
    haftaBitis.setDate(haftaBaslangic.getDate() + 6) // Pazar

    const baslangicGun = haftaBaslangic.getDate()
    const baslangicAy = MONTHS_TR[haftaBaslangic.getMonth()]
    const bitisGun = haftaBitis.getDate()
    const bitisAy = MONTHS_TR[haftaBitis.getMonth()]

    if (haftaBaslangic.getMonth() === haftaBitis.getMonth()) {
      // Aynı ay içinde
      haftalar.push(`${baslangicGun}-${bitisGun} ${baslangicAy}`)
    } else {
      // Ay geçişi var
      haftalar.push(`${baslangicGun} ${baslangicAy}-${bitisGun} ${bitisAy}`)
    }
  }

  // En sona "Tahsilat Yapıldı" ekle
  haftalar.push('Tahsilat Yapıldı')

  return haftalar
}

const TAHSILAT_TURLERI = ['Çek', 'Nakit', 'Kredi Kartı']

export function TahsilatPlanimView({
  bsyAdi,
  isAdmin = false,
  isBolgeMuduru = false  // Burak Kılıç için özel durum
}: {
  bsyAdi: string
  isAdmin?: boolean
  isBolgeMuduru?: boolean
}) {
  const now = new Date()
  const [yil, setYil] = useState(now.getFullYear())
  const [ay, setAy] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<TahsilatPlanimRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sadecePlanGirilmis, setSadecePlanGirilmis] = useState(false) // Admin için filtre

  // Kullanıcı seçimleri (local state)
  const [secimler, setSecimler] = useState<Map<string, { hafta: string; tur: string }>>(new Map())

  // Verileri yükle
  async function loadData() {
    setLoading(true)
    try {
      let allRows: TahsilatPlanimRow[] = []

      if (isAdmin) {
        // Admin: Tüm BSY'lerin verilerini çek
        const res = await fetch(`/api/tahsilat-planim?yil=${yil}&ay=${ay}&showAll=true`)
        const data = await res.json()
        allRows = data.rows || []
      } else {
        // Eğer bölge müdürüyse (Burak Kılıç), hem kendi hem de IB2'nin verilerini çek
        const bsyAdlari = isBolgeMuduru
          ? [bsyAdi, 'Okan Oğuz']
          : [bsyAdi]

        for (const bsy of bsyAdlari) {
          const res = await fetch(`/api/tahsilat-planim?yil=${yil}&ay=${ay}&bsyAdi=${encodeURIComponent(bsy)}`)
          const data = await res.json()

          // Her satıra BSY bilgisini ekle
          const rowsWithBsy = (data.rows || []).map((r: TahsilatPlanimRow) => ({
            ...r,
            _bsyAdi: bsy
          }))
          allRows.push(...rowsWithBsy)
        }
      }

      setRows(allRows)

      // Seçimleri yükle - mevcut seçimleri koru, sadece yeni verileri ekle
      setSecimler(prevSecimler => {
        const newSecimler = new Map(prevSecimler)
        allRows.forEach(r => {
          // Eğer veritabanından gelen veri varsa, state'i güncelle
          if (r.tahsilatHaftasi || r.tahsilatTuru) {
            newSecimler.set(r.cariKod, {
              hafta: r.tahsilatHaftasi || '',
              tur: r.tahsilatTuru || ''
            })
          }
        })
        return newSecimler
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [yil, ay, bsyAdi, isBolgeMuduru, isAdmin])

  // Seçimi kaydet
  async function saveSecim(cariKod: string, cariIsim: string, field: 'hafta' | 'tur', value: string, rowBsy: string) {
    setSaving(true)
    try {
      const current = secimler.get(cariKod) || { hafta: '', tur: '' }
      const updated = { ...current, [field]: value }

      await fetch('/api/tahsilat-planim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bsyAdi: rowBsy, // Her satırın kendi BSY'si
          yil,
          ay,
          cariKod,
          cariIsim,
          tahsilatHaftasi: updated.hafta,
          tahsilatTuru: updated.tur
        })
      })

      setSecimler(new Map(secimler.set(cariKod, updated)))
    } finally {
      setSaving(false)
    }
  }

  // Ay başlıklarını ve değerlerini dinamik oluştur
  const ayKolonlari = useMemo(() => {
    if (ay === 6) {
      // Haziran için
      return [
        { baslik: 'Önceki', field: 'onceki' as const },
        { baslik: 'Kasım', field: 'kasim' as const },
        { baslik: 'Aralık', field: 'aralik' as const },
        { baslik: 'Ocak', field: 'ocak' as const },
        { baslik: 'Şubat', field: 'subat' as const },
        { baslik: 'Mart', field: 'mart' as const },
        { baslik: 'Nisan', field: 'nisan' as const },
        { baslik: 'Mayıs', field: 'mayis' as const },
        { baslik: 'Haziran', field: 'haziran' as const },
      ]
    } else if (ay === 7) {
      // Temmuz için - bir ay kaydır
      return [
        { baslik: 'Önceki', field: 'onceki' as const },
        { baslik: 'Aralık', field: 'aralik' as const },
        { baslik: 'Ocak', field: 'ocak' as const },
        { baslik: 'Şubat', field: 'subat' as const },
        { baslik: 'Mart', field: 'mart' as const },
        { baslik: 'Nisan', field: 'nisan' as const },
        { baslik: 'Mayıs', field: 'mayis' as const },
        { baslik: 'Haziran', field: 'haziran' as const },
        { baslik: 'Temmuz', field: 'haziran' as const }, // Temmuz verisi haziran field'ına map'lenir
      ]
    }
    // Diğer aylar için varsayılan
    return [
      { baslik: 'Önceki', field: 'onceki' as const },
      { baslik: 'Kasım', field: 'kasim' as const },
      { baslik: 'Aralık', field: 'aralik' as const },
      { baslik: 'Ocak', field: 'ocak' as const },
      { baslik: 'Şubat', field: 'subat' as const },
      { baslik: 'Mart', field: 'mart' as const },
      { baslik: 'Nisan', field: 'nisan' as const },
      { baslik: 'Mayıs', field: 'mayis' as const },
      { baslik: 'Haziran', field: 'haziran' as const },
    ]
  }, [ay])

  const haftaSecenekleri = useMemo(() => getHaftaSecenekleri(ay), [ay])

  // Admin için filtrelenmiş satırlar
  const filteredRows = useMemo(() => {
    if (!isAdmin || !sadecePlanGirilmis) return rows
    return rows.filter(row => {
      const secim = secimler.get(row.cariKod)
      return secim?.hafta || secim?.tur
    })
  }, [rows, sadecePlanGirilmis, secimler, isAdmin])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Üst Bar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-semibold">Tahsilat Planım</span>

        <div className="relative">
          <select
            value={yil}
            onChange={e => setYil(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
          >
            {[yil - 1, yil, yil + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={ay}
            onChange={e => setAy(Number(e.target.value))}
            className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-200 rounded-lg bg-white font-medium text-brand-700 focus:outline-none focus:border-brand-400"
          >
            {MONTHS_TR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {isAdmin && (
          <button
            onClick={() => setSadecePlanGirilmis(!sadecePlanGirilmis)}
            className={clsx(
              'px-2 py-1 text-[10px] rounded-lg border transition-colors',
              sadecePlanGirilmis
                ? 'bg-purple-100 border-purple-300 text-purple-700 font-semibold'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            {sadecePlanGirilmis ? '✓ Sadece Plan Girilmiş' : 'Tümü'}
          </button>
        )}

        <div className="flex-1" />

        {!loading && rows.length > 0 && (
          <span className="text-[10px] text-gray-400">
            {filteredRows.length} Cari {filteredRows.length !== rows.length && `(${rows.length} toplam)`} · {MONTHS_TR[ay - 1]} {yil}
          </span>
        )}
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-gray-400">
            <RefreshCw size={14} className="animate-spin mr-2" /> Yükleniyor…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-400">
            Bu döneme ait veri bulunamadı
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
            <table className="text-[10px] border-collapse w-full table-fixed">
              <thead className="sticky top-0 z-20">
                <tr className="bg-purple-600 text-white">
                  <th className="sticky left-0 z-30 bg-purple-600 border-r border-purple-500 px-1 py-1.5 text-left w-[70px]">
                    Cari Kod
                  </th>
                  <th className="bg-purple-600 border-r border-purple-500 px-1 py-1.5 text-left w-[110px]">
                    Cari İsim
                  </th>
                  {isAdmin && (
                    <th className="bg-purple-600 border-r border-purple-500 px-1 py-1.5 text-left w-[90px]">
                      BSY
                    </th>
                  )}
                  {ayKolonlari.map((kolon, i) => (
                    <th key={i} className="border-r border-purple-500 px-1 py-1.5 text-right w-[70px]">
                      {kolon.baslik}
                    </th>
                  ))}
                  <th className="border-r border-purple-500 px-1 py-1.5 text-right w-[80px]">
                    Toplam
                  </th>
                  <th className="border-r border-purple-500 px-1 py-1.5 text-center w-[120px]">
                    Tahsilat Planı
                  </th>
                  <th className="border-r border-purple-500 px-1 py-1.5 text-center w-[90px]">
                    Tür
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row, idx) => {
                  const rowBsy = row.bsyAdi || (row as any)._bsyAdi || bsyAdi
                  const secim = secimler.get(row.cariKod)
                  const henuzSecilmedi = !secim?.hafta || !secim?.tur

                  return (
                    <tr key={`${row.cariKod}-${idx}`} className={clsx(
                      'border-b border-gray-100 hover:bg-purple-50/30',
                      idx % 2 === 1 && 'bg-gray-50/40'
                    )}>
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-1 py-1 text-gray-600 font-mono">
                        {row.cariKod}
                      </td>
                      <td className="bg-white border-r border-gray-200 px-1 py-1 font-medium text-gray-800" title={row.cariIsim}>
                        {kisaltCariIsim(row.cariIsim)}
                      </td>
                      {isAdmin && (
                        <td className="bg-white border-r border-gray-200 px-1 py-1 text-xs text-gray-700 font-medium">
                          {row.bsyAdi || '-'}
                        </td>
                      )}

                      {/* Ay kolonları */}
                      {ayKolonlari.map((kolon, i) => {
                        const deger = row[kolon.field]
                        return (
                          <td key={i} className="border-r border-gray-100 px-1 py-1 text-right text-gray-600 tabular-nums">
                            {deger > 0 ? Math.round(deger).toLocaleString('tr-TR') : '—'}
                          </td>
                        )
                      })}

                      <td className="border-r border-gray-100 px-1 py-1 text-right font-semibold text-gray-800 tabular-nums">
                        {row.toplam > 0 ? Math.round(row.toplam).toLocaleString('tr-TR') : '—'}
                      </td>

                      {/* Tahsilat Planı Dropdown */}
                      <td className="border-r border-gray-100 px-1 py-0.5">
                        <select
                          value={secim?.hafta || ''}
                          onChange={e => saveSecim(row.cariKod, row.cariIsim, 'hafta', e.target.value, rowBsy)}
                          disabled={saving}
                          className={clsx(
                            'w-full text-[8px] border rounded px-1 py-1 focus:outline-none focus:border-purple-400',
                            !secim?.hafta
                              ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'bg-white border-purple-300 text-purple-700 font-semibold'
                          )}
                        >
                          <option value="">{!secim?.hafta ? 'Plan Gir' : 'Seç'}</option>
                          {haftaSecenekleri.map(hafta => (
                            <option key={hafta} value={hafta}>{hafta}</option>
                          ))}
                        </select>
                      </td>

                      {/* Tahsilat Türü Dropdown */}
                      <td className="border-r border-gray-100 px-1 py-0.5">
                        <select
                          value={secim?.tur || ''}
                          onChange={e => saveSecim(row.cariKod, row.cariIsim, 'tur', e.target.value, rowBsy)}
                          disabled={saving}
                          className={clsx(
                            'w-full text-[8px] border rounded px-1 py-1 focus:outline-none focus:border-purple-400',
                            !secim?.tur
                              ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'bg-white border-purple-300 text-purple-700 font-semibold'
                          )}
                        >
                          <option value="">{!secim?.tur ? 'Plan Gir' : 'Seç'}</option>
                          {TAHSILAT_TURLERI.map(tur => (
                            <option key={tur} value={tur}>{tur}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
