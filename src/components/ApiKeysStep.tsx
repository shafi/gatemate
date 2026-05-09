import type { ApiKeys } from '../types'

interface Props {
  keys: ApiKeys
  onChange: (k: ApiKeys) => void
  onCalculate: () => void
  onBack: () => void
  loading: boolean
}

export default function ApiKeysStep({ keys, onChange, onCalculate, onBack, loading }: Props) {
  const set = (k: keyof ApiKeys, v: string) => onChange({ ...keys, [k]: v })

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🔑</div>
        <h2 className="text-xl font-semibold text-white">API Keys (Optional)</h2>
        <p className="text-slate-400 text-sm mt-1">Add keys for live traffic and flight status data</p>
      </div>

      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-sm text-amber-300">
        <strong>Optional but recommended.</strong> Without API keys the app uses smart estimates.
        Keys are stored only in your browser's local storage.
      </div>

      <div className="space-y-4">
        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🗺️</span>
            <span className="text-white font-medium text-sm">Google Maps Directions API</span>
            <span className="text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded">Live traffic</span>
          </div>
          <p className="text-slate-400 text-xs mb-2">Enables real-time traffic delays on your route</p>
          <input
            type="password"
            placeholder="AIza..."
            value={keys.googleMaps}
            onChange={e => set('googleMaps', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Get a key at console.cloud.google.com — Directions API must be enabled
          </p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✈️</span>
            <span className="text-white font-medium text-sm">AviationStack API</span>
            <span className="text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded">Flight status</span>
          </div>
          <p className="text-slate-400 text-xs mb-2">Live flight delays, cancellations, actual departure times</p>
          <input
            type="password"
            placeholder="Your AviationStack key..."
            value={keys.aviationStack}
            onChange={e => set('aviationStack', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Free tier at aviationstack.com — 100 requests/month
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onCalculate}
          disabled={loading}
          className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span> Calculating...
            </>
          ) : (
            '🧮 Calculate Departure Time'
          )}
        </button>
      </div>
    </div>
  )
}
