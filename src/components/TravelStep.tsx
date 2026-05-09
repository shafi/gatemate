import { useState, useEffect } from 'react'
import type { TravelInfo, TransportMode, FlightInfo, ApiKeys } from '../types'
import { lookupGateDistance, estimateGateDistance } from '../services/gateDistance'

interface Props {
  travel: TravelInfo
  onChange: (t: TravelInfo) => void
  onNext: () => void
  onBack: () => void
  loading?: boolean
  flight?: FlightInfo
  keys?: ApiKeys
}

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: string; desc: string }[] = [
  { mode: 'driving',  label: 'Drive',          icon: '🚗', desc: 'Own car + parking' },
  { mode: 'uber',     label: 'Uber / Lyft',    icon: '🚕', desc: 'Rideshare dropoff' },
  { mode: 'transit',  label: 'Public Transit', icon: '🚇', desc: 'Bus, train, subway' },
  { mode: 'walking',  label: 'Walking',        icon: '🚶', desc: 'On-site or nearby' },
]

const GATE_DISTANCE_OPTIONS = [
  { value: 5,  label: 'Short',    desc: '< 5 min walk' },
  { value: 10, label: 'Medium',   desc: '5–10 min walk' },
  { value: 15, label: 'Far',      desc: '10–15 min walk' },
  { value: 20, label: 'Very far', desc: '15–20 min (large terminal)' },
]

type LocateState = 'idle' | 'loading' | 'done' | 'error'
type GateState = 'idle' | 'loading' | 'done' | 'error'

function buildNominatimAddress(addr: Record<string, string>): string {
  const parts = [
    addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : addr.road,
    addr.neighbourhood || addr.suburb,
    addr.city || addr.town || addr.village,
    addr.state,
  ].filter(Boolean)
  return parts.join(', ')
}

