# Flight Scraper Service

A microservice that scrapes flight details from FlightAware using Playwright.

## Features

- Scrapes real-time flight information from FlightAware.com
- Returns structured flight data (airline, origin, destination, times, status, gate, terminal)
- Headless browser automation with Playwright
- Simple REST API

## API Endpoints

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "service": "flight-scraper"
}
```

### GET /flight/:flightNumber
Get flight details for a specific flight number

**Example:** `GET /flight/UAL1095`

**Response:**
```json
{
  "success": true,
  "data": {
    "flightNumber": "UAL1095",
    "airline": "United Airlines",
    "origin": {
      "iata": "SFO",
      "name": "San Francisco International Airport",
      "city": "San Francisco"
    },
    "destination": {
      "iata": "LAX",
      "name": "Los Angeles International Airport",
      "city": "Los Angeles"
    },
    "scheduledDeparture": "10:30 AM",
    "scheduledArrival": "12:15 PM",
    "status": "On Time",
    "aircraft": "Boeing 737-900",
    "terminal": "2",
    "gate": "B7",
    "delay": 0
  }
}
```

## Development

### Install dependencies
```bash
npm install
```

### Install Playwright browsers
```bash
npx playwright install chromium
```

### Run in development mode
```bash
npm run dev
```

### Test scraper directly
```bash
npm run test UAL1095
```

### Build
```bash
npm run build
```

### Start production server
```bash
npm start
```

## Docker

### Build image
```bash
docker build -t flight-scraper .
```

### Run container
```bash
docker run -p 3001:3001 flight-scraper
```

## Environment Variables

- `PORT` - Server port (default: 3001)

## Integration with GateMate

Update the GateMate frontend to call this service instead of the adsbdb API:

```typescript
// In src/services/flightLookup.ts
const SCRAPER_URL = 'http://localhost:3001'

export async function lookupFlight(flightNumber: string) {
  const res = await fetch(`${SCRAPER_URL}/flight/${flightNumber}`)
  const data = await res.json()
  
  if (!data.success) {
    throw new Error(data.error || 'Flight lookup failed')
  }
  
  return data.data
}
```
