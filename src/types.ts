export type TransportMode = 'driving' | 'transit' | 'uber' | 'walking'

export interface FlightInfo {
  flightNumber: string
  airline: string
  departureDate: string
  scheduledDeparture: string
  isInternational: boolean
  airport: string
  terminal: string
  gate: string
}

export interface TravelInfo {
  origin: string
  transportMode: TransportMode
  hasTsaPrecheck: boolean
  checkingBags: boolean
  gateDistanceMinutes: number
}

export interface ApiKeys {
  googleMaps: string
  aviationStack: string
  anthropic: string
}

export interface TrafficResult {
  durationMinutes: number
  durationWithTrafficMinutes: number
  trafficDelay: number
  source: 'api' | 'estimate'
}

export interface FlightStatusResult {
  status: 'scheduled' | 'delayed' | 'cancelled' | 'boarding' | 'departed'
  delayMinutes: number
  actualDeparture: string | null
  gateCloseMinutes: number
  source: 'api' | 'estimate'
}

export interface TimelineBreakdown {
  label: string
  minutes: number
  icon: string
  detail?: string
}

export interface CalculationResult {
  leaveAt: Date
  arriveAirportAt: Date
  startSecurityAt: Date
  atGateAt: Date
  gateClosesAt: Date
  bufferMinutes: number
  breakdown: TimelineBreakdown[]
  flightStatus: FlightStatusResult
  traffic: TrafficResult
  warnings: string[]
}
