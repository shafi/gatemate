import { useState, useEffect } from 'react'
import type { FlightInfo, TravelInfo, ApiKeys, CalculationResult } from './types'
import { calculate } from './services/calculator'
import StepIndicator from './components/StepIndicator'
import FlightStep from './components/FlightStep'
import TravelStep from './components/TravelStep'
import ResultsView from './components/ResultsView'
import SettingsPanel from './components/SettingsPanel'
import './index.css'

const today = new Date().toISOString().split('T')[0]

const DEFAULT_FLIGHT: FlightInfo = {
  flightNumber: '',
  airline: '',
  departureDate: today,
  scheduledDeparture: '',
  isInternational: false,
  airport: '',
  terminal: '',
  gate: '',
}

const DEFAULT_TRAVEL: TravelInfo = {
  origin: '',
  transportMode: 'driving',
  hasTsaPrecheck: false,
  checkingBags: false,
  gateDistanceMinutes: 10,
}

const DEFAULT_KEYS: ApiKeys = { googleMaps: '', aviationStack: '', anthropic: '' }

const STEPS = ['Flight', 'Travel', 'Results']

export default function App() {
  const [step, setStep] = useState(0)
  const [flight, setFlight] = useState<FlightInfo>(DEFAULT_FLIGHT)
  const [travel, setTravel] = useState<TravelInfo>(DEFAULT_TRAVEL)
  const [keys, setKeys] = useState<ApiKeys>(DEFAULT_KEYS)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('gatemate_keys')
    if (saved) {
      try { setKeys(JSON.parse(saved)) } catch {}
    }
  }, [])

  const saveKeys = (k: ApiKeys) => {
    setKeys(k)
    localStorage.setItem('gatemate_keys', JSON.stringify(k))
  }

  const handleCalculate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await calculate(flight, travel, keys)
      setResult(res)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(0)
    setResult(null)
    setError(null)
  }

  const hasKeys = !!(keys.googleMaps || keys.aviationStack)

  return (
    <div className="min-h-screen bg-slate-900 flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1" />
          <div className="text-center">
            <div className="text-4xl mb-1">🛫</div>
            <h1 className="text-2xl font-bold text-white leading-none">GateMate</h1>
            <p className="text-slate-400 text-xs mt-1">Know exactly when to leave for your gate</p>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => setShowSettings(true)}
              title="API Key Settings"
              className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              {/* dot indicator when keys are set */}
              {hasKeys && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {step < 2 && <StepIndicator currentStep={step} steps={STEPS} />}

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4">
              ⚠️ {error}
            </div>
          )}

          {step === 0 && (
            <FlightStep flight={flight} onChange={setFlight} onNext={() => setStep(1)} keys={keys} />
          )}

          {step === 1 && (
            <TravelStep
              travel={travel}
              onChange={setTravel}
              onNext={handleCalculate}
              onBack={() => setStep(0)}
              loading={loading}
            />
          )}

          {step === 2 && result && (
            <ResultsView result={result} flight={flight} travel={travel} onReset={handleReset} />
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          API keys stored locally in your browser only.
        </p>
      </div>

      {showSettings && (
        <SettingsPanel
          keys={keys}
          onChange={saveKeys}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
