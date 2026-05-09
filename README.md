# GateMate ✈️

**Know exactly when to leave for your gate.**

GateMate calculates a precise departure time from your current location so you arrive at your airport gate with just enough time — no more, no less. It factors in live traffic, real-time flight status, TSA wait times, security lane type, bag check, and the actual walk from security to your gate.

Live at **[gatemate.shafi.org](https://gatemate.shafi.org)**

---

## How it works

Enter your flight number, how you're getting to the airport, and a few preferences. GateMate works backwards from your gate's closing time:

```
Gate closes
  − 2 min buffer
  = Must be at gate by
  − Walk from security to gate      (Claude AI lookup)
  − Security screening              (live TSA wait time data)
  − Bag check (if applicable)
  − Travel time to airport          (Google Maps Routes API with live traffic)
  = Leave by ← this is what GateMate tells you
```

### Flight lookup

When you enter a flight number, GateMate looks up the current route, scheduled departure time, terminal, and gate:

- **With Anthropic key** — Claude searches the web for the current assigned route and schedule. Handles flight number reassignments accurately (e.g. a flight number may fly a different route than cached databases show).
- **Without Anthropic key** — Falls back to [adsbdb.com](https://api.adsbdb.com) for route and airline data (no departure time).

### Security wait times

- Tries the [TSA live wait time API](https://waittime.tsa.dhs.gov) for real-time checkpoint data at your airport.
- Falls back to estimates based on airport size (major / large / medium / small) × time of day if live data is unavailable.
- Applies separate PreCheck vs. standard wait time estimates.

### Traffic

- **With Google Maps key** — calls the Routes API with `TRAFFIC_AWARE` routing for live travel time including current delays.
- **Without Google Maps key** — estimates based on distance and transport mode with a traffic multiplier.

### Gate walk time

- **With Anthropic key** — Claude estimates walking time from security to gate based on airport layout, terminal, and gate number.
- **Without Anthropic key** — estimates based on airport size tier.

---

## API keys

All keys are stored locally in your browser (`localStorage`) and never sent to any server other than their respective APIs.

| Key | What it unlocks | Get one |
|-----|----------------|---------|
| **Anthropic** | Flight lookup via web search, gate distance estimation | [console.anthropic.com](https://console.anthropic.com) — uses Claude Haiku |
| **Google Maps** | Live traffic on your route to the airport | [console.cloud.google.com](https://console.cloud.google.com) — enable **Routes API** |
| **AviationStack** | Live flight delays and cancellations | [aviationstack.com](https://aviationstack.com) — free tier (100 req/mo) |

The app works without any keys — lookup accuracy and traffic estimates will be reduced.

---

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **Anthropic SDK** — `claude-haiku-4-5` with `web_search` tool for flight lookup
- Deployed on **Kubernetes** via **ArgoCD** (GitOps), served by **nginx**
- TLS via **cert-manager** + Cloudflare DNS, routed through **Cilium Gateway API**

---

## Running locally

```bash
npm install
npm run dev -- --host
```

The app runs at `http://localhost:5173`. Add your API keys via the gear icon ⚙️ in the top right — they persist in `localStorage` across sessions.

## Building

```bash
npm run build
```

Output goes to `dist/`. The included `Dockerfile` does a multi-stage build (node:24 → nginx:alpine) with SPA routing handled by `nginx.conf`.

## Deployment

A GitHub Actions workflow (`.github/workflows/docker.yml`) builds and pushes `ghcr.io/shafi/gatemate:latest` on every push to `main`.

Kubernetes manifests live in the [homelab repo](https://github.com/shafi/homelab):
- `argocd/apps/templates/gatemate.yaml` — ArgoCD Application using bjw-s app-template
- `argocd/yamls-requires-crds/gatemate-route.yaml` — HTTPRoute for `gatemate.shafi.org`

To roll out a new image after a push:
```bash
kubectl rollout restart deployment/gatemate -n gatemate
```

---

## Inputs

| Field | Description |
|-------|-------------|
| Flight number | e.g. `UA2669` — auto-fills route, time, terminal, gate |
| Departure date | Defaults to today |
| Transport mode | Drive, Uber/Lyft, Public Transit, Walking |
| Checked bags | Adds ~10 min for check-in counter |
| TSA PreCheck | Uses dedicated lane wait time estimates |
| Current location | Auto-detected via GPS + OpenStreetMap Nominatim, or enter manually |

## Output

- **Leave by** time with a live countdown ("Leave in 34 minutes")
- Full timeline breakdown: travel → security → gate walk → gate close
- Live flight delay badge when AviationStack key is configured
- Data source labels and confidence indicators on all estimates
- Warnings when falling back to estimates
