import Anthropic from '@anthropic-ai/sdk'

export interface ClaudeLookupResult {
  airline: string
  flightNumber: string
  originIata: string
  originCity: string
  destinationIata: string
  destinationCity: string
  scheduledDeparture: string   // HH:MM
  terminal: string
  gate: string
  isInternational: boolean
  confidence: 'high' | 'medium' | 'low'
  note?: string
}

export interface ClaudeScheduleResult {
  scheduledDeparture: string  // HH:MM
  terminal: string
  gate: string
  confidence: 'high' | 'medium' | 'low'
  note?: string
}

const SCHEDULE_TOOL: Anthropic.Tool = {
  name: 'submit_schedule',
  description: 'Submit the departure schedule for a known flight',
  input_schema: {
    type: 'object' as const,
    properties: {
      scheduledDeparture: { type: 'string', description: 'Scheduled departure time in HH:MM 24h format, or empty string if unknown' },
      terminal: { type: 'string', description: 'Departure terminal, or empty string if unknown' },
      gate: { type: 'string', description: 'Departure gate, or empty string if unknown' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How confident you are in the departure time' },
      note: { type: 'string', description: 'Optional note, e.g. "time varies by day of week"' },
    },
    required: ['scheduledDeparture', 'terminal', 'gate', 'confidence'],
  },
}

// Looks up departure time/terminal/gate for a flight whose route is already known.
// Uses web_search for accuracy with a proper agentic loop.
export async function lookupScheduleWithClaude(
  flightNumber: string,
  originIata: string,
  destinationIata: string,
  departureDate: string,
  apiKey: string
): Promise<ClaudeScheduleResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const dateStr = departureDate
    ? new Date(departureDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'today'

  const tools = [
    { type: 'web_search_20260209' as const, name: 'web_search' } as unknown as Anthropic.Tool,
    SCHEDULE_TOOL,
  ]

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Search for the departure time of flight ${flightNumber.toUpperCase()} from ${originIata} to ${destinationIata} on ${dateStr}.

Find the scheduled departure time (HH:MM 24h), departure terminal, and gate if available. Then call submit_schedule with what you found.`,
  }]

  // Agentic loop — web_search is server-side: send empty tool_result, Anthropic fills in results
  for (let i = 0; i < 4; i++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      tools,
      tool_choice: i < 3 ? { type: 'any' } : { type: 'tool', name: 'submit_schedule' },
      messages,
    })

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'submit_schedule') {
        const input = block.input as ClaudeScheduleResult
        return {
          scheduledDeparture: input.scheduledDeparture || '',
          terminal: input.terminal || '',
          gate: input.gate || '',
          confidence: input.confidence || 'low',
          note: input.note,
        }
      }
    }

    if (response.stop_reason === 'end_turn') break

    // Build tool_results for web_search calls — server-side tool, empty content is valid
    const toolResults: Anthropic.ToolResultBlockParam[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }))

    if (toolResults.length === 0) break

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  throw new Error('No schedule returned')
}

// Fallback: full flight lookup from Claude training data alone (no web search)
export async function lookupFlightWithClaude(
  flightNumber: string,
  departureDate: string,
  apiKey: string
): Promise<ClaudeLookupResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const FULL_TOOL: Anthropic.Tool = {
    name: 'submit_flight_info',
    description: 'Submit the extracted flight schedule information',
    input_schema: {
      type: 'object' as const,
      properties: {
        airline: { type: 'string' },
        flightNumber: { type: 'string' },
        originIata: { type: 'string' },
        originCity: { type: 'string' },
        destinationIata: { type: 'string' },
        destinationCity: { type: 'string' },
        scheduledDeparture: { type: 'string' },
        terminal: { type: 'string' },
        gate: { type: 'string' },
        isInternational: { type: 'boolean' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        note: { type: 'string' },
      },
      required: ['airline', 'flightNumber', 'originIata', 'originCity', 'destinationIata', 'destinationCity', 'scheduledDeparture', 'terminal', 'gate', 'isInternational', 'confidence'],
    },
  }

  const dateStr = departureDate
    ? new Date(departureDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'today'

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    tools: [FULL_TOOL],
    tool_choice: { type: 'tool', name: 'submit_flight_info' },
    messages: [{
      role: 'user',
      content: `Using your training knowledge, provide all details for flight ${flightNumber.toUpperCase()} on ${dateStr}: airline, origin airport (IATA + city), destination airport (IATA + city), scheduled departure time (HH:MM), terminal, gate, and whether it is international. Set confidence appropriately.`,
    }],
  })

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'submit_flight_info') {
      const input = block.input as ClaudeLookupResult
      return {
        airline: input.airline || '',
        flightNumber: input.flightNumber || flightNumber.toUpperCase(),
        originIata: (input.originIata || '').toUpperCase(),
        originCity: input.originCity || '',
        destinationIata: (input.destinationIata || '').toUpperCase(),
        destinationCity: input.destinationCity || '',
        scheduledDeparture: input.scheduledDeparture || '',
        terminal: input.terminal || '',
        gate: input.gate || '',
        isInternational: input.isInternational ?? false,
        confidence: input.confidence || 'low',
        note: input.note,
      }
    }
  }
  throw new Error('Claude did not return flight data')
}
