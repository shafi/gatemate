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
    const routesMode = mode === 'uber' ? 'DRIVE' : mode === 'driving' ? 'DRIVE' : mode === 'transit' ? 'TRANSIT' : 'WALK'
    const body: Record<string, unknown> = {
      origin: { address: origin },
      destination: { address: destination },
      travelMode: routesMode,
    }
    // Traffic-aware routing only available for driving
    if (routesMode === 'DRIVE') {
      body.routingPreference = 'TRAFFIC_AWARE'
      body.departureTime = departureTime.toISOString()
    }

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()

    if (!data.routes?.[0]) throw new Error('No route')

    const route = data.routes[0]
    // duration = with traffic (when TRAFFIC_AWARE), staticDuration = without traffic
    const durationMinutes = Math.round(parseInt(route.duration ?? route.staticDuration) / 60)
    const staticMinutes = Math.round(parseInt(route.staticDuration) / 60)

    return {
      durationMinutes: staticMinutes,
      durationWithTrafficMinutes: durationMinutes,
      trafficDelay: Math.max(0, durationMinutes - staticMinutes),
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
