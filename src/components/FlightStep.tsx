import { useState } from 'react'
import type { FlightInfo, ApiKeys } from '../types'
import { lookupFlight } from '../services/flightLookup'
import { lookupFlightWithClaude } from '../services/claudeLookup'

interface Props {
  flight: FlightInfo
  onChange: (f: FlightInfo) => void
  onNext: () => void
  keys?: ApiKeys
}

// Map airline IATA code / name to the dropdown option label
const AIRLINE_NAME_MAP: Record<string, string> = {
  'AA': 'American Airlines',
  'DL': 'Delta Air Lines',
  'UA': 'United Airlines',
  'WN': 'Southwest Airlines',
  'B6': 'JetBlue Airways',
  'AS': 'Alaska Airlines',
  'F9': 'Frontier Airlines',
  'NK': 'Spirit Airlines',
  'BA': 'British Airways',
  'LH': 'Lufthansa',
  'AF': 'Air France',
  'EK': 'Emirates',
  'QR': 'Qatar Airways',
  'SQ': 'Singapore Airlines',
  'CX': 'Cathay Pacific',
  'AC': 'Air Canada',
  'KL': 'KLM',
  'TK': 'Turkish Airlines',
}

const AIRLINES = [
  'American Airlines', 'Delta Air Lines', 'United Airlines', 'Southwest Airlines',
  'JetBlue Airways', 'Alaska Airlines', 'Frontier Airlines', 'Spirit Airlines',
  'British Airways', 'Lufthansa', 'Air France', 'Emirates', 'Qatar Airways',
  'Singapore Airlines', 'Cathay Pacific', 'Air Canada', 'KLM', 'Turkish Airlines',
  'Other',
]

function resolveAirlineName(iata: string, rawName: string): string {
  const fromMap = AIRLINE_NAME_MAP[iata.toUpperCase()]
  if (fromMap) return fromMap
  // Check if raw name matches any dropdown option (case-insensitive)
  const match = AIRLINES.find(a => a.toLowerCase() === rawName.toLowerCase())
  if (match) return match
  return rawName // Will fall into "Other" visually but keeps the real name
}

type LookupState = 'idle' | 'loading' | 'success' | 'error'

