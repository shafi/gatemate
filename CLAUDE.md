# GateMate

## Stack
- React 19, TypeScript, Vite, Tailwind CSS v4
- Anthropic SDK (`claude-haiku-4-5` with `web_search` tool)
- Deployed: GitHub Actions builds `ghcr.io/shafi/gatemate:latest` → ArgoCD on homelab K8s

## Workflow
- Dev: `npm install && npm run dev -- --host`
- Verify: `npm run build` before claiming done
- Deploy: push to `main` → GitHub Actions → `kubectl rollout restart deployment/gatemate -n gatemate`

## Architecture rules
- API keys (Anthropic, Google Maps, AviationStack) live in `localStorage` only — never sent to any backend
- All time calculation flows backwards from gate close time; don't break that chain
- Fallbacks must always exist: every external API call has a non-API estimate fallback

## Gotchas
- Tailwind v4: config is in CSS (`@import "tailwindcss"`), not `tailwind.config.js`
- Infra manifests (ArgoCD app, HTTPRoute) are in the `homelab/` repo, not here
