import type { FlightInfo, TravelInfo, ApiKeys, CalculationResult, TimelineBreakdown } from '../types'
import { fetchFlightStatus } from './flightStatus'
import { fetchTravelTime, TRANSPORT_BUFFERS } from './traffic'
import { estimateSecurityTime, fetchTsaWaitTime } from './security'

const BUFFER_MINUTES = 2

const TRANSPORT_LABELS: Record<string, string> = {
  driving: 'Drive to airport',
  uber: 'Uber/Rideshare to airport',
  transit: 'Public transit to airport',
  walking: 'Walk to airport',
}

const TRANSPORT_ICONS: Record<string, string> = {
  driving: '🚗',
  uber: '🚕',
  transit: '🚇',
  walking: '🚶',
}

export async function calculate(
  flight: FlightInfo,
  travel: TravelInfo,
  keys: ApiKeys
): Promise<CalculationResult> {
  // Parse scheduled departure
  const [year, month, day] = flight.departureDate.split('-').map(Number)
  const [hours, minutes] = flight.scheduledDeparture.split(':').map(Number)
  const scheduledDep = new Date(year, month - 1, day, hours, minutes, 0)

  // Fetch flight status
  const flightStatus = await fetchFlightStatus(
    flight.flightNumber,
    flight.airline,
    flight.departureDate,
    flight.isInternational,
    keys.aviationStack
  )

  // Actual departure considering delay
  const actualDep = new Date(scheduledDep.getTime() + flightStatus.delayMinutes * 60_000)

  // Gate closes X minutes before actual departure
  const gateClosesAt = new Date(actualDep.getTime() - flightStatus.gateCloseMinutes * 60_000)

  // Target: arrive at gate 1-2 min before gate close (the buffer)
  const atGateAt = new Date(gateClosesAt.getTime() - BUFFER_MINUTES * 60_000)

  // Walk from security to gate
  const walkToGateMinutes = travel.gateDistanceMinutes
  const startSecurityAt = new Date(atGateAt.getTime() - walkToGateMinutes * 60_000)

  // Security time — try live TSA data first
  const tsaLiveWait = await fetchTsaWaitTime(flight.airport, travel.hasTsaPrecheck)
  const securityEst = estimateSecurityTime(
    flight.airport,
    scheduledDep,
    travel.hasTsaPrecheck,
    flight.isInternational,
    travel.checkingBags,
    tsaLiveWait
  )

  // Arrive airport time
  const arriveAirportAt = new Date(startSecurityAt.getTime() - securityEst.totalMinutes * 60_000)

  // Traffic / travel time
  const airportDestination = `${flight.airport} airport terminal`
  const traffic = await fetchTravelTime(
    travel.origin,
    airportDestination,
    travel.transportMode,
    new Date(), // use now for live traffic
    keys.googleMaps
  )

  const travelMinutes = traffic.durationWithTrafficMinutes + TRANSPORT_BUFFERS[travel.transportMode]
  const leaveAt = new Date(arriveAirportAt.getTime() - travelMinutes * 60_000)

  // Build breakdown
  const breakdown: TimelineBreakdown[] = []

  if (travel.checkingBags) {
    breakdown.push({
      label: 'Check bags at counter',
      minutes: 10,
      icon: '🧳',
      detail: 'Estimated wait at check-in',
    })
  }

  breakdown.push({
    label: 'Security screening',
    minutes: securityEst.waitMinutes + securityEst.processingMinutes,
    icon: travel.hasTsaPrecheck ? '⚡' : '🔍',
    detail: travel.hasTsaPrecheck
      ? `TSA PreCheck — ${securityEst.waitSource === 'tsa_api' ? 'live TSA data' : `${securityEst.timeCategory} at ${securityEst.airportSize} airport`}`
      : `Standard — ${securityEst.waitSource === 'tsa_api' ? 'live TSA data' : `${securityEst.timeCategory} at ${securityEst.airportSize} airport`}`,
  })

  if (flight.isInternational) {
    breakdown.push({
      label: 'International departure checks',
      minutes: 5,
      icon: '🛂',
      detail: 'Passport check, additional screening',
    })
  }

  breakdown.push({
    label: 'Walk to gate',
    minutes: walkToGateMinutes,
    icon: '🚶',
    detail: `Terminal to gate ${flight.gate || '—'}`,
  })

  breakdown.push({
    label: TRANSPORT_LABELS[travel.transportMode],
    minutes: travelMinutes,
    icon: TRANSPORT_ICONS[travel.transportMode],
    detail: traffic.source === 'api'
      ? `${traffic.durationMinutes} min + ${traffic.trafficDelay} min traffic delay`
      : 'Estimated — add Google Maps key for live traffic',
  })

  const warnings: string[] = []

  if (flightStatus.delayMinutes > 0) {
    warnings.push(`Flight delayed ${flightStatus.delayMinutes} min — gate time adjusted.`)
  }
  if (flightStatus.source === 'estimate') {
    warnings.push('Flight status estimated — add AviationStack key for live status.')
  }
  if (traffic.source === 'estimate') {
    warnings.push('Travel time estimated — add Google Maps key for live traffic.')
  }
  if (securityEst.waitSource === 'estimate') {
    warnings.push('Security wait estimated — TSA live data unavailable for this airport.')
  }
  if (flightStatus.status === 'cancelled') {
    warnings.push('⚠️ Flight appears CANCELLED — verify with airline.')
  }

  const bufferMinutes = Math.round((gateClosesAt.getTime() - atGateAt.getTime()) / 60_000)

  return {
    leaveAt,
    arriveAirportAt,
    startSecurityAt,
    atGateAt,
    gateClosesAt,
    bufferMinutes,
    breakdown: breakdown.reverse(),
    flightStatus,
    traffic,
    warnings,
  }
}
