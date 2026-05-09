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

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'submit_flight_info',
  description: 'Submit the extracted flight schedule information',
  input_schema: {
    type: 'object' as const,
    properties: {
      airline: { type: 'string', description: 'Full airline name, e.g. American Airlines' },
      flightNumber: { type: 'string', description: 'IATA flight number, e.g. AA123' },
      originIata: { type: 'string', description: '3-letter IATA code of departure airport' },
      originCity: { type: 'string', description: 'City name of departure airport' },
      destinationIata: { type: 'string', description: '3-letter IATA code of destination airport' },
      destinationCity: { type: 'string', description: 'City name of destination airport' },
      scheduledDeparture: { type: 'string', description: 'Scheduled departure time in HH:MM 24h format, or empty string if unknown' },
      terminal: { type: 'string', description: 'Departure terminal, or empty string if unknown' },
      gate: { type: 'string', description: 'Departure gate, or empty string if unknown' },
      isInternational: { type: 'boolean', description: 'True if origin and destination are in different countries' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in the data accuracy' },
      note: { type: 'string', description: 'Optional note about the data, e.g. schedule varies by day' },
    },
    required: ['airline', 'flightNumber', 'originIata', 'originCity', 'destinationIata', 'destinationCity', 'scheduledDeparture', 'terminal', 'gate', 'isInternational', 'confidence'],
  },
}

export async function lookupFlightWithClaude(
  flightNumber: string,
  departureDate: string,
  apiKey: string
): Promise<ClaudeLookupResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const dateStr = departureDate
    ? new Date(departureDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'today'

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_flight_info' },
    messages: [{
      role: 'user',
      content: `Look up flight ${flightNumber.toUpperCase()} scheduled for ${dateStr}.

Using your training knowledge, identify: the airline, departure airport (IATA code + city), arrival airport (IATA code + city), typical scheduled departure time (HH:MM 24h), departure terminal, and gate if known.

Call submit_flight_info with everything you know. Set confidence to "high" for well-known routes you're confident about, "medium" if schedule varies by day, or "low" if uncertain. Include a note if the schedule varies by season or day of week.`,
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
