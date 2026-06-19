'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function fmtCur(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface TahsilatPlanimRow {
  cariKod:   string
  cariIsim:  string
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

// Hafta seçeneklerini dinamik oluştur
function getHaftaSecenekleri(ay: number): string[] {
  const now = new Date()
  const bugun = now.getDate()
  const buAy = now.getMonth() + 1

  // Temmuz ayı için sabit haftalar
  const temmuzHaftalar = [
    '29 Haziran-4 Temmuz',
    '5-11 Temmuz',
    '12-18 Temmuz',
    '19-25 Temmuz',
    '26 Temmuz-1 Ağustos'
  ]

  // Haziran ayı için sabit haftalar
  const haziranHaftalar = [
    '1-6 Haziran',
    '7-13 Haziran',
    '14-20 Haziran',
    '21-27 Haziran',
    '28 Haziran-4 Temmuz'
  ]

  if (ay === 6) { // Haziran
    if (buAy === 6) {
      // Bugünün tarihine göre filtrele
      return haziranHaftalar.filter(hafta => {
        const parcalar = hafta.split('-')
        const baslangic = parseInt(parcalar[0].replace(/\D/g, ''))
        return bugun <= baslangic + 6 // Haftanın son günü
      })
    }
    return haziranHaftalar
  }

  if (ay === 7) { // Temmuz
    return temmuzHaftalar
  }

  // Diğer aylar için dinamik oluştur
  const ayAdi = MONTHS_TR[ay - 1]
  const sonrakiAy = MONTHS_TR[ay % 12]

  return [
    `1-6 ${ayAdi}`,
    `7-13 ${ayAdi}`,
    `14-20 ${ayAdi}`,
    `21-27 ${ayAdi}`,
    `28 ${ayAdi}-4 ${sonrakiAy}`
  ]
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

  // Kullanıcı seçimleri (local state)
  const [secimler, setSecimler] = useState<Map<string, { hafta: string; tur: string }>>(new Map())

  // Verileri yükle
  async function loadData() {
    setLoading(true)
    try {
      // Eğer bölge müdürüyse (Burak Kılıç), hem kendi hem de IB2'nin verilerini çek
      const bsyAdlari = isBolgeMuduru
        ? [bsyAdi, 'Okan Oğuz']
        : [bsyAdi]

      const allRows: TahsilatPlanimRow[] = []

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

      setRows(allRows)

      // Seçimleri yükle
      const newSecimler = new Map<string, { hafta: string; tur: string }>()
      allRows.forEach(r => {
        if (r.tahsilatHaftasi || r.tahsilatTuru) {
          newSecimler.set(r.cariKod, {
            hafta: r.tahsilatHaftasi || '',
            tur: r.tahsilatTuru || ''
          })
        }
      })
      setSecimler(newSecimler)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (bsyAdi) loadData()
  }, [yil, ay, bsyAdi, isBolgeMuduru])

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

        <div className="flex-1" />

        {!loading && rows.length > 0 && (
          <span className="text-[10px] text-gray-400">
            {rows.length} Cari · {MONTHS_TR[ay - 1]} {yil}
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
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-purple-600 text-white">
                  <th className="sticky left-0 z-30 bg-purple-600 border-r border-purple-500 px-3 py-2 text-left min-w-[50px]">
                    Cari Kod
                  </th>
                  <th className="sticky left-[50px] z-30 bg-purple-600 border-r border-purple-500 px-3 py-2 text-left min-w-[200px]">
                    Cari İsim
                  </th>
                  {ayKolonlari.map((kolon, i) => (
                    <th key={i} className="border-r border-purple-500 px-3 py-2 text-center min-w-[100px]">
                      {kolon.baslik}
                    </th>
                  ))}
                  <th className="border-r border-purple-500 px-3 py-2 text-center min-w-[100px]">
                    Toplam
                  </th>
                  <th className="border-r border-purple-500 px-3 py-2 text-center min-w-[150px]">
                    Tahsilat Planım
                  </th>
                  <th className="border-r border-purple-500 px-3 py-2 text-center min-w-[130px]">
                    Tahsilat Türü
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const secim = secimler.get(row.cariKod)
                  const henuzSecilmedi = !secim?.hafta || !secim?.tur
                  const rowBsy = (row as any)._bsyAdi || bsyAdi

                  return (
                    <tr key={`${row.cariKod}-${idx}`} className={clsx(
                      'border-b border-gray-100 hover:bg-purple-50/30',
                      idx % 2 === 1 && 'bg-gray-50/40'
                    )}>
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 text-gray-600 font-mono text-[10px]">
                        {row.cariKod}
                      </td>
                      <td className="sticky left-[50px] z-10 bg-white border-r border-gray-200 px-3 py-2 font-semibold text-gray-800">
                        {row.cariIsim}
                        {isBolgeMuduru && rowBsy !== bsyAdi && (
                          <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {rowBsy}
                          </span>
                        )}
                      </td>

                      {/* Ay kolonları */}
                      {ayKolonlari.map((kolon, i) => {
                        const deger = row[kolon.field]
                        return (
                          <td key={i} className="border-r border-gray-100 px-3 py-2 text-right text-gray-600 tabular-nums">
                            {deger > 0 ? fmtCur(deger) : '—'}
                          </td>
                        )
                      })}

                      <td className="border-r border-gray-100 px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">
                        {row.toplam > 0 ? fmtCur(row.toplam) : '—'}
                      </td>

                      {/* Tahsilat Planı Dropdown */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <select
                          value={secim?.hafta || ''}
                          onChange={e => saveSecim(row.cariKod, row.cariIsim, 'hafta', e.target.value, rowBsy)}
                          disabled={saving}
                          className={clsx(
                            'w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:border-purple-400',
                            henuzSecilmedi || !secim?.hafta
                              ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'bg-white border-gray-200 text-gray-800'
                          )}
                        >
                          <option value="">
                            {henuzSecilmedi || !secim?.hafta ? 'Henüz Plan Girmediniz' : 'Seçiniz'}
                          </option>
                          {haftaSecenekleri.map(hafta => (
                            <option key={hafta} value={hafta}>
                              {hafta}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Tahsilat Türü Dropdown */}
                      <td className="border-r border-gray-100 px-2 py-1.5">
                        <select
                          value={secim?.tur || ''}
                          onChange={e => saveSecim(row.cariKod, row.cariIsim, 'tur', e.target.value, rowBsy)}
                          disabled={saving}
                          className={clsx(
                            'w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:border-purple-400',
                            henuzSecilmedi || !secim?.tur
                              ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'bg-white border-gray-200 text-gray-800'
                          )}
                        >
                          <option value="">
                            {henuzSecilmedi || !secim?.tur ? 'Henüz Plan Girmediniz' : 'Seçiniz'}
                          </option>
                          {TAHSILAT_TURLERI.map(tur => (
                            <option key={tur} value={tur}>
                              {tur}
                            </option>
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
