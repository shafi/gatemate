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
}

interface AdsbDbResponse {
  response: {
    flightroute?: {
      callsign_iata: string
      airline: {
        name: string
        iata: string
      }
      origin: {
        iata_code: string
        name: string
        municipality: string
        country_iso_name: string
      }
      destination: {
        iata_code: string
        name: string
        municipality: string
        country_iso_name: string
      }
    }
  }
}

// Normalize flight number to IATA callsign format expected by adsbdb
// e.g. "AA 123" → "AA123", "aa123" → "AA123"
function normalizeCallsign(flightNumber: string): string {
  return flightNumber.replace(/\s+/g, '').toUpperCase()
}

export async function lookupFlight(flightNumber: string): Promise<FlightLookupResult> {
  const callsign = normalizeCallsign(flightNumber)
  if (!callsign) throw new Error('Enter a flight number first')

  const url = `https://api.adsbdb.com/v0/callsign/${callsign}`
  const res = await fetch(url)

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Flight ${callsign} not found`)
    throw new Error(`Lookup failed (${res.status})`)
  }

  const data: AdsbDbResponse = await res.json()
  const route = data.response?.flightroute

  if (!route) {
    throw new Error(`No route data found for ${callsign}`)
  }

  const isInternational = route.origin.country_iso_name !== route.destination.country_iso_name

  return {
    airline: route.airline.name,
    airlineIata: route.airline.iata,
    originIata: route.origin.iata_code,
    originName: route.origin.name,
    originCity: route.origin.municipality,
    destinationIata: route.destination.iata_code,
    destinationName: route.destination.name,
    destinationCity: route.destination.municipality,
    isInternational,
  }
}
