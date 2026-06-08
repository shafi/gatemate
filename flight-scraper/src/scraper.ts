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

const CDP_URL = process.env.CLOAK_CDP_URL ?? 'ws://localhost:9222'

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.connectOverCDP(CDP_URL)
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
    
    // Wait for main content
    await page.waitForTimeout(3000) // Give it time to load
    
    // Save screenshot for debugging
    await page.screenshot({ path: '/tmp/flightaware.png', fullPage: true })
    console.log('Screenshot saved to /tmp/flightaware.png')
    
    // Get page content for debugging
    const bodyHTML = await page.content()
    if (bodyHTML.includes('captcha') || bodyHTML.includes('Checking your browser')) {
      throw new Error('Captcha detected - FlightAware requires verification')
    }
    
    // Log a sample of the HTML to understand structure
    const sampleSelectors = [
      'h1', '.flightPageSummaryAirports', '[data-testid]', '.airport-code', 
      '.flightPageSummary', 'div[class*="flight"]', 'span[class*="airport"]'
    ]
    
    for (const sel of sampleSelectors) {
      const found = await page.$(sel)
      if (found) {
        const text = await found.textContent()
        const html = await found.innerHTML()
        console.log(`Found ${sel}:`, text?.substring(0, 100), '| HTML:', html?.substring(0, 100))
      }
    }
    
    // Try to find any useful containers
    const allText = await page.textContent('body')
    console.log('Page contains:', allText?.substring(0, 500))

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
