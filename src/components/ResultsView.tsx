import type { CalculationResult, FlightInfo, TravelInfo } from '../types'

interface Props {
  result: CalculationResult
  flight: FlightInfo
  travel: TravelInfo
  onReset: () => void
}

function fmt(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function urgencyColor(leaveAt: Date): string {
  const minsUntilLeave = (leaveAt.getTime() - Date.now()) / 60_000
  if (minsUntilLeave < 0) return 'text-red-400'
  if (minsUntilLeave < 30) return 'text-amber-400'
  return 'text-emerald-400'
}

function urgencyBg(leaveAt: Date): string {
  const minsUntilLeave = (leaveAt.getTime() - Date.now()) / 60_000
  if (minsUntilLeave < 0) return 'bg-red-950/50 border-red-700'
  if (minsUntilLeave < 30) return 'bg-amber-950/50 border-amber-700'
  return 'bg-emerald-950/50 border-emerald-700'
}

function minsUntilLabel(leaveAt: Date): string {
  const mins = Math.round((leaveAt.getTime() - Date.now()) / 60_000)
  if (mins < 0) return `${Math.abs(mins)} min ago — you should have left already!`
  if (mins === 0) return 'Leave RIGHT NOW'
  if (mins < 60) return `Leave in ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `Leave in ${h}h${m > 0 ? ` ${m}m` : ''}`
}

export default function ResultsView({ result, flight, travel, onReset }: Props) {
  const totalTravelMins = Math.round(
    (result.gateClosesAt.getTime() - result.leaveAt.getTime()) / 60_000
  )

  const timeline = [
    { time: result.leaveAt, label: 'Leave now', detail: `From ${travel.origin || 'your location'}`, icon: TRANSPORT_ICONS[travel.transportMode], highlight: true },
    { time: result.arriveAirportAt, label: 'Arrive at airport', detail: `${flight.airport} — ${flight.isInternational ? 'International' : 'Domestic'}`, icon: '🏢', highlight: false },
    { time: result.startSecurityAt, label: 'Start security', detail: travel.hasTsaPrecheck ? '⚡ TSA PreCheck lane' : '🔍 Standard screening', icon: '🔐', highlight: false },
    { time: result.atGateAt, label: 'At your gate', detail: `Gate ${flight.gate || '—'} · ${result.bufferMinutes} min before close`, icon: '🚪', highlight: false },
    { time: result.gateClosesAt, label: 'Gate closes', detail: `${flight.airline} closes boarding`, icon: '🔒', highlight: false },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="text-sm text-slate-400 mb-1">{flight.airline} {flight.flightNumber}</div>
        <div className="text-slate-300">
          {flight.airport} · {new Date(flight.departureDate + 'T' + flight.scheduledDeparture).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {flight.scheduledDeparture}
        </div>
      </div>

      {/* Main departure card */}
      <div className={`rounded-2xl border p-5 text-center ${urgencyBg(result.leaveAt)}`}>
        <div className="text-slate-400 text-sm mb-1">Leave at</div>
        <div className={`text-5xl font-bold mb-1 ${urgencyColor(result.leaveAt)}`}>
          {fmt(result.leaveAt)}
        </div>
        <div className={`text-lg font-medium ${urgencyColor(result.leaveAt)}`}>
          {minsUntilLabel(result.leaveAt)}
        </div>
        <div className="text-slate-500 text-xs mt-2">
          Total time needed: {fmtDuration(totalTravelMins)}
        </div>
      </div>

      {/* Flight delay badge */}
      {result.flightStatus.delayMinutes > 0 && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2 text-sm text-amber-300 flex items-center gap-2">
          ⚠️ Flight delayed {result.flightStatus.delayMinutes} min — departure adjusted to {fmt(new Date(
            new Date(flight.departureDate + 'T' + flight.scheduledDeparture).getTime() +
            result.flightStatus.delayMinutes * 60_000
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-1">
        {timeline.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
              item.highlight ? 'bg-blue-900/40 border border-blue-700/50' : 'bg-slate-800/50'
            }`}
          >
            <div className="text-xl w-8 text-center">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm ${item.highlight ? 'text-blue-300' : 'text-white'}`}>{item.label}</div>
              <div className="text-slate-500 text-xs truncate">{item.detail}</div>
            </div>
            <div className={`text-lg font-semibold tabular-nums ${item.highlight ? 'text-blue-300' : 'text-slate-200'}`}>
              {fmt(item.time)}
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div>
        <div className="text-sm text-slate-400 mb-2">Time breakdown</div>
        <div className="space-y-1">
          {result.breakdown.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
              <span className="text-base w-6 text-center">{item.icon}</span>
              <span className="flex-1 text-sm text-slate-300">{item.label}</span>
              {item.detail && <span className="text-xs text-slate-500 hidden sm:block max-w-48 text-right truncate">{item.detail}</span>}
              <span className="text-sm font-medium text-slate-200 tabular-nums ml-2">{item.minutes}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <div key={i} className="text-xs text-slate-500 flex items-start gap-1.5 px-1">
              <span className="mt-0.5">ℹ️</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all text-sm"
        >
          ← New Calculation
        </button>
        <button
          onClick={() => {
            const text = `Leave at ${fmt(result.leaveAt)} for ${flight.airline} ${flight.flightNumber} departing ${flight.scheduledDeparture} from ${flight.airport}`
            navigator.clipboard?.writeText(text)
          }}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all text-sm"
        >
          📋 Copy
        </button>
      </div>
    </div>
  )
}

const TRANSPORT_ICONS: Record<string, string> = {
  driving: '🚗',
  uber: '🚕',
  transit: '🚇',
  walking: '🚶',
}
