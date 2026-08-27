'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'

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

interface GerceklesenTahsilat {
  bankaKK: number
  cekSenet: number
  toplam: number
}

export function TahsilatTakvimiView({ isAdmin = false }: { isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TahsilatData[]>([])
  const [haftalar] = useState(getHaftaSecenekleri())
  const [gerceklesen, setGerceklesen] = useState<GerceklesenTahsilat>({ bankaKK: 0, cekSenet: 0, toplam: 0 })
  // Tutara tıklanınca açılan detay modalı (hangi müşterilerden oluştuğu)
  const [detay, setDetay] = useState<{ hafta: string; tur: string | null } | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [planRes, gercRes] = await Promise.all([
        fetch('/api/tahsilat-planim'),
        fetch('/api/tahsilat-gerceklesen'),
      ])
      if (!planRes.ok) throw new Error('API hatası')
      const jsonData = await planRes.json()
      // API { rows: [] } formatında dönüyor
      setData(jsonData.rows || [])

      // Gerçekleşen tahsilatlar (saha exceli — içinde bulunulan ay)
      if (gercRes.ok) {
        const g = await gercRes.json()
        setGerceklesen({
          bankaKK: g.bankaKK || 0,
          cekSenet: g.cekSenet || 0,
          toplam: g.toplam || 0,
        })
      } else {
        setGerceklesen({ bankaKK: 0, cekSenet: 0, toplam: 0 })
      }
    } catch (error) {
      console.error('Tahsilat takvimi yükleme hatası:', error)
      setData([])
      setGerceklesen({ bankaKK: 0, cekSenet: 0, toplam: 0 })
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
    // "Tahsilat Yapıldı" seçilen satırlar takvime eklenmez (planı şaşırtmasın)
    const haftaninTahsilatlari = data.filter(d =>
      d.tahsilatHaftasi === hafta.label &&
      d.tahsilatHaftasi !== 'Tahsilat Yapıldı' &&
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

  // Gerçekleşen tahsilatlar bulunduğumuz aya göre gösterilir
  const buAyLabel = `${MONTHS_TR[new Date().getMonth()]} ${new Date().getFullYear()}`

  // Modal için: seçilen hafta + tür kırılımına göre müşteri listesi
  const detayMusteriler = detay
    ? data
        .filter(d =>
          d.tahsilatHaftasi === detay.hafta &&
          d.tahsilatHaftasi !== 'Tahsilat Yapıldı' &&
          d.tutar &&
          d.tutar > 0 &&
          d.tahsilatTuru &&
          (detay.tur === null || d.tahsilatTuru === detay.tur)
        )
        .sort((a, b) => (b.tutar || 0) - (a.tutar || 0))
    : []
  const detayToplam = detayMusteriler.reduce((sum, d) => sum + (d.tutar || 0), 0)

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
                <th className="text-right px-6 py-4 text-white font-bold text-lg">
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
                    {hafta.cek > 0 ? (
                      <button
                        onClick={() => setDetay({ hafta: hafta.hafta, tur: 'Çek' })}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title="Müşteri detayını gör"
                      >
                        {fmtCur(hafta.cek)}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                    {hafta.krediKarti > 0 ? (
                      <button
                        onClick={() => setDetay({ hafta: hafta.hafta, tur: 'Kredi Kartı' })}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title="Müşteri detayını gör"
                      >
                        {fmtCur(hafta.krediKarti)}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                    {hafta.nakit > 0 ? (
                      <button
                        onClick={() => setDetay({ hafta: hafta.hafta, tur: 'Nakit' })}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title="Müşteri detayını gör"
                      >
                        {fmtCur(hafta.nakit)}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-base text-right font-bold text-purple-700">
                    {hafta.toplam > 0 ? (
                      <button
                        onClick={() => setDetay({ hafta: hafta.hafta, tur: null })}
                        className="text-purple-700 hover:text-purple-900 hover:underline cursor-pointer font-bold"
                        title="Müşteri detayını gör"
                      >
                        {fmtCur(hafta.toplam)}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}

              {/* Genel Toplam */}
              <tr className="bg-gradient-to-r from-purple-100 to-indigo-100 font-bold">
                <td className="px-6 py-4 text-lg text-purple-900 border-r border-purple-200">
                  Toplam
                </td>
                <td className="px-6 py-4 text-lg text-right text-purple-900 border-r border-purple-200">
                  {genelToplam.cek > 0 ? fmtCur(genelToplam.cek) : '—'}
                </td>
                <td className="px-6 py-4 text-lg text-right text-purple-900 border-r border-purple-200">
                  {genelToplam.krediKarti > 0 ? fmtCur(genelToplam.krediKarti) : '—'}
                </td>
                <td className="px-6 py-4 text-lg text-right text-purple-900 border-r border-purple-200">
                  {genelToplam.nakit > 0 ? fmtCur(genelToplam.nakit) : '—'}
                </td>
                <td className="px-6 py-4 text-xl text-right text-purple-900 font-bold">
                  {fmtCur(genelToplam.toplam)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gerçekleşen Tahsilatlar tablosu (bulunduğumuz ay) */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-6">
          <table className="w-full">
            <thead>
              {/* Başlık bandı */}
              <tr className="bg-gradient-to-r from-purple-600 to-indigo-600">
                <th colSpan={3} className="text-left px-6 py-3 text-white">
                  <span className="font-bold text-base">Gerçekleşen Tahsilatlar</span>
                  <span className="ml-2 text-xs text-purple-100">{buAyLabel}</span>
                </th>
              </tr>
              {/* Kolon başlıkları */}
              <tr className="bg-gradient-to-r from-red-500 to-red-600">
                <th className="text-right px-6 py-4 text-white font-bold text-base border-r border-red-400">
                  Nakit-Kredi Kartı
                </th>
                <th className="text-right px-6 py-4 text-white font-bold text-base border-r border-red-400">
                  Çek
                </th>
                <th className="text-right px-6 py-4 text-white font-bold text-lg">
                  Toplam
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                  {gerceklesen.bankaKK > 0 ? fmtCur(gerceklesen.bankaKK) : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700 border-r border-gray-200">
                  {gerceklesen.cekSenet > 0 ? fmtCur(gerceklesen.cekSenet) : '—'}
                </td>
                <td className="px-6 py-4 text-base text-right font-bold text-purple-700">
                  {gerceklesen.toplam > 0 ? fmtCur(gerceklesen.toplam) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Müşteri Detay Modalı */}
      {detay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetay(null)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal başlık */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">
                  {detay.tur ?? 'Tüm Tahsilatlar'} — {detay.hafta}
                </h2>
                <p className="text-xs text-purple-100">
                  {detayMusteriler.length} müşteri
                </p>
              </div>
              <button
                onClick={() => setDetay(null)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal içerik */}
            <div className="flex-1 overflow-auto">
              {detayMusteriler.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Kayıt bulunamadı.</p>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-bold text-gray-600">Müşteri</th>
                      {detay.tur === null && (
                        <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-600">Tür</th>
                      )}
                      <th className="text-right px-5 py-2.5 text-xs font-bold text-gray-600">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detayMusteriler.map((m, i) => (
                      <tr key={`${m.cariKod}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-5 py-2.5 text-sm text-gray-800">{m.cariIsim}</td>
                        {detay.tur === null && (
                          <td className="px-3 py-2.5 text-xs text-gray-600">{m.tahsilatTuru}</td>
                        )}
                        <td className="px-5 py-2.5 text-sm text-right font-semibold text-gray-800">
                          {fmtCur(m.tutar || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal toplam */}
            {detayMusteriler.length > 0 && (
              <div className="bg-purple-50 border-t border-purple-200 px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-purple-900">Toplam</span>
                <span className="text-base font-bold text-purple-900">{fmtCur(detayToplam)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
