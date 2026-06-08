import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { scrapeFlightAware, closeBrowser } from './scraper.js'

const app = express()
const PORT = process.env.PORT || 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://gatemate.shafi.org'

// Trust one layer of proxy (Cloudflare → Cilium → this pod)
app.set('trust proxy', 1)

app.use(helmet())

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET'],
}))

app.use(express.json({ limit: '10kb' }))

// 20 lookups per minute per IP — generous for real users, punishing for bots
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — try again in a minute' },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
})

// Stricter limit on the expensive scrape endpoint
const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many flight lookups — try again in a minute' },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
})

app.use(limiter)

// Valid IATA/ICAO flight number: 2-3 letter airline code + 1-4 digits + optional suffix letter
const FLIGHT_NUMBER_RE = /^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/

// Simple concurrency cap — Playwright browsers are heavy
let activeScrapes = 0
const MAX_CONCURRENT = 3

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'flight-scraper' })
})

app.get('/flight/:flightNumber', scrapeLimiter, async (req, res) => {
  const raw = req.params.flightNumber.toUpperCase().replace(/\s+/g, '')

  if (!FLIGHT_NUMBER_RE.test(raw)) {
    res.status(400).json({ success: false, error: 'Invalid flight number format' })
    return
  }

  if (activeScrapes >= MAX_CONCURRENT) {
    res.status(503).json({ success: false, error: 'Service busy — try again shortly' })
    return
  }

  console.log(`[${new Date().toISOString()}] ${req.ip} → ${raw}`)

  activeScrapes++
  try {
    const details = await scrapeFlightAware(raw)
    res.json({ success: true, data: details })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    // Classify error without leaking internals
    if (msg.includes('not found') || msg.includes('Could not extract')) {
      res.status(404).json({ success: false, error: `Flight ${raw} not found` })
    } else if (msg.includes('Captcha') || msg.includes('verification')) {
      res.status(503).json({ success: false, error: 'Upstream verification required — try again later' })
    } else {
      console.error(`Scrape failed for ${raw}:`, msg)
      res.status(500).json({ success: false, error: 'Lookup failed — try again later' })
    }
  } finally {
    activeScrapes--
  }
})

// Reject anything else
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

process.on('SIGTERM', async () => {
  await closeBrowser()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await closeBrowser()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`Flight scraper running on port ${PORT} (origin: ${ALLOWED_ORIGIN})`)
})
