import type { TravelInfo, TransportMode } from '../types'

interface Props {
  travel: TravelInfo
  onChange: (t: TravelInfo) => void
  onNext: () => void
  onBack: () => void
  loading?: boolean
}

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: string; desc: string }[] = [
  { mode: 'driving',  label: 'Drive',        icon: '🚗', desc: 'Own car + parking' },
  { mode: 'uber',     label: 'Uber / Lyft',  icon: '🚕', desc: 'Rideshare dropoff' },
  { mode: 'transit',  label: 'Public Transit', icon: '🚇', desc: 'Bus, train, subway' },
  { mode: 'walking',  label: 'Walking',      icon: '🚶', desc: 'On-site or nearby' },
]

const GATE_DISTANCE_OPTIONS = [
  { value: 5,  label: 'Short', desc: '< 5 min walk' },
  { value: 10, label: 'Medium', desc: '5–10 min walk' },
  { value: 15, label: 'Far',  desc: '10–15 min walk' },
  { value: 20, label: 'Very far', desc: '15–20 min (large terminal)' },
]

export default function TravelStep({ travel, onChange, onNext, onBack, loading }: Props) {
  const set = <K extends keyof TravelInfo>(k: K, v: TravelInfo[K]) =>
    onChange({ ...travel, [k]: v })

  const canProceed = travel.origin && travel.transportMode

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🗺️</div>
        <h2 className="text-xl font-semibold text-white">Travel & Security</h2>
        <p className="text-slate-400 text-sm mt-1">How are you getting to the airport?</p>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Your current location</label>
        <input
          type="text"
          placeholder="e.g. 123 Main St, New York, NY or neighborhood name"
          value={travel.origin}
          onChange={e => set('origin', e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1">Used with Google Maps for live traffic (add API key in settings)</p>
      </div>

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

      <div>
        <label className="block text-sm text-slate-400 mb-2">Gate distance from security</label>
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

      <div className="space-y-3">
        <label className="block text-sm text-slate-400">Security & bags</label>

        <label className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-650 transition-colors border border-slate-600">
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

        <label className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-650 transition-colors border border-slate-600">
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
