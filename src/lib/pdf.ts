import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Task, Profile } from './supabase'
import { VISIT_TYPES, MONTHS_TR } from './constants'
import { format } from 'date-fns'

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export function generateVisitReport(
  tasks: Task[],
  profiles: Profile[],
  year: number,
  month: number,
  filterName?: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  const visitTasks = tasks.filter(t => VISIT_TYPES.includes(t.type))
  const checkinTasks = visitTasks.filter(t => t.checkin_ts)
  const uniqueCustomers = new Set(visitTasks.map(t => t.customer).filter(Boolean)).size
  const ciRate = visitTasks.length > 0
    ? Math.round((checkinTasks.length / visitTasks.length) * 100)
    : 0

  const monthName = MONTHS_TR[month]
  const dateStr = format(new Date(), 'dd.MM.yyyy HH:mm')

  // Başlık
  doc.setFillColor(8, 51, 37)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Çetinler Saha Ajandası', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ziyaret Raporu — ${monthName} ${year}${filterName ? ' · ' + filterName : ''}`, 14, 20)
  doc.setTextColor(0, 0, 0)

  // Yeşil çizgi
  doc.setFillColor(29, 158, 117)
  doc.rect(0, 28, pageW, 1.5, 'F')

  // KPI kutucukları
  const kpis = [
    { label: 'Toplam Görev', value: String(tasks.length) },
    { label: 'Ziyaret',      value: String(visitTasks.length) },
    { label: 'Check-in',     value: String(checkinTasks.length) },
    { label: 'Unique Nokta', value: String(uniqueCustomers) },
    { label: 'CI Oranı',     value: `%${ciRate}` },
  ]

  const kpiW = (pageW - 28) / 5
  const kpiY = 34
  kpis.forEach((kpi, i) => {
    const x = 14 + i * (kpiW + 1)
    doc.setFillColor(29, 158, 117)
    doc.roundedRect(x, kpiY, kpiW, 14, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(kpi.value, x + kpiW / 2, kpiY + 8, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(kpi.label, x + kpiW / 2, kpiY + 12.5, { align: 'center' })
  })
  doc.setTextColor(0, 0, 0)

  // Detay tablo
  const visitRows = visitTasks
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => {
      const p = profileMap.get(t.pid)
      const ciText = t.checkin_ts
        ? `✓ ${format(new Date(t.checkin_ts), 'HH:mm')}`
        : '—'
      return [
        format(new Date(t.date), 'dd.MM.yyyy'),
        p?.full_name ?? '—',
        t.type,
        t.customer ?? '—',
        ciText,
      ]
    })

  autoTable(doc, {
    startY: kpiY + 20,
    head: [['Tarih', 'Kişi', 'Tip', 'Şube / Müşteri', 'Check-in']],
    body: visitRows,
    headStyles: { fillColor: [8, 51, 37], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: { 4: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  })

  // Şube özet tablo
  const customerMap = new Map<string, { visit: number; checkin: number }>()
  visitTasks.forEach(t => {
    const key = t.customer ?? 'Belirtilmemiş'
    const existing = customerMap.get(key) ?? { visit: 0, checkin: 0 }
    existing.visit++
    if (t.checkin_ts) existing.checkin++
    customerMap.set(key, existing)
  })

  const summaryRows = Array.from(customerMap.entries())
    .sort((a, b) => b[1].visit - a[1].visit)
    .map(([name, stats]) => [
      name,
      String(stats.visit),
      String(stats.checkin),
      `%${Math.round((stats.checkin / stats.visit) * 100)}`,
    ])

  const lastTableY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  if (summaryRows.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Şube Bazlı Özet', 14, lastTableY + 8)

    autoTable(doc, {
      startY: lastTableY + 11,
      head: [['Şube / Müşteri', 'Ziyaret', 'Check-in', 'Oran']],
      body: summaryRows,
      headStyles: { fillColor: [8, 51, 37], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Çetinler Saha Ajandası · Sayfa ${i}/${pageCount} · ${dateStr}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    )
  }

  doc.save(`cetinler-rapor-${year}-${String(month + 1).padStart(2, '0')}.pdf`)
}
