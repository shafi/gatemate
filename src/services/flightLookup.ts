export interface FlightLookupResult {
  airline: string
  airlineIata: string
  originIata: string
  originName: string
  originCity: string
  destinationIata: string
  destinationName: string
  destinationCity: string
  isInternational: boolean
  scheduledDeparture?: string
  terminal?: string
  gate?: string
}

interface FlightScraperResponse {
  success: boolean
  data?: {
    flightNumber: string
    airline: string
    origin: {
      iata: string
      name: string
      city: string
    }
    destination: {
      iata: string
      name: string
      city: string
    }
    scheduledDeparture: string
    terminal?: string
    gate?: string
  }
  error?: string
}

function normalizeCallsign(flightNumber: string): string {
  return flightNumber.replace(/\s+/g, '').toUpperCase()
}

function extractAirlineIata(callsign: string): string {
  const match = callsign.match(/^[A-Z]{2,3}/)
  return match?.[0].slice(0, 2) ?? ''
}

function toTimeInputValue(raw: string): string | undefined {
  if (!raw) return undefined

  const match = raw.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)
  if (!match) return undefined

  const [, h, m, meridiemRaw] = match
  const meridiem = meridiemRaw.toUpperCase()
  let hours = Number(h)
  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  return `${String(hours).padStart(2, '0')}:${m}`
}

const SCRAPER_BASE_URL = import.meta.env.VITE_FLIGHT_SCRAPER_URL ?? '/api'

export async function lookupFlight(flightNumber: string): Promise<FlightLookupResult> {
  const callsign = normalizeCallsign(flightNumber)
  if (!callsign) throw new Error('Enter a flight number first')

  const url = `${SCRAPER_BASE_URL}/flight/${encodeURIComponent(callsign)}`
  const res = await fetch(url)

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Flight ${callsign} not found`)
    throw new Error(`Lookup failed (${res.status})`)
  }

  const data: FlightScraperResponse = await res.json()
  if (!data.success || !data.data) {
    throw new Error(data.error || `No route data found for ${callsign}`)
  }

  const route = data.data

  return {
    airline: route.airline,
    airlineIata: extractAirlineIata(callsign),
    originIata: route.origin.iata,
    originName: route.origin.name,
    originCity: route.origin.city,
    destinationIata: route.destination.iata,
    destinationName: route.destination.name,
    destinationCity: route.destination.city,
    isInternational: false,
    scheduledDeparture: toTimeInputValue(route.scheduledDeparture),
    terminal: route.terminal,
    gate: route.gate,
  }
}
