'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import type { DashboardSalesMetrics } from '@/app/api/dashboard-sales/route'
import type { DashboardSelloutMetrics } from '@/app/api/dashboard-sellout/route'
import type { DashboardTahsilatMetrics } from '@/app/api/dashboard-tahsilat/route'
import type { DashboardResponse } from '@/app/api/dashboard/route'

const fmtTL = (n: number) => '₺' + Math.round(n).toLocaleString('tr-TR')
const fmtN = (n: number) => n.toLocaleString('tr-TR')
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export function AdminDashboardView() {
  const now = new Date()
  const yil = 2026
  // Temmuz ayı henüz başladı, Haziran verilerini göster
  const defaultAy = now.getMonth() + 1 === 7 && now.getDate() === 1 ? 6 : now.getMonth() + 1

  const [ay, setAy] = useState(defaultAy)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<DashboardSalesMetrics | null>(null)
  const [sellout, setSellout] = useState<DashboardSelloutMetrics | null>(null)
  const [tahsilat, setTahsilat] = useState<DashboardTahsilatMetrics | null>(null)
  const [dashboardYillik, setDashboardYillik] = useState<DashboardResponse | null>(null)
  const [dashboardAylik, setDashboardAylik] = useState<DashboardResponse | null>(null)
  const [showCiroModal, setShowCiroModal] = useState(false)
  const [ciroModalData, setCiroModalData] = useState<Array<{cariIsim: string; ciro: number; pay: number}>>([])
  const [showTahsilatModal, setShowTahsilatModal] = useState(false)
  const [tahsilatModalData, setTahsilatModalData] = useState<Array<{cariIsim: string; tutar: number; pay: number; acikBakiye?: number}>>([])
  const [modalTitle, setModalTitle] = useState('')
  const [modalSubtitle, setModalSubtitle] = useState('')
  const [showAcikBakiye, setShowAcikBakiye] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [salesRes, selloutRes, tahsilatRes, dashYillikRes, dashAylikRes] = await Promise.all([
        fetch(`/api/dashboard-sales?yil=${yil}&ay=${ay}`),
        fetch(`/api/dashboard-sellout?yil=${yil}&ay=${ay}`),
        fetch(`/api/dashboard-tahsilat?yil=${yil}&ay=${ay}`),
        fetch(`/api/dashboard?yil=${yil}`),  // Yıllık (ay yok)
        fetch(`/api/dashboard?yil=${yil}&ay=${ay}`),  // Aylık
      ])

      // Hata kontrolü
      if (!salesRes.ok) throw new Error(`Sales API error: ${salesRes.status}`)
      if (!selloutRes.ok) throw new Error(`Sellout API error: ${selloutRes.status}`)
      if (!tahsilatRes.ok) throw new Error(`Tahsilat API error: ${tahsilatRes.status}`)
      if (!dashYillikRes.ok) throw new Error(`Dashboard Yıllık API error: ${dashYillikRes.status}`)
      if (!dashAylikRes.ok) throw new Error(`Dashboard Aylık API error: ${dashAylikRes.status}`)

      const [salesData, selloutData, tahsilatData, dashYillikData, dashAylikData] = await Promise.all([
        salesRes.json(),
        selloutRes.json(),
        tahsilatRes.json(),
        dashYillikRes.json(),
        dashAylikRes.json(),
      ])

      setSales(salesData)
      setSellout(selloutData)
      setTahsilat(tahsilatData)
      setDashboardYillik(dashYillikData)
      setDashboardAylik(dashAylikData)
    } catch (error) {
      console.error('❌ Dashboard loadData error:', error)
      alert('Dashboard yüklenirken hata oluştu: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleAylikCiroClick = () => {
    if (sales?.aylikCariDetay) {
      setModalTitle('Aylık Ciro Dağılımı')
      setModalSubtitle(`${MONTHS_TR[ay - 1]} ${yil} - Cari Bazında`)
      setCiroModalData(sales.aylikCariDetay)
      setShowCiroModal(true)
    }
  }

  const handleYillikCiroClick = () => {
    if (sales?.yillikCariDetay) {
      setModalTitle('Yıllık Ciro Dağılımı')
      setModalSubtitle(`${yil} - Cari Bazında`)
      setCiroModalData(sales.yillikCariDetay)
      setShowCiroModal(true)
    }
  }

  const handleAcikHesapClick = () => {
    if (tahsilat?.acikHesapCariDetay) {
      setModalTitle('Açık Hesap Dağılımı')
      setModalSubtitle(`${MONTHS_TR[ay - 1]} ${yil} - Cari Bazında`)
      setTahsilatModalData(tahsilat.acikHesapCariDetay)
      setShowAcikBakiye(false)
      setShowTahsilatModal(true)
    }
  }

  const handleTahsilatHedefClick = () => {
    if (tahsilat?.acikHesapCariDetay) {
      // Hedef = Açık Hesap'ın %90'ı
      const hedefDetay = tahsilat.acikHesapCariDetay.map(item => ({
        cariIsim: item.cariIsim,
        tutar: item.tutar * 0.90,
        pay: item.pay,
        acikBakiye: item.tutar
      }))
      setModalTitle('Tahsilat Hedefi Dağılımı')
      setModalSubtitle(`${MONTHS_TR[ay - 1]} ${yil} - Cari Bazında (Açık Hesap\'ın %90\'ı)`)
      setTahsilatModalData(hedefDetay)
      setShowAcikBakiye(true)
      setShowTahsilatModal(true)
    }
  }

  const handleGerceklesenClick = () => {
    if (tahsilat?.gerceklesenCariDetay) {
      setModalTitle('Gerçekleşen Tahsilat Dağılımı')
      setModalSubtitle(`${MONTHS_TR[ay - 1]} ${yil} - Cari Bazında`)
      setTahsilatModalData(tahsilat.gerceklesenCariDetay)
      setShowAcikBakiye(false)
      setShowTahsilatModal(true)
    }
  }

  const handleTahsilatTurleriClick = () => {
    alert('Tahsilat Türleri için detay görünümü yakında eklenecek.')
  }

  useEffect(() => {
    loadData()
  }, [ay])

  if (loading || !sales || !sellout || !tahsilat || !dashboardYillik || !dashboardAylik) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden" style={{ fontFamily: '"Inter", "Geist", sans-serif' }}>
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-sm font-bold">Dashboard 2026</h1>
          <div className="flex items-center gap-2">
            <select
              value={ay}
              onChange={(e) => setAy(parseInt(e.target.value))}
              className="text-[10px] bg-white/20 text-white border border-white/30 rounded px-2 py-0.5 outline-none hover:bg-white/30 cursor-pointer"
            >
              {MONTHS_TR.map((month, index) => (
                <option key={index} value={index + 1} className="text-gray-900">{month}</option>
              ))}
            </select>
            <span className="text-[10px] text-purple-100">{yil}</span>
          </div>
        </div>
        <button onClick={loadData} disabled={loading} className="p-1 hover:bg-white/20 rounded">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content - 3 Rows */}
      <div className="flex-1 overflow-y-auto p-1">
        <div className="h-full flex flex-col gap-1">
          {/* ============ SATIŞ ROW ============ */}
          <div className="flex gap-1 flex-1">
            {/* Vertical Label */}
            <div className="w-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded flex items-center justify-center">
              <div className="transform -rotate-90 whitespace-nowrap">
                <span className="text-[11px] font-bold text-white tracking-wider">SATIŞ</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-white rounded shadow border border-gray-200 p-1 flex flex-col">
              <div className="grid grid-cols-4 gap-2 h-full">
                {/* Aylık Ciro Kartı */}
                <div
                  onClick={handleAylikCiroClick}
                  className="relative bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg p-3 text-white overflow-hidden shadow-lg cursor-pointer hover:from-slate-600 hover:to-slate-800 transition-all flex flex-col">
                  <div className="absolute top-2 right-2">
                    <svg className="w-16 h-16 transform rotate-180" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray={`${(sales.aylikCiro / sales.aylikCiroHedef) * 100}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-blue-400">{fmtPct(sales.aylikCiro / sales.aylikCiroHedef)}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-300 mb-1">Aylık Ciro</div>
                  <div className="text-[22px] font-bold mb-1">{fmtTL(sales.aylikCiro)}</div>
                  <div className="text-[13px] text-blue-200">
                    <span>{MONTHS_TR[ay - 1]} Gerçekleşen</span>
                  </div>
                  <div className="text-[13px] text-white/90 mt-0.5">Hedef: {fmtTL(sales.aylikCiroHedef)}</div>
                </div>

                {/* Yıllık Ciro Kartı */}
                <div
                  onClick={handleYillikCiroClick}
                  className="relative bg-gradient-to-br from-teal-700 to-teal-900 rounded-lg p-3 text-white overflow-hidden shadow-lg cursor-pointer hover:from-teal-600 hover:to-teal-800 transition-all flex flex-col">
                  <div className="absolute top-2 right-2">
                    <svg className="w-16 h-16 transform rotate-180" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="2"
                        strokeDasharray={`${(sales.yillikCiro / sales.yillikCiroHedef) * 100}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-teal-400">{fmtPct(sales.yillikCiro / sales.yillikCiroHedef)}</span>
                    </div>
                  </div>
                  <div className="text-[13px] text-gray-300 mb-1">2026 Toplam Ciro</div>
                  <div className="text-[20px] font-bold mb-1">{fmtTL(sales.yillikCiro)}</div>
                  <div className="text-[10px] text-teal-200">
                    <span>Yıl İçi Gerçekleşen</span>
                  </div>
                  <div className="text-[10px] text-white/90 mt-0.5">Hedef: {fmtTL(sales.yillikCiroHedef)}</div>
                </div>

                {/* Grup Bazında Ciro Kartı */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-3 text-white shadow-lg flex flex-col">
                  <div className="text-[10px] font-bold mb-2">Grup Bazında Ciro</div>
                  <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-3 gap-y-1.5">
                    {/* Header */}
                    <div></div>
                    <div className="text-[10px] font-semibold text-white/80 text-right">{MONTHS_TR[ay - 1]}</div>
                    <div className="text-[10px] font-semibold text-white/80 text-right">{yil}</div>
                    <div className="text-[10px] font-semibold text-white/80 text-right">Payı</div>

                    {/* RELUX */}
                    <div className="text-white font-medium text-[13px]">RELUX</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.aylikCiroGrup.relux)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.yillikCiroGrup.relux)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{((sales.yillikCiroGrup.relux / (sales.yillikCiroGrup.relux + sales.yillikCiroGrup.ekea + sales.yillikCiroGrup.ebe)) * 100).toFixed(2)}%</div>

                    {/* EKEA */}
                    <div className="text-white font-medium text-[13px]">EKEA</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.aylikCiroGrup.ekea)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.yillikCiroGrup.ekea)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{((sales.yillikCiroGrup.ekea / (sales.yillikCiroGrup.relux + sales.yillikCiroGrup.ekea + sales.yillikCiroGrup.ebe)) * 100).toFixed(2)}%</div>

                    {/* EBE */}
                    <div className="text-white font-medium text-[13px]">EBE</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.aylikCiroGrup.ebe)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.yillikCiroGrup.ebe)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{((sales.yillikCiroGrup.ebe / (sales.yillikCiroGrup.relux + sales.yillikCiroGrup.ekea + sales.yillikCiroGrup.ebe)) * 100).toFixed(2)}%</div>

                    {/* Toplam - Border üstü */}
                    <div className="col-span-4 border-t border-white/30 mt-1 pt-1"></div>

                    {/* Toplam */}
                    <div></div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.aylikCiroGrup.relux + sales.aylikCiroGrup.ekea + sales.aylikCiroGrup.ebe)}</div>
                    <div className="font-bold text-white text-[13px] text-right">{fmtTL(sales.yillikCiroGrup.relux + sales.yillikCiroGrup.ekea + sales.yillikCiroGrup.ebe)}</div>
                    <div className="font-bold text-white text-[13px] text-right">100,00%</div>
                  </div>
                </div>

                {/* Müşteri Grup Kartı */}
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg p-3 text-white shadow-lg flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <span className="text-xl">💰</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold">Müşteri</div>
                      <div className="text-[13px] text-white/80">Group</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/10 backdrop-blur rounded p-1.5">
                      <div className="text-[13px] text-white font-semibold mb-0.5">RELUX</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[14px] font-bold">{fmtN(dashboardYillik.musteriSayisi.relux)}</span>
                        <span className="text-[13px] text-white/90">Yıllık</span>
                      </div>
                      <div className="text-[10px] text-white/95 font-medium">{fmtN(dashboardAylik.musteriSayisi.relux)} {MONTHS_TR[ay - 1]}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded p-1.5">
                      <div className="text-[13px] text-white font-semibold mb-0.5">ELECTROLUX</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[14px] font-bold">{fmtN(dashboardYillik.musteriSayisi.elux)}</span>
                        <span className="text-[13px] text-white/90">Yıllık</span>
                      </div>
                      <div className="text-[10px] text-white/95 font-medium">{fmtN(dashboardAylik.musteriSayisi.elux)} {MONTHS_TR[ay - 1]}</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-white font-semibold">Toplam Müşteri</span>
                      <span className="text-[15px] font-bold">{fmtN(dashboardYillik.musteriSayisi.toplam)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============ TAHSİLAT ROW ============ */}
          <div className="flex gap-1 flex-1">
            <div className="w-6 bg-gradient-to-b from-teal-500 to-teal-600 rounded flex items-center justify-center">
              <div className="transform -rotate-90 whitespace-nowrap">
                <span className="text-[10px] font-bold text-white tracking-wider">TAHSİLAT</span>
              </div>
            </div>
            <div className="flex-1 bg-white rounded shadow border border-gray-200 p-1 flex flex-col">
              <div className="grid grid-cols-4 gap-2 h-full">
                {/* Açık Hesap Kartı */}
                <div
                  onClick={handleAcikHesapClick}
                  className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-3 text-white shadow-lg cursor-pointer flex flex-col hover:from-red-400 hover:to-red-500 transition-all">
                  <div className="text-[10px] mb-1 flex items-center gap-1">
                    <span>🔴</span>
                    <span className="font-semibold">Açık Hesap</span>
                  </div>
                  <div className="text-[15px] font-bold">{fmtTL(tahsilat.acikHesap)}</div>
                </div>

                {/* Tahsilat Hedef Kartı */}
                <div
                  onClick={handleTahsilatHedefClick}
                  className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 text-white shadow-lg cursor-pointer flex flex-col hover:from-orange-400 hover:to-orange-500 transition-all">
                  <div className="text-[10px] mb-1 flex items-center gap-1">
                    <span>🎯</span>
                    <span className="font-semibold">Tahsilat Hedef</span>
                  </div>
                  <div className="text-[15px] font-bold">{fmtTL(tahsilat.tahsilatHedef)}</div>
                </div>

                {/* Gerçekleşen Kartı */}
                <div
                  onClick={handleGerceklesenClick}
                  className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-3 text-white shadow-lg relative overflow-hidden cursor-pointer hover:from-teal-400 hover:to-teal-500 transition-all">
                  <div className="absolute top-2 right-2">
                    <svg className="w-12 h-12 transform rotate-180" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeDasharray={`${(tahsilat.gerceklesenTahsilat / tahsilat.tahsilatHedef) * 100}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[13px] font-bold">{fmtPct(tahsilat.gerceklesenTahsilat / tahsilat.tahsilatHedef)}</span>
                    </div>
                  </div>
                  <div className="text-[10px] mb-1 flex items-center gap-1">
                    <span>✅</span>
                    <span className="font-semibold">Gerçekleşen</span>
                  </div>
                  <div className="text-[15px] font-bold">{fmtTL(tahsilat.gerceklesenTahsilat)}</div>
                </div>

                {/* Tahsilat Türleri Kartı */}
                <div
                  onClick={handleTahsilatTurleriClick}
                  className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-lg cursor-pointer flex flex-col hover:from-purple-400 hover:to-purple-500 transition-all">
                  <div className="text-[10px] font-bold mb-2">Tahsilat Türleri</div>
                  <div className="space-y-1.5">
                    {tahsilat.tahsilatTurleri.map(t => (
                      <div key={t.tur} className="flex justify-between items-center">
                        <span className="text-white font-medium text-[13px]">{t.tur}</span>
                        <span className="font-bold text-white text-[13px]">{fmtTL(t.tutar)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============ SELLOUT ROW ============ */}
          <div className="flex gap-1 flex-[2]">
            <div className="w-6 bg-gradient-to-b from-green-500 to-green-600 rounded flex items-center justify-center">
              <div className="transform -rotate-90 whitespace-nowrap">
                <span className="text-[10px] font-bold text-white tracking-wider">SELLOUT</span>
              </div>
            </div>

            <div className="flex-1 bg-white rounded shadow border border-gray-200 p-1 flex flex-col">
              <div className="flex-1 flex flex-col">
                <p className="text-[10px] font-bold text-gray-600 mb-0.5">2026 ({MONTHS_TR[ay - 1]} / Yıl)</p>
                <div className="grid grid-cols-5 gap-1 flex-1">
                  <TopCard
                    title="Cari"
                    yillikData={sellout.yillikCariTop10.slice(0, 10)}
                    aylikData={sellout.aylikCariTop10}
                    nameKey="cariAdi"
                    color="purple"
                    ay={ay}
                    yil={yil}
                  />
                  <TopCard
                    title="Şube"
                    yillikData={sellout.yillikSubeTop10.slice(0, 10)}
                    aylikData={sellout.aylikSubeTop10}
                    nameKey="subeAdi"
                    color="blue"
                    withCari
                    ay={ay}
                    yil={yil}
                  />
                  <TopCard
                    title="Süpervizör"
                    yillikData={sellout.yillikSupervizorler.slice(0, 10)}
                    aylikData={sellout.aylikSupervizorler}
                    nameKey="supervizorAdi"
                    color="indigo"
                    ay={ay}
                    yil={yil}
                  />
                  <TopCard
                    title="Çetinler Merch"
                    yillikData={sellout.yillikCetinlerMerchTop10.slice(0, 10)}
                    aylikData={sellout.aylikCetinlerMerchTop10}
                    nameKey="merchAdi"
                    color="pink"
                    withCari
                    ay={ay}
                    yil={yil}
                  />
                  <TopCard
                    title="Bayi Merch"
                    yillikData={sellout.yillikBayiMerchTop10.slice(0, 10)}
                    aylikData={sellout.aylikBayiMerchTop10}
                    nameKey="merchAdi"
                    color="teal"
                    withCari
                    ay={ay}
                    yil={yil}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ciro Detay Modal */}
      {showCiroModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCiroModal(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{modalTitle}</h3>
                <p className="text-sm text-slate-300">{modalSubtitle}</p>
              </div>
              <button
                onClick={() => setShowCiroModal(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto max-h-[calc(80vh-100px)]">
              <table className="w-full">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-bold text-slate-700 border-b">Cari İsim</th>
                    <th className="text-right px-6 py-3 text-sm font-bold text-slate-700 border-b">Ciro</th>
                    <th className="text-right px-6 py-3 text-sm font-bold text-slate-700 border-b">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {ciroModalData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="px-6 py-3 text-sm text-slate-900">{item.cariIsim}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 text-right font-semibold">{fmtTL(item.ciro)}</td>
                      <td className="px-6 py-3 text-sm text-slate-700 text-right">{(item.pay * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tahsilat Detay Modal */}
      {showTahsilatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTahsilatModal(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{modalTitle}</h3>
                <p className="text-sm text-slate-300">{modalSubtitle}</p>
              </div>
              <button
                onClick={() => setShowTahsilatModal(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto max-h-[calc(80vh-100px)]">
              <table className="w-full">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-bold text-slate-700 border-b">Cari İsim</th>
                    {showAcikBakiye && (
                      <th className="text-right px-6 py-3 text-sm font-bold text-slate-700 border-b">Açık Bakiye</th>
                    )}
                    <th className="text-right px-6 py-3 text-sm font-bold text-slate-700 border-b">
                      {showAcikBakiye ? 'Hedef Tutar' : 'Tutar'}
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-bold text-slate-700 border-b">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {tahsilatModalData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="px-6 py-3 text-sm text-slate-900">{item.cariIsim}</td>
                      {showAcikBakiye && (
                        <td className="px-6 py-3 text-sm text-slate-600 text-right">{fmtTL(item.acikBakiye || 0)}</td>
                      )}
                      <td className="px-6 py-3 text-sm text-slate-900 text-right font-semibold">{fmtTL(item.tutar)}</td>
                      <td className="px-6 py-3 text-sm text-slate-700 text-right">{(item.pay * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Top Card Component
function TopCard({ title, yillikData, aylikData, nameKey, color, withCari, ay, yil }: {
  title: string
  yillikData: any[]
  aylikData: any[]
  nameKey: string
  color: string
  withCari?: boolean
  ay: number
  yil: number
}) {
  const colors = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
  }

  const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  return (
    <div className={`${colors[color as keyof typeof colors]} border rounded p-2 flex flex-col h-full`}>
      <h5 className="text-[15px] font-bold mb-2">{title}</h5>
      <div className="space-y-1.5 text-[12px] flex-1 overflow-y-auto">
        {yillikData && yillikData.length > 0 ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-gray-600 pb-1 border-b border-gray-300">
              <span>{MONTHS_TR[ay - 1]}</span>
              <span className="text-gray-300">/</span>
              <span>{yil}</span>
              <span className="text-gray-300 ml-0.5">/</span>
              <span>Payı</span>
            </div>
            {yillikData.map((yillikItem, i) => {
            // İsmi kısalt (max 15 karakter)
            let shortName = yillikItem[nameKey]
            if (shortName.length > 15) {
              shortName = shortName.substring(0, 12) + '...'
            }

            // Aylık adet direkt yıllık item'dan al (backend'den geliyor)
            const aylikAdet = yillikItem.aylikAdet || 0

              return (
                <div key={i} className="bg-white/60 rounded px-2 py-1.5 flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex-1 truncate">
                    <span className="font-medium">
                      {i + 1}. {shortName}
                    </span>
                    {withCari && yillikItem.topCari && (
                      <span className="text-[10px] text-gray-500 ml-1">({yillikItem.topCari})</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center whitespace-nowrap">
                    <span className="text-purple-600 font-semibold">{fmtN(aylikAdet)}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-blue-600 font-semibold">{fmtN(yillikItem.adet)}</span>
                    <span className="text-green-600 font-semibold ml-1">{(yillikItem.pay * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <p className="text-center text-gray-300 py-2 text-[12px]">—</p>
        )}
      </div>
    </div>
  )
}
