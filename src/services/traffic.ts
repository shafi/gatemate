import type { TrafficResult, TransportMode } from '../types'

// Average speeds by mode (mph) for fallback estimates
const FALLBACK_SPEEDS: Record<TransportMode, number> = {
  driving: 30,
  uber: 30,
  transit: 18,
  walking: 3,
}

// Extra buffer minutes by transport mode
export const TRANSPORT_BUFFERS: Record<TransportMode, number> = {
  driving: 5,   // parking, walking to terminal
  uber: 3,      // dropoff walk
  transit: 8,   // wait time + unpredictability
  walking: 0,
}

export async function fetchTravelTime(
  origin: string,
  destination: string,
  mode: TransportMode,
  departureTime: Date,
  apiKey?: string
): Promise<TrafficResult> {
  if (!apiKey || !origin) {
    // Rough estimate: assume 10 miles at average speed
    const speed = FALLBACK_SPEEDS[mode]
    const durationMinutes = Math.round((10 / speed) * 60)
    return {
      durationMinutes,
      durationWithTrafficMinutes: mode === 'driving' || mode === 'uber'
        ? Math.round(durationMinutes * 1.3)
        : durationMinutes,
      trafficDelay: mode === 'driving' || mode === 'uber'
        ? Math.round(durationMinutes * 0.3)
        : 0,
      source: 'estimate',
    }
  }

  try {
    const gmMode = mode === 'uber' ? 'driving' : mode
    const timestamp = Math.floor(departureTime.getTime() / 1000)
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${gmMode}&departure_time=${timestamp}&traffic_model=best_guess&key=${apiKey}`

    const res = await fetch(url)
    if (!res.ok) throw new Error('API error')
    const data = await res.json()

    if (data.status !== 'OK' || !data.routes?.[0]) throw new Error('No route')

    const leg = data.routes[0].legs[0]
    const durationMinutes = Math.round(leg.duration.value / 60)
    const durationWithTrafficMinutes = Math.round(
      (leg.duration_in_traffic?.value ?? leg.duration.value) / 60
    )

    return {
      durationMinutes,
      durationWithTrafficMinutes,
      trafficDelay: Math.max(0, durationWithTrafficMinutes - durationMinutes),
      source: 'api',
    }
  } catch {
    const speed = FALLBACK_SPEEDS[mode]
    const durationMinutes = Math.round((10 / speed) * 60)
    return {
      durationMinutes,
      durationWithTrafficMinutes: mode === 'driving' || mode === 'uber'
        ? Math.round(durationMinutes * 1.3)
        : durationMinutes,
      trafficDelay: mode === 'driving' || mode === 'uber'
        ? Math.round(durationMinutes * 0.3)
        : 0,
      source: 'estimate',
    }
  }
}
