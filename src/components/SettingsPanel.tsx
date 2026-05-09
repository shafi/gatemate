import { useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import type { ApiKeys } from '../types'

interface Props {
  keys: ApiKeys
  onChange: (k: ApiKeys) => void
  onClose: () => void
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

async function testGoogleMaps(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=New+York&destination=JFK+Airport&key=${key}`
    )
    const data = await res.json()
    return data.status === 'OK' || data.status === 'ZERO_RESULTS'
  } catch {
    return false
  }
}

async function testAviationStack(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `http://api.aviationstack.com/v1/flights?access_key=${key}&limit=1`
    )
    const data = await res.json()
    return !data.error
  } catch {
    return false
  }
}

async function testAnthropic(key: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })
    await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    })
    return true
  } catch {
    return false
  }
}

function KeyField({
  label, sublabel, badge, placeholder, value, show, onToggleShow,
  onChange, onTest, testState,
  footer,
}: {
  label: string; sublabel: string; badge: boolean; placeholder: string
  value: string; show: boolean; onToggleShow: () => void
  onChange: (v: string) => void; onTest: () => void; testState: TestState
  footer: React.ReactNode
}) {
  const testLabel = () => {
    if (testState === 'testing') return <span className="text-slate-400 text-xs animate-pulse">Testing…</span>
    if (testState === 'ok')      return <span className="text-emerald-400 text-xs">✓ Valid</span>
    if (testState === 'fail')    return <span className="text-red-400 text-xs">✗ Invalid key</span>
    return null
  }

  return (
    <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-white font-medium text-sm">{label}</div>
          <div className="text-slate-400 text-xs mt-0.5">{sublabel}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3 ${
          badge
            ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50'
            : 'bg-slate-700 text-slate-400 border border-slate-600'
        }`}>
          {badge ? 'Active' : 'Not set'}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 pr-10"
          />
          <button
            onClick={onToggleShow}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            tabIndex={-1}
          >
            {show ? '🙈' : '👁️'}
          </button>
        </div>
        <button
          onClick={onTest}
          disabled={!value || testState === 'testing'}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs rounded-lg transition-colors whitespace-nowrap"
        >
          Test
        </button>
      </div>

      {testState !== 'idle' && <div className="mt-2">{testLabel()}</div>}
      <div className="text-xs text-slate-500 mt-2">{footer}</div>
    </div>
  )
}

export default function SettingsPanel({ keys, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<ApiKeys>({ ...{ anthropic: '', googleMaps: '', aviationStack: '' }, ...keys })
  const [show, setShow] = useState({ anthropic: false, googleMaps: false, aviationStack: false })
  const [tests, setTests] = useState<Record<keyof ApiKeys, TestState>>({
    anthropic: 'idle', googleMaps: 'idle', aviationStack: 'idle',
  })
  const [saved, setSaved] = useState(false)

  const set = (k: keyof ApiKeys, v: string) => {
    setDraft(d => ({ ...d, [k]: v }))
    setSaved(false)
    setTests(t => ({ ...t, [k]: 'idle' }))
  }

  const toggleShow = (k: keyof typeof show) =>
    setShow(s => ({ ...s, [k]: !s[k] }))

  const runTest = async (k: keyof ApiKeys, fn: () => Promise<boolean>) => {
    setTests(t => ({ ...t, [k]: 'testing' }))
    const ok = await fn()
    setTests(t => ({ ...t, [k]: ok ? 'ok' : 'fail' }))
  }

  const handleSave = () => {
    onChange(draft)
    setSaved(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-8 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl mt-16 max-h-[calc(100vh-6rem)] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <div>
            <h2 className="text-white font-semibold">Settings</h2>
            <p className="text-slate-400 text-xs mt-0.5">API keys — stored in your browser only</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Anthropic — primary */}
          <KeyField
            label="🤖 Anthropic API Key"
            sublabel="Powers smart flight lookup — airline, route, time, terminal, gate"
            badge={!!draft.anthropic}
            placeholder="sk-ant-…"
            value={draft.anthropic}
            show={show.anthropic}
            onToggleShow={() => toggleShow('anthropic')}
            onChange={v => set('anthropic', v)}
            onTest={() => runTest('anthropic', () => testAnthropic(draft.anthropic))}
            testState={tests.anthropic}
            footer={
              <span>
                Get a key at <span className="text-slate-400">console.anthropic.com</span> — uses Claude Haiku (very cheap per lookup)
              </span>
            }
          />

          {/* Google Maps */}
          <KeyField
            label="🗺️ Google Maps Directions API"
            sublabel="Live traffic on your route to the airport"
            badge={!!draft.googleMaps}
            placeholder="AIza…"
            value={draft.googleMaps}
            show={show.googleMaps}
            onToggleShow={() => toggleShow('googleMaps')}
            onChange={v => set('googleMaps', v)}
            onTest={() => runTest('googleMaps', () => testGoogleMaps(draft.googleMaps))}
            testState={tests.googleMaps}
            footer={
              <span>
                Enable <span className="text-slate-400">Directions API</span> at console.cloud.google.com
              </span>
            }
          />

          {/* AviationStack */}
          <KeyField
            label="✈️ AviationStack API"
            sublabel="Live delays, cancellations, actual departure times"
            badge={!!draft.aviationStack}
            placeholder="Your key…"
            value={draft.aviationStack}
            show={show.aviationStack}
            onToggleShow={() => toggleShow('aviationStack')}
            onChange={v => set('aviationStack', v)}
            onTest={() => runTest('aviationStack', () => testAviationStack(draft.aviationStack))}
            testState={tests.aviationStack}
            footer={
              <span>
                Free tier (100 req/mo) at <span className="text-slate-400">aviationstack.com</span>
              </span>
            }
          />

          {/* Without keys note */}
          <div className="bg-slate-700/20 rounded-lg px-4 py-3 border border-slate-700/50 text-xs text-slate-400 space-y-1">
            <div><span className="text-slate-300 font-medium">Without Anthropic key:</span> uses adsbdb.com (free) for route/airline — no departure time.</div>
            <div><span className="text-slate-300 font-medium">Without Maps key:</span> estimated travel time based on transport mode.</div>
            <div><span className="text-slate-300 font-medium">Without AviationStack key:</span> no live delay data.</div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
              saved
                ? 'bg-emerald-700 text-emerald-200 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saved ? '✓ Saved' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  )
}
