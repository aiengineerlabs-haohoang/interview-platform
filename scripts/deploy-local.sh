#!/usr/bin/env bash
# Deploy from this machine with the wrangler login you already have. CI does the same thing on every push to main
# (.github/workflows/deploy.yml); use this for the very first deploy or when CI is unavailable.
#   D1_DATABASE_ID=... SITE_URL=https://... bash scripts/deploy-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${D1_DATABASE_ID:?set D1_DATABASE_ID}"
: "${SITE_URL:?set SITE_URL (https://...)}"
NEXT_PUBLIC_SITE_URL="$SITE_URL" npm run build:web
node scripts/prod-config.mjs
cd apps/api
npx wrangler d1 migrations apply interview-tower --remote -c wrangler.production.jsonc
npx wrangler deploy -c wrangler.production.jsonc
