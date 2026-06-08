import { chromium } from 'playwright-core'
import type { Browser } from 'playwright-core'

export interface FlightDetails {
  flightNumber: string
  airline: string
  origin: {
    iata: string
    name: string
    city: string
  }
  destination: {
    iata: string
    name: string
    city: string
  }
  scheduledDeparture: string
  scheduledArrival: string
  status: string
  aircraft: string
  terminal?: string
  gate?: string
  delay?: number
  estimatedDeparture?: string
  estimatedArrival?: string
}

interface ScrapedDetails {
  originIata: string
  originName: string
  destIata: string
  destName: string
  scheduledDep: string
  scheduledArr: string
  status: string
  airline: string
  aircraft: string
  gate: string
  terminal: string
  delay: number
}

// cloakserve requires http:// with ?fingerprint=<seed> — not a raw WebSocket URL
const CLOAK_HOST = process.env.CLOAK_CDP_URL ?? 'http://localhost:9222'

let browserInstance: Browser | null = null

function cloakUrl(): string {
  const seed = Math.random().toString(36).substring(2, 10)
  const base = CLOAK_HOST.replace(/\/+$/, '')
  return `${base}?fingerprint=${seed}`
}

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.connectOverCDP(cloakUrl())
  }
  return browserInstance
}

export async function scrapeFlightAware(flightNumber: string): Promise<FlightDetails> {
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()

  try {
    const url = `https://www.flightaware.com/live/flight/${flightNumber.replace(/\s+/g, '')}`
    console.log(`Scraping: ${url}`)
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Wait for React to hydrate flight data — try known selectors with a generous timeout
    const knownSelectors = [
      '[class*="flightHeader"]',
      '[class*="airport-code"]',
      '[class*="FlightHeader"]',
      '[data-testid*="airport"]',
      '[data-testid*="flight"]',
      '.airport-iata-code',
      '.flightPageSummary',
    ]
    const selectorList = knownSelectors.join(',')
    try {
      await page.waitForSelector(selectorList, { timeout: 15000 })
    } catch {
      // No known selector appeared — content may have different structure; continue and log
    }

    const bodyHTML = await page.content()
    if (bodyHTML.includes('captcha') || bodyHTML.includes('Checking your browser')) {
      throw new Error('Captcha detected - FlightAware requires verification')
    }

    const details = await page.evaluate<ScrapedDetails>(() => {
      function getText(selector: string): string {
        const el = document.querySelector(selector)
        return el?.textContent?.trim() ?? ''
      }

      const originIata = getText('.flightPageSummaryOrigin .flightPageSummaryAirportCode')
      const destIata   = getText('.flightPageSummaryDestination .flightPageSummaryAirportCode')

      const originFull = getText('.flightPageSummaryOrigin')
      const destFull   = getText('.flightPageSummaryDestination')
      const originName = originFull.replace(originIata, '').trim().split('\n').map((s: string) => s.trim()).filter(Boolean).join(', ')
      const destName   = destFull.replace(destIata, '').trim().split('\n').map((s: string) => s.trim()).filter(Boolean).join(', ')

      // Departure: e.g. "10:17PM EDT (8 minutes early)" → take just the time part
      const depEl  = document.querySelector('.flightPageSummaryDeparture.flightTime')
      const arrEl  = document.querySelector('.flightPageSummaryArrival.flightTime')
      const scheduledDep = depEl?.textContent?.trim().split('(')[0].trim() ?? ''
      const scheduledArr = arrEl?.textContent?.trim().split('(')[0].trim() ?? ''

      const statusEl = document.querySelector('.flightPageSummaryStatus')
      const status = statusEl?.firstChild?.textContent?.trim() ?? getText('.flightPageSummaryStatus') ?? 'Unknown'

      const h1Text = document.querySelector('h1')?.textContent?.trim() ?? ''
      const airlineMatch = h1Text.match(/^(.+?)\s+\d/)
      const airline = airlineMatch ? airlineMatch[1].trim() : ''

      const aircraft = getText('.flightPageSummaryAircraftType') || ''

      // Gate: "left Gate B40 ..." → extract "B40"
      const gateEl = document.querySelector('.flightPageAirportGate')
      const gateMatch = gateEl?.textContent?.match(/Gate\s+(\S+)/)
      const gate = gateMatch ? gateMatch[1] : ''

      // Terminal: "arriving at Terminal 5" → "5"
      const termEls = document.querySelectorAll('.flightPageAirportGate')
      let terminal = ''
      termEls.forEach((el) => {
        const m = el.textContent?.match(/Terminal\s+(\S+)/)
        if (m) terminal = m[1]
      })

      const delayText = getText('.flightPageSummaryStatus') || ''
      const delayMatch = delayText.match(/(\d+)\s*min/)
      const delay = delayMatch ? parseInt(delayMatch[1]) : 0

      return { originIata, originName, destIata, destName, scheduledDep, scheduledArr, status, airline, aircraft, gate, terminal, delay }
    })

    if (!details.originIata || !details.destIata) {
      throw new Error('Could not extract flight details from page')
    }

    const result: FlightDetails = {
      flightNumber: flightNumber.toUpperCase(),
      airline: details.airline || 'Unknown',
      origin: {
        iata: details.originIata,
        name: details.originName,
        city: details.originName.split(',')[0] || ''
      },
      destination: {
        iata: details.destIata,
        name: details.destName,
        city: details.destName.split(',')[0] || ''
      },
      scheduledDeparture: details.scheduledDep,
      scheduledArrival: details.scheduledArr,
      status: details.status,
      aircraft: details.aircraft
    }

    if (details.gate) result.gate = details.gate
    if (details.terminal) result.terminal = details.terminal
    if (details.delay) result.delay = details.delay

    return result

  } finally {
    await context.close()
  }
}

export async function warmBrowser(): Promise<void> {
  try {
    await getBrowser()
    console.log('[cloakbrowser] CDP connection warmed up')
  } catch (err) {
    console.warn('[cloakbrowser] Warm-up failed (will retry on first request):', err instanceof Error ? err.message : err)
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

// Test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testFlight = process.argv[2] || 'UAL1095'
  console.log(`Testing flight lookup: ${testFlight}`)
  
  scrapeFlightAware(testFlight)
    .then(result => {
      console.log('\n✅ Success!')
      console.log(JSON.stringify(result, null, 2))
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message)
    })
    .finally(() => closeBrowser())
}
