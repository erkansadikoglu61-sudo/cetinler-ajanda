'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function fmtCur(n: number) {
  return '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Hafta seçeneklerini dinamik oluştur (Pazartesi-Pazar, bugünden itibaren 5 hafta)
function getHaftaSecenekleri(): Array<{ label: string; startDate: Date; endDate: Date }> {
  const bugun = new Date()

  // Bu haftanın pazartesini bul
  const gunIndex = bugun.getDay() // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const pazartesiFarki = gunIndex === 0 ? -6 : 1 - gunIndex

  const buHaftaPazartesi = new Date(bugun)
  buHaftaPazartesi.setDate(bugun.getDate() + pazartesiFarki)
  buHaftaPazartesi.setHours(0, 0, 0, 0)

  const haftalar: Array<{ label: string; startDate: Date; endDate: Date }> = []

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

    let label: string
    if (haftaBaslangic.getMonth() === haftaBitis.getMonth()) {
      // Aynı ay içinde
      label = `${baslangicGun}-${bitisGun} ${baslangicAy}`
    } else {
      // Ay geçişi var
      label = `${baslangicGun} ${baslangicAy}-${bitisGun} ${bitisAy}`
    }

    haftalar.push({ label, startDate: haftaBaslangic, endDate: haftaBitis })
  }

  return haftalar
}

interface TahsilatData {
  cariKod: string
  cariIsim: string
  bsyAdi?: string
  onceki: number
  kasim: number
  aralik: number
  ocak: number
  subat: number
  mart: number
  nisan: number
  mayis: number
  haziran: number
  toplam: number
  tahsilatHaftasi?: string
  tutar?: number
  tahsilatTuru?: string
}

export function TahsilatTakvimiView({ isAdmin = false }: { isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TahsilatData[]>([])
  const [haftalar] = useState(getHaftaSecenekleri())

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tahsilat-planim')
      if (!res.ok) throw new Error('API hatası')
      const jsonData = await res.json()
      setData(jsonData)
    } catch (error) {
      console.error('Tahsilat takvimi yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Tahsilat takvimi yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Her hafta için tahsilatları grupla
  const tahsilatlarHaftaBasina = haftalar.map(hafta => {
    // Sadece tahsilat bilgisi olan kayıtları al
    const haftaninTahsilatlari = data.filter(d =>
      d.tahsilatHaftasi === hafta.label &&
      d.tutar &&
      d.tutar > 0 &&
      d.tahsilatTuru
    )

    const cek = haftaninTahsilatlari
      .filter(t => t.tahsilatTuru === 'Çek')
      .reduce((sum, t) => sum + (t.tutar || 0), 0)

    const krediKarti = haftaninTahsilatlari
      .filter(t => t.tahsilatTuru === 'Kredi Kartı')
      .reduce((sum, t) => sum + (t.tutar || 0), 0)

    const nakit = haftaninTahsilatlari
      .filter(t => t.tahsilatTuru === 'Nakit')
      .reduce((sum, t) => sum + (t.tutar || 0), 0)

    const toplam = cek + krediKarti + nakit

    return {
      hafta: hafta.label,
      cek,
      krediKarti,
      nakit,
      toplam
    }
  })

  // Genel toplam
  const genelToplam = {
    cek: tahsilatlarHaftaBasina.reduce((sum, h) => sum + h.cek, 0),
    krediKarti: tahsilatlarHaftaBasina.reduce((sum, h) => sum + h.krediKarti, 0),
    nakit: tahsilatlarHaftaBasina.reduce((sum, h) => sum + h.nakit, 0),
    toplam: tahsilatlarHaftaBasina.reduce((sum, h) => sum + h.toplam, 0)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-lg font-bold">Tahsilat Takvimi</h1>
          <p className="text-xs text-purple-100">5 Haftalık Ödeme Takvimi</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 hover:bg-white/20 rounded transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-red-500 to-red-600">
                <th className="text-left px-6 py-4 text-white font-bold text-base border-r border-red-400">
                  Ödeme Haftası
                </th>
                <th className="text-right px-6 py-4 text-white font-bold text-base border-r border-red-400">
                  Çek
                </th>
                <th className="text-right px-6 py-4 text-white font-bold text-base border-r border-red-400">
                  Kredi Kartı
                </th>
                <th className="text-right px-6 py-4 text-white font-bold text-base border-r border-red-400">
                  Nakit
                </th>
                <th className="text-right px-6 py-4 text-white font-bold text-base">
                  Toplam
                </th>
              </tr>
            </thead>
            <tbody>
              {tahsilatlarHaftaBasina.map((hafta, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 border-r border-gray-200">
                    {hafta.hafta}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                    {hafta.cek > 0 ? fmtCur(hafta.cek) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                    {hafta.krediKarti > 0 ? fmtCur(hafta.krediKarti) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                    {hafta.nakit > 0 ? fmtCur(hafta.nakit) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-purple-700">
                    {hafta.toplam > 0 ? fmtCur(hafta.toplam) : '—'}
                  </td>
                </tr>
              ))}

              {/* Genel Toplam */}
              <tr className="bg-gradient-to-r from-purple-100 to-indigo-100 font-bold">
                <td className="px-6 py-4 text-base text-purple-900 border-r border-purple-200">
                  Toplam
                </td>
                <td className="px-6 py-4 text-base text-right text-purple-900 border-r border-purple-200">
                  {genelToplam.cek > 0 ? fmtCur(genelToplam.cek) : '—'}
                </td>
                <td className="px-6 py-4 text-base text-right text-purple-900 border-r border-purple-200">
                  {genelToplam.krediKarti > 0 ? fmtCur(genelToplam.krediKarti) : '—'}
                </td>
                <td className="px-6 py-4 text-base text-right text-purple-900 border-r border-purple-200">
                  {genelToplam.nakit > 0 ? fmtCur(genelToplam.nakit) : '—'}
                </td>
                <td className="px-6 py-4 text-base text-right text-purple-900 font-bold">
                  {fmtCur(genelToplam.toplam)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
