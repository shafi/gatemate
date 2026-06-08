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

    // Log key structural elements for selector debugging
    const headings = await page.$$eval('h1,h2', els => els.map(e => e.textContent?.trim()).filter(Boolean).slice(0, 5))
    console.log('Headings:', JSON.stringify(headings))
    const bodyText = await page.textContent('body')
    // Log full page in chunks to find flight data structure
    const fullText = bodyText?.replace(/\s+/g, ' ') ?? ''
    console.log('Body[0-800]:', fullText.substring(0, 800))
    console.log('Body[800-1600]:', fullText.substring(800, 1600))
    console.log('Body[1600-2400]:', fullText.substring(1600, 2400))
    // Log all elements with airport-like class names
    const airportEls = await page.$$eval('*', els =>
      els
        .filter(e => /airport|iata|origin|destination|depart|arriv/i.test(e.className || e.getAttribute('data-testid') || ''))
        .slice(0, 10)
        .map(e => ({ tag: e.tagName, class: e.className, text: e.textContent?.trim().substring(0, 80) }))
    )
    console.log('Airport-like elements:', JSON.stringify(airportEls))

    // Extract flight details using a function string to avoid compilation issues
    const details = await page.evaluate<ScrapedDetails>(`(function() {
      function getText(selector) {
        const el = document.querySelector(selector);
        return (el && el.textContent) ? el.textContent.trim() : '';
      }

      // Get origin and destination
      const originIata = getText('.flightPageSummaryAirports .origin .airport-code') || 
                        getText('[data-cy="origin-airport-code"]');
      const originName = getText('.flightPageSummaryAirports .origin .airport-name') ||
                        getText('[data-cy="origin-airport-name"]');
      const destIata = getText('.flightPageSummaryAirports .destination .airport-code') ||
                      getText('[data-cy="destination-airport-code"]');
      const destName = getText('.flightPageSummaryAirports .destination .airport-name') ||
                      getText('[data-cy="destination-airport-name"]');

      // Get times
      const scheduledDep = getText('.flightPageSummaryTimes .departure .time') ||
                          getText('[data-cy="scheduled-departure-time"]');
      const scheduledArr = getText('.flightPageSummaryTimes .arrival .time') ||
                          getText('[data-cy="scheduled-arrival-time"]');
      
      // Get status
      const status = getText('.flightPageSummaryStatus') || 
                    getText('[data-cy="flight-status"]') ||
                    'Unknown';

      // Get airline (from title or header)
      const titleEl = document.querySelector('h1');
      const title = titleEl ? titleEl.textContent : '';
      const airlineMatch = title.match(/^([A-Z][A-Za-z\\s]+)/);
      const airline = airlineMatch ? airlineMatch[1].trim() : '';

      // Get aircraft type
      const aircraft = getText('.flightPageSummaryAircraftInfo .aircraftType') ||
                      getText('[data-cy="aircraft-type"]') ||
                      '';

      // Get gate and terminal info
      const gate = getText('.gateInfo') || getText('[data-cy="gate"]') || '';
      const terminal = getText('.terminalInfo') || getText('[data-cy="terminal"]') || '';

      // Get delay info
      const delayText = getText('.flightPageSummaryDelay') || '';
      const delayMatch = delayText.match(/(\\d+)\\s*min/);
      const delay = delayMatch ? parseInt(delayMatch[1]) : 0;

      return {
        originIata: originIata,
        originName: originName,
        destIata: destIata,
        destName: destName,
        scheduledDep: scheduledDep,
        scheduledArr: scheduledArr,
        status: status,
        airline: airline,
        aircraft: aircraft,
        gate: gate,
        terminal: terminal,
        delay: delay
      };
    })()`)

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