export default function FlightStep({ flight, onChange, onNext, keys }: Props) {
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const [lookupError, setLookupError] = useState('')
  const [lookupInfo, setLookupInfo] = useState<string>('')
  const [lookupSource, setLookupSource] = useState<'claude' | 'adsbdb' | null>(null)
  const [claudeConfidence, setClaudeConfidence] = useState<'high' | 'medium' | 'low' | null>(null)

  const set = (k: keyof FlightInfo, v: string | boolean) =>
    onChange({ ...flight, [k]: v })

  const handleLookup = async () => {
    if (!flight.flightNumber.trim()) return
    setLookupState('loading')
    setLookupError('')
    setLookupInfo('')
    setLookupSource(null)
    setClaudeConfidence(null)

    // Primary: Claude with web_search when API key is available — accurate current route + schedule
    if (keys?.anthropic) {
      try {
        const result = await lookupFlightWithClaude(flight.flightNumber, flight.departureDate, keys.anthropic)
        const airlineName = resolveAirlineName('', result.airline)
        onChange({
          ...flight,
          airline: airlineName || result.airline,
          airport: result.originIata,
          isInternational: result.isInternational,
          scheduledDeparture: result.scheduledDeparture || flight.scheduledDeparture,
          terminal: result.terminal || flight.terminal,
          gate: result.gate || flight.gate,
        })
        setLookupInfo(
          `${result.originCity} (${result.originIata}) → ${result.destinationCity} (${result.destinationIata})` +
          (result.isInternational ? ' · International' : ' · Domestic') +
          (result.note ? ` · ${result.note}` : '')
        )
        setLookupSource('claude')
        setClaudeConfidence(result.confidence)
        setLookupState('success')
        return
      } catch (e) {
        console.warn('Claude lookup failed, falling back to adsbdb:', e)
      }
    }

    // Fallback: adsbdb (no key needed, route only — no departure time)
    try {
      const result = await lookupFlight(flight.flightNumber)
      const airlineName = resolveAirlineName(result.airlineIata, result.airline)
      onChange({
        ...flight,
        airline: airlineName,
        airport: result.originIata,
        isInternational: result.isInternational,
      })
      setLookupInfo(
        `${result.originCity} (${result.originIata}) → ${result.destinationCity} (${result.destinationIata})` +
        (result.isInternational ? ' · International' : ' · Domestic')
      )
      setLookupSource('adsbdb')
      setLookupState('success')
    } catch {
      setLookupError('Flight not found — fill in details manually below')
      setLookupState('error')
    }
  }

  const canProceed = flight.flightNumber && flight.airline && flight.departureDate &&
    flight.scheduledDeparture && flight.airport

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">✈️</div>
        <h2 className="text-xl font-semibold text-white">Flight Details</h2>
        <p className="text-slate-400 text-sm mt-1">Enter your flight number to auto-fill details</p>
      </div>

      {/* Flight number + lookup */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Flight Number</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. AA123"
            value={flight.flightNumber}
            onChange={e => {
              set('flightNumber', e.target.value.toUpperCase())
              if (lookupState !== 'idle') {
                setLookupState('idle')
                setLookupInfo('')
                setLookupError('')
              }
            }}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleLookup}
            disabled={!flight.flightNumber.trim() || lookupState === 'loading'}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-1.5"
          >
            {lookupState === 'loading' ? (
              <><span className="animate-spin inline-block">⏳</span> Looking up…</>
            ) : (
              <><span>🔍</span> Look up</>
            )}
          </button>
        </div>

        {lookupState === 'success' && lookupInfo && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-emerald-400">
            <span>✓</span>
            <span>{lookupInfo}</span>
            <span className="text-slate-500">
              — via {lookupSource === 'claude' ? 'Claude AI' : 'adsbdb.com'}
            </span>
            {lookupSource === 'claude' && claudeConfidence && claudeConfidence !== 'high' && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                claudeConfidence === 'medium'
                  ? 'bg-yellow-900/50 text-yellow-400'
                  : 'bg-red-900/50 text-red-400'
              }`}>
                {claudeConfidence} confidence — verify times
              </span>
            )}
          </div>
        )}
        {lookupState === 'error' && lookupError && (
          <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
            <span>⚠️</span> {lookupError} — fill in manually below
          </div>
        )}
        {lookupState === 'idle' && (
          <p className="text-xs text-slate-500 mt-1">
            {keys?.anthropic
              ? 'Claude AI searches the web for current route, time & terminal'
              : 'Auto-fills airline, airport & flight type — no API key needed'}
          </p>
        )}
      </div>

      {/* Airline + date/time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Airline</label>
          <select
            value={AIRLINES.includes(flight.airline) ? flight.airline : flight.airline ? 'Other' : ''}
            onChange={e => set('airline', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select airline…</option>
            {AIRLINES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {flight.airline && !AIRLINES.includes(flight.airline) && (
            <p className="text-xs text-slate-400 mt-1">Detected: {flight.airline}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Departure Date</label>
          <input
            type="date"
            value={flight.departureDate}
            onChange={e => set('departureDate', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Scheduled Departure Time</label>
        <input
          type="time"
          value={flight.scheduledDeparture}
          onChange={e => set('scheduledDeparture', e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Airport (IATA)</label>
          <input
            type="text"
            placeholder="e.g. JFK"
            value={flight.airport}
            onChange={e => set('airport', e.target.value.toUpperCase())}
            maxLength={3}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Terminal</label>
          <input
            type="text"
            placeholder="e.g. B"
            value={flight.terminal}
            onChange={e => set('terminal', e.target.value.toUpperCase())}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Gate</label>
          <input
            type="text"
            placeholder="e.g. B22"
            value={flight.gate}
            onChange={e => set('gate', e.target.value.toUpperCase())}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Flight type — auto-set by lookup but overridable */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">
          Flight Type
          {lookupState === 'success' && (
            <span className="ml-2 text-xs text-emerald-400">auto-detected</span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '🏠 Domestic', value: false },
            { label: '🌍 International', value: true },
          ].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => set('isInternational', opt.value)}
              className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                flight.isInternational === opt.value
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
      >
        Next: Travel Details →
      </button>
    </div>
  )
}
