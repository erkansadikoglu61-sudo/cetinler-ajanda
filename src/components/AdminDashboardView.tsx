'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, TrendingUp, Users, DollarSign, Target, Award, Package } from 'lucide-react'
import type { DashboardSalesMetrics } from '@/app/api/dashboard-sales/route'
import type { DashboardSelloutMetrics } from '@/app/api/dashboard-sellout/route'
import type { DashboardTahsilatMetrics } from '@/app/api/dashboard-tahsilat/route'

const fmtTL = (n: number) => '₺' + Math.round(n).toLocaleString('tr-TR')
const fmtN = (n: number) => n.toLocaleString('tr-TR')
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export function AdminDashboardView() {
  const now = new Date()
  const yil = 2026
  const ay = now.getMonth() + 1

  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<DashboardSalesMetrics | null>(null)
  const [sellout, setSellout] = useState<DashboardSelloutMetrics | null>(null)
  const [tahsilat, setTahsilat] = useState<DashboardTahsilatMetrics | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [salesRes, selloutRes, tahsilatRes] = await Promise.all([
        fetch(`/api/dashboard-sales?yil=${yil}&ay=${ay}`),
        fetch(`/api/dashboard-sellout?yil=${yil}&ay=${ay}`),
        fetch(`/api/dashboard-tahsilat?yil=${yil}&ay=${ay}`),
      ])

      const [salesData, selloutData, tahsilatData] = await Promise.all([
        salesRes.json(),
        selloutRes.json(),
        tahsilatRes.json(),
      ])

      setSales(salesData)
      setSellout(selloutData)
      setTahsilat(tahsilatData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !sales || !sellout || !tahsilat) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-2xl font-bold">Dashboard 2026</h1>
          <p className="text-sm text-purple-100">Güncel Durum: {MONTHS_TR[ay - 1]} {yil}</p>
          {sales?.excelGuncellemeZamani && (
            <p className="text-xs text-purple-200 mt-0.5">
              Güncelleme Saati: {new Date(sales.excelGuncellemeZamani).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content - Single Page Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[1920px] mx-auto space-y-4">
          {/* ========== SATIŞ BÖLGESİ ========== */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-blue-600" size={20} />
              <h2 className="text-lg font-bold text-gray-800">SATIŞ</h2>
            </div>

            {/* Ciro ve Müşteri Sayısı */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CİRO */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="text-blue-600" size={20} />
                  <h3 className="text-sm font-bold text-gray-800">CİRO</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 divide-x divide-blue-200">
                  {/* 2026 */}
                  <div className="pr-3">
                    <p className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-blue-200">2026</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Hedef</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700">{fmtTL(sales.yillikCiroHedef)}</span>
                          <span className="text-xs font-semibold text-gray-500">(100%)</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Gerçekleşen</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-700">{fmtTL(sales.yillikCiro)}</span>
                          <span className="text-xs font-semibold text-blue-600">({fmtPct(sales.yillikCiro / sales.yillikCiroHedef)})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Kalan</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-orange-600">{fmtTL(sales.yillikCiroHedef - sales.yillikCiro)}</span>
                          <span className="text-xs font-semibold text-orange-500">({fmtPct((sales.yillikCiroHedef - sales.yillikCiro) / sales.yillikCiroHedef)})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Haziran */}
                  <div className="pl-3">
                    <p className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-blue-200">{MONTHS_TR[ay - 1]}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Hedef</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700">{fmtTL(sales.aylikCiroHedef)}</span>
                          <span className="text-xs font-semibold text-gray-500">(100%)</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Gerçekleşen</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-700">{fmtTL(sales.aylikCiro)}</span>
                          <span className="text-xs font-semibold text-blue-600">({fmtPct(sales.aylikCiro / sales.aylikCiroHedef)})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Kalan</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-orange-600">{fmtTL(sales.aylikCiroHedef - sales.aylikCiro)}</span>
                          <span className="text-xs font-semibold text-orange-500">({fmtPct((sales.aylikCiroHedef - sales.aylikCiro) / sales.aylikCiroHedef)})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grup Bazında Cirolar */}
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="text-xs font-semibold text-gray-600 mb-3">Grup Bazında Ciro</h4>
                  <div className="grid grid-cols-2 gap-4 divide-x divide-blue-200">
                    {/* 2026 Grup */}
                    <div className="space-y-2 pr-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-purple-600 font-medium">RELUX</span>
                        <span className="text-sm font-bold text-purple-700">{fmtTL(sales.yillikCiroGrup.relux)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-blue-600 font-medium">EKEA</span>
                        <span className="text-sm font-bold text-blue-700">{fmtTL(sales.yillikCiroGrup.ekea)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-emerald-600 font-medium">EBE</span>
                        <span className="text-sm font-bold text-emerald-700">{fmtTL(sales.yillikCiroGrup.ebe)}</span>
                      </div>
                    </div>
                    {/* Haziran Grup */}
                    <div className="space-y-2 pl-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-purple-600 font-medium">RELUX</span>
                        <span className="text-sm font-bold text-purple-700">{fmtTL(sales.aylikCiroGrup.relux)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-blue-600 font-medium">EKEA</span>
                        <span className="text-sm font-bold text-blue-700">{fmtTL(sales.aylikCiroGrup.ekea)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-emerald-600 font-medium">EBE</span>
                        <span className="text-sm font-bold text-emerald-700">{fmtTL(sales.aylikCiroGrup.ebe)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* MÜŞTERİ SAYISI */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="text-green-600" size={20} />
                  <h3 className="text-sm font-bold text-gray-800">MÜŞTERİ SAYISI</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 divide-x divide-green-200">
                  {/* 2026 */}
                  <div className="pr-3">
                    <p className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-green-200">2026</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">RELUX</span>
                        <span className="text-sm font-bold" style={{ color: '#111827' }}>{fmtN(sales.yillikCariSayisi.relux)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">ELECTROLUX</span>
                        <span className="text-sm font-bold" style={{ color: '#2563eb' }}>{fmtN(sales.yillikCariSayisi.electrolux)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-green-200 pt-1 mt-1">
                        <span className="text-xs font-semibold text-gray-600">TOPLAM</span>
                        <span className="text-2xl font-bold" style={{ color: '#15803d' }}>{fmtN(sales.yillikCariSayisi.toplam)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Haziran */}
                  <div className="pl-3">
                    <p className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-green-200">{MONTHS_TR[ay - 1]}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">RELUX</span>
                        <span className="text-sm font-bold" style={{ color: '#111827' }}>{fmtN(sales.aylikCariSayisi.relux)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">ELECTROLUX</span>
                        <span className="text-sm font-bold" style={{ color: '#2563eb' }}>{fmtN(sales.aylikCariSayisi.electrolux)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-green-200 pt-1 mt-1">
                        <span className="text-xs font-semibold text-gray-600">TOPLAM</span>
                        <span className="text-2xl font-bold" style={{ color: '#15803d' }}>{fmtN(sales.aylikCariSayisi.toplam)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========== TAHSİLAT BÖLGESİ ========== */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-2 mb-3">
              <Target className="text-red-600" size={20} />
              <h2 className="text-lg font-bold text-gray-800">TAHSİLAT</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <MetricCard icon={<Package size={16} />} label="Açık Hesap" value={fmtTL(tahsilat.acikHesap)} color="red" />
              <MetricCard icon={<Target size={16} />} label="Tahsilat Hedef" value={fmtTL(tahsilat.tahsilatHedef)} color="orange" />
              <MetricCard icon={<TrendingUp size={16} />} label="Gerçekleşen" value={fmtTL(tahsilat.gerceklesenTahsilat)} color="green" />
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-200">
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Tahsilat Türleri</h3>
                <div className="space-y-1 text-[10px]">
                  {tahsilat.tahsilatTurleri.map((tur, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/60 rounded px-2 py-1">
                      <span className="font-medium truncate flex-1 mr-2">{tur.tur}</span>
                      <span className="text-indigo-700 font-semibold whitespace-nowrap">{fmtTL(tur.tutar)} ({fmtPct(tur.oran)})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========== SELLOUT BÖLGESİ ========== */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-3">
              <Award className="text-green-600" size={20} />
              <h2 className="text-lg font-bold text-gray-800">SELLOUT YILDIZLARI</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <SelloutStarCard title="Cari (2026)" data={sellout.yillikCariTop10.slice(0, 5)} nameKey="cariAdi" color="purple" />
              <SelloutStarCard title="Şube (2026)" data={sellout.yillikSubeTop10.slice(0, 5)} nameKey="subeAdi" color="blue" />
              <SelloutStarCard title="Süpervizör (2026)" data={sellout.yillikSupervizorler.slice(0, 5)} nameKey="supervizorAdi" color="indigo" />
              <SelloutStarCard title="Çetinler Merch (2026)" data={sellout.yillikCetinlerMerchTop10.slice(0, 5)} nameKey="merchAdi" color="pink" />
              <SelloutStarCard title="Bayi Merch (2026)" data={sellout.yillikBayiMerchTop10.slice(0, 5)} nameKey="merchAdi" color="teal" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
              <SelloutStarCard title={`Cari (${MONTHS_TR[ay - 1]})`} data={sellout.aylikCariTop10.slice(0, 5)} nameKey="cariAdi" color="purple" />
              <SelloutStarCard title={`Şube (${MONTHS_TR[ay - 1]})`} data={sellout.aylikSubeTop10.slice(0, 5)} nameKey="subeAdi" color="blue" />
              <SelloutStarCard title={`Süpervizör (${MONTHS_TR[ay - 1]})`} data={sellout.aylikSupervizorler.slice(0, 5)} nameKey="supervizorAdi" color="indigo" />
              <SelloutStarCard title={`Çetinler Merch (${MONTHS_TR[ay - 1]})`} data={sellout.aylikCetinlerMerchTop10.slice(0, 5)} nameKey="merchAdi" color="pink" />
              <SelloutStarCard title={`Bayi Merch (${MONTHS_TR[ay - 1]})`} data={sellout.aylikBayiMerchTop10.slice(0, 5)} nameKey="merchAdi" color="teal" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Yardımcı Componentler
function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
    green: 'from-green-50 to-green-100 border-green-200 text-green-700',
    red: 'from-red-50 to-red-100 border-red-200 text-red-700',
    orange: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color as keyof typeof colors]} rounded-lg p-3 border`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function SelloutStarCard({ title, data, nameKey, color }: {
  title: string;
  data: any[];
  nameKey: string;
  color: string;
}) {
  const colors = {
    purple: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700',
    pink: 'from-pink-50 to-pink-100 border-pink-200 text-pink-700',
    teal: 'from-teal-50 to-teal-100 border-teal-200 text-teal-700',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color as keyof typeof colors]} rounded-lg p-3 border`}>
      <h3 className="text-xs font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="space-y-1 text-[10px]">
        {data.map((item, i) => (
          <div key={i} className="flex justify-between items-center bg-white/60 rounded px-2 py-1">
            <span className="font-medium truncate flex-1 mr-2">{i + 1}. {item[nameKey]}</span>
            <span className="font-semibold whitespace-nowrap">{fmtN(item.adet)} ({fmtPct(item.pay)})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
