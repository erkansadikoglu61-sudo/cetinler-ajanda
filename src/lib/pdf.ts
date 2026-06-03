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

// ─── Adet Prim Tablosu PDF ────────────────────────────────────
interface AdetPrimRow {
  stokKodu:      string
  bayiMerch:     number | null
  kosulluDestek: number | null
}

export function generateAdetPrimPdf(rows: AdetPrimRow[], yil: number, ay: number) {
  const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                 'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // ── Başlık ──────────────────────────────────────────────────
  doc.setFillColor(30, 30, 40)
  doc.rect(0, 0, pageW, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Adet Prim Tablosu', 14, 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${AYLAR[ay - 1]} ${yil}  ·  ${rows.length} ürün`, 14, 16)
  doc.setTextColor(0)

  // ── Tablo ───────────────────────────────────────────────────
  autoTable(doc, {
    startY: 24,
    head: [['#', 'Stok Kodu', 'Bayi Merch (₺)']],
    body: rows.map((r, i) => [
      i + 1,
      r.stokKodu,
      r.bayiMerch != null ? r.bayiMerch.toLocaleString('tr-TR') + ' ₺' : '—',
    ]),
    headStyles: {
      fillColor: [40, 40, 55],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 60, fontStyle: 'bold' },
      2: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      doc.setFontSize(7)
      doc.setTextColor(160)
      const total = doc.getNumberOfPages()
      const cur   = (doc as jsPDF & { internal: { getCurrentPageInfo: () => { pageNumber: number } } })
        .internal.getCurrentPageInfo().pageNumber
      doc.text(
        `Sayfa ${cur} / ${total}   |   ${new Date().toLocaleDateString('tr-TR')}`,
        pageW / 2, pageH - 5, { align: 'center' }
      )
      doc.setTextColor(0)
    },
  })

  doc.save(`adet-prim-tablosu-${yil}-${String(ay).padStart(2, '0')}.pdf`)
}

// ─── Bayi Merch Prim Hakedişleri PDF ──────────────────────────
interface BayiMerchRow {
  supervizor: string
  cariAdi:    string
  subeAdi:    string
  bayiMerch:  string
  primHakdis: number
  satisAdet:  number
}

export function generateBayiMerchPdf(
  rows:       BayiMerchRow[],
  yil:        number,
  ay:         number,
  baslik?:    string,   // ek başlık satırı (filtre bilgisi vb.)
) {
  const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                 'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const toplamPrim = rows.reduce((s, r) => s + r.primHakdis, 0)
  const toplamAdet = rows.reduce((s, r) => s + r.satisAdet, 0)

  const fmtPrim = (n: number) =>
    n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'

  // ── Başlık ──────────────────────────────────────────────────
  doc.setFillColor(30, 30, 40)
  doc.rect(0, 0, pageW, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Bayi Merch Prim Hakedışleri', 14, 10)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${AYLAR[ay - 1]} ${yil}`, 14, 17)

  // Özet kutusu (sağ üst)
  doc.setFontSize(8)
  doc.text(`${rows.length} satır`, pageW - 14, 10, { align: 'right' })
  doc.text(`Toplam Adet: ${toplamAdet}`, pageW - 14, 15, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Toplam Prim: ${fmtPrim(toplamPrim)}`, pageW - 14, 20, { align: 'right' })

  doc.setTextColor(0, 0, 0)

  let startY = 26
  if (baslik) {
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(baslik, 14, startY)
    startY += 5
    doc.setTextColor(0)
  }

  // ── Tablo ───────────────────────────────────────────────────
  autoTable(doc, {
    startY,
    head: [['#', 'Süpervizör', 'Cari Adı', 'Şube Adı', 'Bayi Merch', 'Satış Adet', 'Prim Hakedışi']],
    body: rows.map((r, i) => [
      i + 1,
      r.supervizor,
      r.cariAdi,
      r.subeAdi,
      r.bayiMerch,
      r.satisAdet,
      fmtPrim(r.primHakdis),
    ]),
    foot: [[
      '',
      '',
      `Toplam: ${rows.length} satır`,
      '',
      '',
      toplamAdet,
      fmtPrim(toplamPrim),
    ]],
    headStyles: {
      fillColor: [40, 40, 55],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    footStyles: {
      fillColor: [40, 40, 55],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      4: { cellWidth: 35 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [20, 120, 20] },
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      // Alt footer: sayfa numarası + tarih
      doc.setFontSize(7)
      doc.setTextColor(160)
      const pageNum = (doc as jsPDF & { internal: { getCurrentPageInfo: () => { pageNumber: number } } })
        .internal.getCurrentPageInfo().pageNumber
      const total = doc.getNumberOfPages()
      doc.text(
        `Sayfa ${pageNum} / ${total}   |   ${new Date().toLocaleDateString('tr-TR')}`,
        pageW / 2, pageH - 5, { align: 'center' }
      )
      doc.setTextColor(0)
    },
  })

  doc.save(`bayi-merch-prim-${yil}-${String(ay).padStart(2, '0')}.pdf`)
}
