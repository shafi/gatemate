import Anthropic from '@anthropic-ai/sdk'

export interface GateDistanceResult {
  minutes: number
  description: string
  source: 'claude' | 'estimate'
}

const WALK_TOOL: Anthropic.Tool = {
  name: 'submit_gate_distance',
  description: 'Submit the estimated walking time from security to the gate',
  input_schema: {
    type: 'object' as const,
    properties: {
      minutes: { type: 'number', description: 'Estimated walking time in minutes from security exit to gate area' },
      description: { type: 'string', description: 'Brief description, e.g. "Terminal B is a long walk from security, ~12 min"' },
    },
    required: ['minutes', 'description'],
  },
}

export async function lookupGateDistance(
  airport: string,
  terminal: string,
  gate: string,
  apiKey: string
): Promise<GateDistanceResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const location = [airport, terminal && `Terminal ${terminal}`, gate && `Gate ${gate}`]
    .filter(Boolean).join(', ')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    tools: [WALK_TOOL],
    tool_choice: { type: 'tool', name: 'submit_gate_distance' },
    messages: [{
      role: 'user',
      content: `Estimate the walking time in minutes from the security checkpoint exit to the gate area at ${location}.

Consider: terminal layout, distance from security to gates, moving walkways if present. Provide a realistic estimate for an average walking pace. If a specific gate is given, estimate for that gate's concourse. If only the terminal is known, estimate for the middle of that terminal's gates.`,
    }],
  })

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'submit_gate_distance') {
      const input = block.input as { minutes: number; description: string }
      return {
        minutes: Math.round(Math.max(2, Math.min(30, input.minutes))),
        description: input.description || '',
        source: 'claude',
      }
    }
  }

  throw new Error('No gate distance returned')
}

// Fallback estimate by airport size when Claude is unavailable
export function estimateGateDistance(airport: string): GateDistanceResult {
  const MAJOR = new Set(['ATL','LAX','ORD','DFW','DEN','JFK','SFO','EWR','IAH','MIA'])
  const LARGE = new Set(['BOS','MSP','DTW','FLL','LGA','BWI','SLC','SAN','CLT','PHX','SEA','LAS','MCO'])
  const code = airport.toUpperCase()
  if (MAJOR.has(code)) return { minutes: 12, description: 'Major airport — estimated 12 min walk', source: 'estimate' }
  if (LARGE.has(code)) return { minutes: 8, description: 'Large airport — estimated 8 min walk', source: 'estimate' }
  return { minutes: 5, description: 'Estimated 5 min walk', source: 'estimate' }
}
