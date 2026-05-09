// TSA security wait time estimates and live data

export type AirportSize = 'small' | 'medium' | 'large' | 'major'

const MAJOR_AIRPORTS = new Set(['ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO','EWR','CLT','PHX','IAH','MIA'])
const LARGE_AIRPORTS = new Set(['BOS','MSP','DTW','FLL','LGA','BWI','SLC','SAN','TPA','PDX','HNL','MDW','STL','OAK','RDU','AUS','BNA','SMF','MCI','PIT'])

export function classifyAirport(iataCode: string): AirportSize {
  const code = iataCode.toUpperCase().trim()
  if (MAJOR_AIRPORTS.has(code)) return 'major'
  if (LARGE_AIRPORTS.has(code)) return 'large'
  if (code.length === 3) return 'medium'
  return 'small'
}

function getTimeCategory(date: Date): 'early' | 'morning_rush' | 'midday' | 'afternoon' | 'evening' | 'late_night' {
  const hour = date.getHours()
  if (hour < 5) return 'late_night'
  if (hour < 7) return 'early'
  if (hour < 10) return 'morning_rush'
  if (hour < 14) return 'midday'
  if (hour < 18) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'late_night'
}

const SECURITY_WAIT_ESTIMATES: Record<AirportSize, Record<ReturnType<typeof getTimeCategory>, { standard: number; precheck: number }>> = {
  major: {
    late_night:    { standard: 5,  precheck: 3 },
    early:         { standard: 10, precheck: 5 },
    morning_rush:  { standard: 35, precheck: 10 },
    midday:        { standard: 20, precheck: 7 },
    afternoon:     { standard: 25, precheck: 8 },
    evening:       { standard: 20, precheck: 7 },
  },
  large: {
    late_night:    { standard: 5,  precheck: 3 },
    early:         { standard: 8,  precheck: 4 },
    morning_rush:  { standard: 25, precheck: 8 },
    midday:        { standard: 15, precheck: 6 },
    afternoon:     { standard: 18, precheck: 7 },
    evening:       { standard: 15, precheck: 6 },
  },
  medium: {
    late_night:    { standard: 3,  precheck: 2 },
    early:         { standard: 5,  precheck: 3 },
    morning_rush:  { standard: 15, precheck: 6 },
    midday:        { standard: 10, precheck: 4 },
    afternoon:     { standard: 12, precheck: 5 },
    evening:       { standard: 10, precheck: 4 },
  },
  small: {
    late_night:    { standard: 2,  precheck: 2 },
    early:         { standard: 3,  precheck: 3 },
    morning_rush:  { standard: 8,  precheck: 5 },
    midday:        { standard: 5,  precheck: 3 },
    afternoon:     { standard: 6,  precheck: 4 },
    evening:       { standard: 5,  precheck: 3 },
  },
}

const INTERNATIONAL_ADD_MINUTES = 5

export interface SecurityEstimate {
  waitMinutes: number
  processingMinutes: number
  totalMinutes: number
  airportSize: AirportSize
  timeCategory: string
  waitSource: 'tsa_api' | 'estimate'
}

// Fetch real-time TSA wait times from the TSA public API
export async function fetchTsaWaitTime(
  airportCode: string,
  hasTsaPrecheck: boolean
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://waittime.tsa.dhs.gov/api/airport/${airportCode.toUpperCase()}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()

    // API returns array of checkpoints — average across all open checkpoints
    const checkpoints: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data?.data ?? [])
    if (!checkpoints.length) return null

    const key = hasTsaPrecheck ? 'wait_mins_precheck' : 'wait_mins_standard'
    const fallbackKey = 'wait_mins'
    const times = checkpoints
      .map(c => Number(c[key] ?? c[fallbackKey] ?? c['waittime'] ?? NaN))
      .filter(n => !isNaN(n) && n >= 0)

    if (!times.length) return null
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  } catch {
    return null
  }
}

export function estimateSecurityTime(
  airportCode: string,
  departureTime: Date,
  hasTsaPrecheck: boolean,
  isInternational: boolean,
  checkingBags: boolean,
  tsaLiveWaitMinutes?: number | null
): SecurityEstimate {
  const airportSize = classifyAirport(airportCode)
  const timeCategory = getTimeCategory(departureTime)
  const staticEstimate = SECURITY_WAIT_ESTIMATES[airportSize][timeCategory]

  const waitSource = tsaLiveWaitMinutes != null ? 'tsa_api' : 'estimate'
  const waitMinutes = tsaLiveWaitMinutes != null
    ? tsaLiveWaitMinutes
    : (hasTsaPrecheck ? staticEstimate.precheck : staticEstimate.standard)

  const processingMinutes = hasTsaPrecheck ? 3 : 8
  const bagCheckMinutes = checkingBags ? 10 : 0
  const internationalAdd = isInternational ? INTERNATIONAL_ADD_MINUTES : 0
  const totalMinutes = waitMinutes + processingMinutes + bagCheckMinutes + internationalAdd

  return {
    waitMinutes,
    processingMinutes,
    totalMinutes,
    airportSize,
    timeCategory,
    waitSource,
  }
}
