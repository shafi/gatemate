import type { FlightStatusResult } from '../types'

// Gate close times by airline and flight type (minutes before departure)
const GATE_CLOSE_TIMES: Record<string, { domestic: number; international: number }> = {
  'AA': { domestic: 15, international: 20 },
  'DL': { domestic: 15, international: 25 },
  'UA': { domestic: 15, international: 25 },
  'SW': { domestic: 10, international: 15 },
  'B6': { domestic: 15, international: 20 },
  'AS': { domestic: 15, international: 20 },
  'F9': { domestic: 15, international: 20 },
  'NK': { domestic: 15, international: 15 },
  'WN': { domestic: 10, international: 15 },
  // International carriers
  'BA': { domestic: 20, international: 30 },
  'LH': { domestic: 20, international: 30 },
  'AF': { domestic: 20, international: 30 },
  'EK': { domestic: 20, international: 40 },
  'QR': { domestic: 20, international: 40 },
  'SQ': { domestic: 20, international: 35 },
  'CX': { domestic: 20, international: 35 },
}

const DEFAULT_GATE_CLOSE = { domestic: 15, international: 25 }

function getAirlineCode(airline: string, flightNumber: string): string {
  if (flightNumber.length >= 2) {
    const code = flightNumber.replace(/[0-9]/g, '').trim().toUpperCase()
    if (code.length >= 2) return code.substring(0, 2)
  }
  // Try to match airline name
  const lower = airline.toLowerCase()
  if (lower.includes('american')) return 'AA'
  if (lower.includes('delta')) return 'DL'
  if (lower.includes('united')) return 'UA'
  if (lower.includes('southwest')) return 'SW'
  if (lower.includes('jetblue')) return 'B6'
  if (lower.includes('alaska')) return 'AS'
  if (lower.includes('frontier')) return 'F9'
  if (lower.includes('spirit')) return 'NK'
  if (lower.includes('british')) return 'BA'
  if (lower.includes('lufthansa')) return 'LH'
  if (lower.includes('air france')) return 'AF'
  if (lower.includes('emirates')) return 'EK'
  if (lower.includes('qatar')) return 'QR'
  if (lower.includes('singapore')) return 'SQ'
  if (lower.includes('cathay')) return 'CX'
  return ''
}

export async function fetchFlightStatus(
  flightNumber: string,
  airline: string,
  departureDate: string,
  isInternational: boolean,
  apiKey?: string
): Promise<FlightStatusResult> {
  const airlineCode = getAirlineCode(airline, flightNumber)
  const times = GATE_CLOSE_TIMES[airlineCode] ?? DEFAULT_GATE_CLOSE
  const gateCloseMinutes = isInternational ? times.international : times.domestic

  if (!apiKey || !flightNumber) {
    return {
      status: 'scheduled',
      delayMinutes: 0,
      actualDeparture: null,
      gateCloseMinutes,
      source: 'estimate',
    }
  }

  try {
    // AviationStack API
    const iataCode = flightNumber.replace(/\s/g, '').toUpperCase()
    const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${iataCode}&flight_date=${departureDate}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API error')
    const data = await res.json()

    if (data.data && data.data.length > 0) {
      const flight = data.data[0]
      const depDelay = flight.departure?.delay ?? 0
      const status = flight.flight_status ?? 'scheduled'

      return {
        status: status as FlightStatusResult['status'],
        delayMinutes: Math.max(0, depDelay),
        actualDeparture: flight.departure?.actual ?? null,
        gateCloseMinutes,
        source: 'api',
      }
    }
  } catch {
    // fall through to estimate
  }

  return {
    status: 'scheduled',
    delayMinutes: 0,
    actualDeparture: null,
    gateCloseMinutes,
    source: 'estimate',
  }
}
