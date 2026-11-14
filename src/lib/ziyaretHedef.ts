// Aylık ziyaret hedefi (check-in yapılmış görev sayısı) — Süpervizör / Jr.
// v1 Ajanda istatistikleri ve v2 Ajanda aynı listeyi kullanır.
// Anahtar: profiles.full_name (birebir).

export const VISIT_TARGETS: Record<string, number> = {
  'Nagihan Erdönmez': 60,
  'Duygu Duman':      60,
  'Tuğba Ayata':      60,
  'Merve İnci':       60,
  'Burçin Acar':      60,
  'Atilla YILMAZ':    40,
  'Burak Alagöz':     60,
  'Gülcan Bayer':     60,
  'Songül Durukan':   60,
  'Sinem Bektaş':     60,
  'Pınar Güler':      60,
}

/** Kişinin aylık ziyaret hedefi (yoksa null) */
export function ziyaretHedefi(ad: string): number | null {
  return VISIT_TARGETS[ad] ?? null
}
