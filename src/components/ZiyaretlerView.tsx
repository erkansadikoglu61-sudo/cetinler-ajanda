'use client'

// Gerçekleşen Ziyaretler (liste + Leaflet harita, Excel/PDF) — v1 ajanda sayfasından
// ortak bileşene alındı; v1 (/app) ve v2 (/v2 Ajanda) aynı bileşeni kullanır.

import { useState, useEffect, useRef, useMemo } from 'react'
import { MapPin, Download, RefreshCw, X, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import clsx from 'clsx'
import { Profile, Task } from '@/lib/supabase'

// ─────────────────────────────────────────────────────
// ZİYARET HARİTASI (Leaflet — CDN üzerinden dinamik yüklenir)
// ─────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface MapMarker { lat: number; lng: number; kind: 'done' | 'plan'; task: Task }

function VisitsMap({ markers, profileMap, doneCount, planCount }: {
  markers: MapMarker[]
  profileMap: Map<string, Profile>
  doneCount: number
  planCount: number
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapObj = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function ensureLeaflet(): Promise<void> {
      // CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }
      // JS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Leaflet yüklenemedi'))
          document.head.appendChild(s)
        })
      }
    }

    async function initMap() {
      try {
        await ensureLeaflet()
        if (cancelled || !mapRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L

        if (mapObj.current) { mapObj.current.remove(); mapObj.current = null }
        const map = L.map(mapRef.current, { scrollWheelZoom: true }).setView([39.0, 35.0], 6)
        mapObj.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap katkıcıları',
          maxZoom: 19,
        }).addTo(map)

        const latlngs: [number, number][] = []
        markers.forEach(m => {
          const v = m.task
          const isDone = m.kind === 'done'
          const person = profileMap.get(v.pid)?.full_name || '—'
          const parts = (v.customer || '').split(' / ')
          const cari = parts[0]?.trim() || (v.customer || '—')
          const sube = parts.slice(1).join(' / ').trim()
          const tarih = isDone
            ? (v.checkin_ts ? format(new Date(v.checkin_ts), 'dd.MM.yyyy HH:mm') : '')
            : (v.date ? format(new Date(v.date + 'T00:00:00'), 'dd.MM.yyyy') + (v.time ? ' ' + v.time : '') : '')

          const marker = L.circleMarker([m.lat, m.lng], isDone
            ? { radius: 7, color: '#166534', fillColor: '#22c55e', fillOpacity: 0.9, weight: 2 }
            : { radius: 7, color: '#991b1b', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }
          ).addTo(map)

          const durum = isDone
            ? '<span style="color:#166534;font-weight:600">● Gerçekleşen</span>'
            : '<span style="color:#991b1b;font-weight:600">● Planlanan</span>'

          marker.bindPopup(
            `<div style="font-size:12px;line-height:1.55;min-width:180px">
              <div style="margin-bottom:3px">${durum}</div>
              <div style="font-weight:700;color:#111;margin-bottom:2px">${escapeHtml(cari)}</div>
              ${sube ? `<div><span style="color:#888">Şube:</span> ${escapeHtml(sube)}</div>` : ''}
              <div><span style="color:#888">Ziyaret eden:</span> <b>${escapeHtml(person)}</b></div>
              ${v.type ? `<div><span style="color:#888">Neden:</span> ${escapeHtml(v.type)}</div>` : ''}
              ${tarih ? `<div style="color:#888;margin-top:2px">${isDone ? '' : 'Plan: '}${tarih}</div>` : ''}
            </div>`
          )
          latlngs.push([m.lat, m.lng])
        })

        if (latlngs.length > 0) {
          map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 13 })
        }
        // Harita konteyneri sonradan boyutlandıysa yeniden hesapla
        setTimeout(() => { if (!cancelled && mapObj.current) mapObj.current.invalidateSize() }, 200)
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    initMap()
    return () => {
      cancelled = true
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers])

  return (
    <div className="relative flex-1 min-h-[500px]">
      <div ref={mapRef} className="absolute inset-0 z-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 text-xs text-gray-500">
          <RefreshCw size={14} className="animate-spin mr-2" /> Harita yükleniyor…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 text-xs text-red-500">
          Harita yüklenemedi (internet bağlantısını kontrol edin).
        </div>
      )}
      {status === 'ready' && (
        <>
          {/* Lejant */}
          <div className="absolute top-2 right-2 z-10 bg-white/95 border border-gray-200 rounded-lg px-3 py-2 text-[11px] shadow-sm space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 border border-green-800" />
              <span className="text-gray-700">Gerçekleşen ({doneCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 border border-red-800" />
              <span className="text-gray-700">Planlanan ({planCount})</span>
            </div>
          </div>
          <div className="absolute bottom-2 left-2 z-10 bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] text-gray-600 shadow-sm">
            Haritada {markers.length} nokta gösteriliyor
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// GERÇEKLEŞEN ZİYARETLER
// ─────────────────────────────────────────────────────
export function CompletedVisitsView({
  tasks, team, filterPid
}: {
  tasks: Task[]; team: Profile[]; filterPid: string | null;
}) {
  const profileMap = new Map(team.map(p => [p.id, p]))
  const [cariFilter, setCariFilter] = useState('')
  const [viewMode, setViewMode] = useState<'liste' | 'harita'>('liste')

  // Check-in yapılmış görevler
  const completedVisits = tasks
    .filter(t => t.checkin_ts && (!filterPid || t.pid === filterPid))
    .sort((a, b) => new Date(b.checkin_ts!).getTime() - new Date(a.checkin_ts!).getTime())

  const visibleVisits = cariFilter
    ? completedVisits.filter(t => (t.customer || '').toLowerCase().includes(cariFilter.toLowerCase()))
    : completedVisits

  // Görünen (filtrelenmiş) ziyaretlerin ziyaret nedenine göre özeti — filtre değişince dinamik
  const ozetSayilar = (() => {
    const m = new Map<string, number>()
    visibleVisits.forEach(t => m.set(t.type, (m.get(t.type) || 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  })()

  // ── Harita için: cari/şube → koordinat havuzu (tüm check-in'lerden) ──
  const customerCoords = useMemo(() => {
    const m = new Map<string, [number, number]>()
    tasks.forEach(t => {
      if (t.checkin_lat != null && t.checkin_lng != null && t.customer && !m.has(t.customer)) {
        m.set(t.customer, [t.checkin_lat, t.checkin_lng])
      }
    })
    return m
  }, [tasks])

  // Planlanan = check-in yapılmamış, müşterisi olan görevler (filtreye uyan)
  const plannedFiltered = useMemo(() => {
    return tasks.filter(t =>
      !t.checkin_ts && t.customer &&
      (!filterPid || t.pid === filterPid) &&
      (!cariFilter || (t.customer || '').toLowerCase().includes(cariFilter.toLowerCase()))
    )
  }, [tasks, filterPid, cariFilter])

  // Harita markerları: yeşil (gerçekleşen) + kırmızı (planlanan, cari konumundan)
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = []
    visibleVisits.forEach(t => {
      if (t.checkin_lat != null && t.checkin_lng != null) {
        out.push({ lat: t.checkin_lat, lng: t.checkin_lng, kind: 'done', task: t })
      }
    })
    plannedFiltered.forEach(t => {
      const c = customerCoords.get(t.customer!)
      if (c) out.push({ lat: c[0], lng: c[1], kind: 'plan', task: t })
    })
    return out
  }, [visibleVisits, plannedFiltered, customerCoords])

  const doneCount = mapMarkers.filter(m => m.kind === 'done').length
  const planCount = mapMarkers.filter(m => m.kind === 'plan').length

  const exportToExcel = async () => {
    const XLSX = await import('xlsx')
    const data = visibleVisits.map(t => ({
      'Cari / Şube': t.customer || '—',
      'Ziyaret Tarihi': t.checkin_ts ? format(new Date(t.checkin_ts), 'dd.MM.yyyy HH:mm') : '—',
      'Ziyaret Nedeni': t.type,
      'Check-in Adresi': t.checkin_address || '—',
      'Kişi': profileMap.get(t.pid)?.full_name || '—'
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gerçekleşen Ziyaretler')
    XLSX.writeFile(wb, `Gerceklesen_Ziyaretler_${format(new Date(), 'yyyyMMdd')}.xlsx`)
  }

  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({
      orientation: 'landscape'
    })

    // Türkçe karakterler için Times font kullan
    doc.setFont('times', 'normal')
    doc.setFontSize(16)
    doc.text('Gerceklesen Ziyaretler', 14, 15)

    autoTable(doc, {
      startY: 25,
      head: [['Cari / Sube', 'Ziyaret Tarihi', 'Ziyaret Nedeni', 'Check-in Adresi', 'Kisi']],
      body: visibleVisits.map(t => [
        t.customer || '-',
        t.checkin_ts ? format(new Date(t.checkin_ts), 'dd.MM.yyyy HH:mm') : '-',
        t.type,
        t.checkin_address || '-',
        profileMap.get(t.pid)?.full_name || '-'
      ]),
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [59, 130, 246],
        fontSize: 10,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 80 },
        4: { cellWidth: 35 }
      }
    })

    doc.save(`Gerceklesen_Ziyaretler_${format(new Date(), 'yyyyMMdd')}.pdf`)
  }

  if (completedVisits.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        Henüz gerçekleşen ziyaret bulunmuyor.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 flex-wrap">
        <input
          type="text"
          value={cariFilter}
          onChange={e => setCariFilter(e.target.value)}
          placeholder="Cari İsmi ara…"
          className="pl-2.5 pr-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 w-52"
        />
        {cariFilter && (
          <button onClick={() => setCariFilter('')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={12} />
          </button>
        )}
        {cariFilter && (
          <span className="text-[10px] text-gray-400">{visibleVisits.length} / {completedVisits.length} satır</span>
        )}

        {/* Liste / Harita geçişi */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode('liste')}
            className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-colors',
              viewMode === 'liste' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >
            Liste
          </button>
          <button
            onClick={() => setViewMode('harita')}
            className={clsx('flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors',
              viewMode === 'harita' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >
            <MapPin size={12} /> Harita Gör
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
          >
            <Download size={14} />
            PDF
          </button>
        </div>
      </div>

      {viewMode === 'harita' ? (
        <VisitsMap markers={mapMarkers} profileMap={profileMap} doneCount={doneCount} planCount={planCount} />
      ) : (
      <div className="flex-1 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr className="border-b bg-gray-100">
            <th colSpan={5} className="text-left px-4 py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                <span className="font-semibold text-gray-800">Özet:</span>
                {ozetSayilar.length === 0 ? (
                  <span className="text-gray-400">Kayıt yok</span>
                ) : (
                  <>
                    {ozetSayilar.map(([tip, adet]) => (
                      <span key={tip}>{tip}: <span className="font-semibold text-gray-800">{adet}</span></span>
                    ))}
                    <span className="pl-4 border-l border-gray-300 font-semibold text-gray-900">Toplam: {visibleVisits.length}</span>
                  </>
                )}
              </div>
            </th>
          </tr>
          <tr className="border-b">
            <th className="text-left px-4 py-3 font-medium text-gray-700">Ziyaret Edilen Cari / Şube</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">Ziyaret Tarihi</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">Ziyaret Nedeni</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">Check-in Adresi</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">Kişi</th>
          </tr>
        </thead>
        <tbody>
          {visibleVisits.map(t => {
            const profile = profileMap.get(t.pid)
            return (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {t.customer || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {t.checkin_ts ? format(new Date(t.checkin_ts), 'dd.MM.yyyy HH:mm', { locale: tr }) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {t.type}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                  {t.checkin_address || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {profile?.full_name || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      )}
    </div>
  )
}