export default function TravelStep({ travel, onChange, onNext, onBack, loading, flight, keys }: Props) {
  const [locateState, setLocateState] = useState<LocateState>('idle')
  const [locateError, setLocateError] = useState('')
  const [gateState, setGateState] = useState<GateState>('idle')
  const [gateDescription, setGateDescription] = useState('')
  const [gateSource, setGateSource] = useState<'claude' | 'estimate' | null>(null)

  const set = <K extends keyof TravelInfo>(k: K, v: TravelInfo[K]) =>
    onChange({ ...travel, [k]: v })

  // Auto-lookup gate distance when airport info is available
  useEffect(() => {
    if (!flight?.airport) return
    if (gateState === 'loading' || gateState === 'done') return
    fetchGateDistance()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.airport, flight?.terminal, flight?.gate])

  const fetchGateDistance = async () => {
    if (!flight?.airport) return
    setGateState('loading')
    setGateDescription('')

    if (keys?.anthropic) {
      try {
        const result = await lookupGateDistance(
          flight.airport,
          flight.terminal,
          flight.gate,
          keys.anthropic
        )
        set('gateDistanceMinutes', result.minutes)
        setGateDescription(result.description)
        setGateSource('claude')
        setGateState('done')
        return
      } catch {
        // fall through to estimate
      }
    }

    const result = estimateGateDistance(flight.airport)
    set('gateDistanceMinutes', result.minutes)
    setGateDescription(result.description)
    setGateSource('estimate')
    setGateState('done')
  }

  const handleLocate = async () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation not supported by your browser')
      setLocateState('error')
      return
    }
    setLocateState('loading')
    setLocateError('')

    // Step 1: get GPS coords
    let latitude: number, longitude: number
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 15_000,
          maximumAge: 60_000,
          enableHighAccuracy: false,
        })
      )
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch (e) {
      const code = (e as GeolocationPositionError).code
      const msg = code === 1 ? 'Location access denied — allow location in browser settings'
                : code === 2 ? 'Position unavailable — try again'
                : 'Location request timed out — try again'
      setLocateError(msg)
      setLocateState('error')
      return
    }

    // Step 2: reverse geocode with Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=16`,
        { headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'GateMate/1.0' } }
      )
      if (!res.ok) throw new Error(`Nominatim error ${res.status}`)
      const data = await res.json()
      const addr = data.address as Record<string, string> | undefined
      const address = addr ? buildNominatimAddress(addr) : ''
      // Fall back through progressively simpler representations
      set('origin', address || data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
      setLocateState('done')
    } catch {
      // Geocoding failed but we have coordinates — use them
      set('origin', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
      setLocateState('done')
    }
  }

  const canProceed = travel.origin && travel.transportMode

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🗺️</div>
        <h2 className="text-xl font-semibold text-white">Travel & Security</h2>
        <p className="text-slate-400 text-sm mt-1">How are you getting to the airport?</p>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Your current location</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. 123 Main St, New York, NY"
            value={travel.origin}
            onChange={e => {
              set('origin', e.target.value)
              if (locateState === 'done') setLocateState('idle')
            }}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleLocate}
            disabled={locateState === 'loading'}
            title="Use my current location"
            className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600 rounded-lg text-slate-300 text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {locateState === 'loading'
              ? <span className="animate-spin">⏳</span>
              : '📍'}
            {locateState !== 'loading' && <span className="hidden sm:inline">Locate me</span>}
          </button>
        </div>
        {locateState === 'done' && (
          <p className="text-xs text-emerald-400 mt-1">✓ Location detected via GPS</p>
        )}
        {locateState === 'error' && (
          <p className="text-xs text-red-400 mt-1">⚠️ {locateError} — enter manually above</p>
        )}
        {locateState === 'idle' && (
          <p className="text-xs text-slate-500 mt-1">Used with Google Maps for live traffic (add API key in settings)</p>
        )}
      </div>

      {/* Transport */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">Transport to airport</label>
        <div className="grid grid-cols-2 gap-3">
          {TRANSPORT_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              onClick={() => set('transportMode', opt.mode)}
              className={`py-3 px-4 rounded-lg border text-left transition-all ${
                travel.transportMode === opt.mode
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="text-xl mb-0.5">{opt.icon}</div>
              <div className="font-medium text-sm">{opt.label}</div>
              <div className={`text-xs ${travel.transportMode === opt.mode ? 'text-blue-200' : 'text-slate-500'}`}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Gate distance */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">Gate distance from security</label>
          {gateState === 'loading' && (
            <span className="text-xs text-slate-400 animate-pulse">Looking up gate distance…</span>
          )}
          {gateState === 'done' && (
            <span className={`text-xs ${gateSource === 'claude' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {gateSource === 'claude' ? '✓ via Claude AI' : '~ estimated'}
            </span>
          )}
          {flight?.airport && gateState !== 'loading' && (
            <button
              onClick={fetchGateDistance}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              ↺ Re-lookup
            </button>
          )}
        </div>

        {gateState === 'done' && gateDescription && (
          <p className="text-xs text-slate-400 mb-2">{gateDescription}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {GATE_DISTANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('gateDistanceMinutes', opt.value)}
              className={`py-2.5 px-3 rounded-lg border text-left text-sm transition-all ${
                travel.gateDistanceMinutes === opt.value
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span className={`ml-2 text-xs ${travel.gateDistanceMinutes === opt.value ? 'text-blue-200' : 'text-slate-500'}`}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Security & bags */}
      <div className="space-y-3">
        <label className="block text-sm text-slate-400">Security & bags</label>

        <label className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors border border-slate-600">
          <input
            type="checkbox"
            checked={travel.hasTsaPrecheck}
            onChange={e => set('hasTsaPrecheck', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <div>
            <div className="text-white text-sm font-medium">⚡ TSA PreCheck / Global Entry</div>
            <div className="text-slate-400 text-xs">Faster dedicated security lane</div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors border border-slate-600">
          <input
            type="checkbox"
            checked={travel.checkingBags}
            onChange={e => set('checkingBags', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <div>
            <div className="text-white text-sm font-medium">🧳 Checking bags</div>
            <div className="text-slate-400 text-xs">Adds ~10 min for check-in counter</div>
          </div>
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed || loading}
          className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
        >
          {loading
            ? <><span className="animate-spin">⏳</span> Calculating…</>
            : '🧮 Calculate Departure Time'
          }
        </button>
      </div>
    </div>
  )
}
