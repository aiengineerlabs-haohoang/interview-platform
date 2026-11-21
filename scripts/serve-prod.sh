#!/usr/bin/env bash
# Serve the exact production Worker config locally: static assets + API + a throwaway local D1.
# Needs apps/web/out (npm run build:web). PORT defaults to 8788. Runs in the foreground.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8788}"
STATE="${STATE_DIR:-$(mktemp -d)}"
[ -f apps/web/out/index.html ] || { echo "build the site first: npm run build:web" >&2; exit 1; }
D1_DATABASE_ID=00000000-0000-0000-0000-000000000000 SITE_URL=https://tower.example node scripts/prod-config.mjs >/dev/null
cd apps/api
npx wrangler d1 migrations apply interview-tower --local -c wrangler.production.jsonc --persist-to "$STATE/d1" >/dev/null
exec npx wrangler dev -c wrangler.production.jsonc --local --port "$PORT" --persist-to "$STATE/d1" --show-interactive-dev-session=false
