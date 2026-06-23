'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface AdminDashboardViewProps {
  // Gerekli props'lar buraya eklenecek
}

export function AdminDashboardView({}: AdminDashboardViewProps) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <button
          onClick={() => {
            setLoading(true)
            // Yenileme fonksiyonu buraya eklenecek
            setTimeout(() => setLoading(false), 500)
          }}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[1600px] mx-auto">
          {/* Dashboard içeriği buraya eklenecek */}
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Dashboard hazırlanıyor...</p>
            <p className="text-sm text-gray-400 mt-2">İsteklerinizi bekliyorum.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
