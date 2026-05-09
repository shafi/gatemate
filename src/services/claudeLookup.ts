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

const FLIGHT_TOOL: Anthropic.Tool = {
  name: 'submit_flight_info',
  description: 'Submit all flight schedule information found',
  input_schema: {
    type: 'object' as const,
    properties: {
      airline:           { type: 'string', description: 'Full airline name, e.g. United Airlines' },
      flightNumber:      { type: 'string', description: 'IATA flight number, e.g. UA2669' },
      originIata:        { type: 'string', description: '3-letter IATA code of departure airport' },
      originCity:        { type: 'string', description: 'City of departure airport' },
      destinationIata:   { type: 'string', description: '3-letter IATA code of arrival airport' },
      destinationCity:   { type: 'string', description: 'City of arrival airport' },
      scheduledDeparture:{ type: 'string', description: 'Scheduled departure time HH:MM (24h), empty if unknown' },
      terminal:          { type: 'string', description: 'Departure terminal, empty if unknown' },
      gate:              { type: 'string', description: 'Departure gate, empty if unknown' },
      isInternational:   { type: 'boolean', description: 'True if origin and destination are in different countries' },
      confidence:        { type: 'string', enum: ['high', 'medium', 'low'] },
      note:              { type: 'string', description: 'e.g. "schedule varies by day of week"' },
    },
    required: ['airline', 'flightNumber', 'originIata', 'originCity', 'destinationIata',
               'destinationCity', 'scheduledDeparture', 'terminal', 'gate', 'isInternational', 'confidence'],
  },
}

function parseResult(input: Record<string, unknown>, fallbackNumber: string): ClaudeLookupResult {
  return {
    airline:            String(input.airline || ''),
    flightNumber:       String(input.flightNumber || fallbackNumber.toUpperCase()),
    originIata:         String(input.originIata || '').toUpperCase(),
    originCity:         String(input.originCity || ''),
    destinationIata:    String(input.destinationIata || '').toUpperCase(),
    destinationCity:    String(input.destinationCity || ''),
    scheduledDeparture: String(input.scheduledDeparture || ''),
    terminal:           String(input.terminal || ''),
    gate:               String(input.gate || ''),
    isInternational:    Boolean(input.isInternational ?? false),
    confidence:         (input.confidence as ClaudeLookupResult['confidence']) || 'low',
    note:               input.note ? String(input.note) : undefined,
  }
}

// Full lookup with web_search — accurate route + schedule.
// Uses an agentic loop: Claude may call web_search (server-side) before submit_flight_info.
export async function lookupFlightWithClaude(
  flightNumber: string,
  departureDate: string,
  apiKey: string
): Promise<ClaudeLookupResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const dateStr = departureDate
    ? new Date(departureDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'today'

  const tools = [
    { type: 'web_search_20260209' as const, name: 'web_search' } as unknown as Anthropic.Tool,
    FLIGHT_TOOL,
  ]

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Search for flight ${flightNumber.toUpperCase()} on ${dateStr}.

Find: airline, departure airport (IATA + city), arrival airport (IATA + city), scheduled departure time (HH:MM 24h), terminal, gate, domestic or international.

Then call submit_flight_info with everything you found. Use web_search to get the current route — flight numbers get reassigned so always verify.`,
  }]

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      tools,
      // Force submit_flight_info on the last iteration so we always get a result
      tool_choice: i < 4 ? { type: 'any' } : { type: 'tool', name: 'submit_flight_info' },
      messages,
    })

    // Return as soon as submit_flight_info is called
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'submit_flight_info') {
        return parseResult(block.input as Record<string, unknown>, flightNumber)
      }
    }

    if (response.stop_reason === 'end_turn') break

    // web_search is server-side: send back empty tool_result — Anthropic fills in the results
    const toolResults: Anthropic.ToolResultBlockParam[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }))

    if (toolResults.length === 0) break

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  throw new Error('Claude did not return flight data')
}
