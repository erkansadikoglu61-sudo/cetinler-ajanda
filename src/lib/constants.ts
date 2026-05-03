export const TASK_TYPES = [
  'Bayi Ziyareti', 'Şube Ziyareti', 'Toplantı',
  'Eğitim', 'Teşhir Çalışması', 'Sipariş&Tahsilat', 'Diğer'
] as const

export type TaskType = typeof TASK_TYPES[number]

export const VISIT_TYPES: string[] = [...TASK_TYPES]

export const MONTHS_TR = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
]

export const DAYS_SHORT = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Yönetici',
  bsy:   'Bölge Satış Yöneticisi',
  sup:   'Süpervizör',
  jr:    'Jr. Süpervizör',
}

export const PERSON_COLORS = [
  '#085041','#1D6B4E','#993C1D','#3B6D11','#854F0B',
  '#A32D2D','#534AB7','#185FA5','#6B3FA0','#0C447C',
  '#533AB7','#7F77DD','#D85A30','#378ADD','#059669',
  '#D4537E','#BA7517','#E24B4A','#639922',
]
