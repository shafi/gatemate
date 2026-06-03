import express from 'express'
import cors from 'cors'
import { scrapeFlightAware, closeBrowser } from './scraper.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'flight-scraper' })
})

// Get flight details
app.get('/flight/:flightNumber', async (req, res) => {
  const { flightNumber } = req.params
  
  if (!flightNumber) {
    return res.status(400).json({ error: 'Flight number is required' })
  }

  console.log(`[${new Date().toISOString()}] Looking up flight: ${flightNumber}`)

  try {
    const details = await scrapeFlightAware(flightNumber)
    res.json({ success: true, data: details })
  } catch (error) {
    console.error('Scraping error:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch flight details'
    })
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...')
  await closeBrowser()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...')
  await closeBrowser()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`🚀 Flight scraper API running on port ${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   Example: http://localhost:${PORT}/flight/UAL1095`)
})
