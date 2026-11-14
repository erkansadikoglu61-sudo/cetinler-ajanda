// Check-in konumu: tarayıcı konumu + adres (Nominatim / OpenStreetMap).
// v1 ajanda (useTasks) ve v2 ajanda aynı fonksiyonu kullanır.

export interface CheckinKonum {
  lat: number | null
  lng: number | null
  checkin_address: string | null
  hasLocation: boolean
  hasAddress: boolean
}

export async function checkinKonumu(): Promise<CheckinKonum> {
  let lat: number | null = null
  let lng: number | null = null
  let checkin_address: string | null = null
  let hasLocation = false
  let hasAddress = false

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000,
        enableHighAccuracy: true,
        maximumAge: 0,
      })
    )
    lat = pos.coords.latitude
    lng = pos.coords.longitude
    hasLocation = true

    // Koordinatı adrese çevir (Nominatim / OpenStreetMap)
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`
      )
      const geo = await geoRes.json()
      const a = (geo.address ?? {}) as Record<string, string>
      const parts = [
        a.road ?? a.pedestrian ?? a.path ?? a.highway,
        a.suburb ?? a.neighbourhood ?? a.quarter,
        [a.town ?? a.district ?? a.county, a.city ?? a.province].filter(Boolean).join('/'),
      ].filter(Boolean)
      checkin_address = parts.join(', ') || geo.display_name || null
      if (checkin_address) hasAddress = true
    } catch {
      // Adres çevrimi başarısız olursa koordinat yine de kaydedilir
    }
  } catch {
    // Konum alınamazsa null koordinatlarla devam et
  }

  return { lat, lng, checkin_address, hasLocation, hasAddress }
}
