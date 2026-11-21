#!/usr/bin/env bash
# Probe the production shape (real Worker config, assets, local D1). Needs apps/web/out.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8789}"
LOG="$(mktemp)"
PORT="$PORT" bash scripts/serve-prod.sh >"$LOG" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; pkill -P "$PID" 2>/dev/null || true; rm -f "$LOG"' EXIT
BASE="http://127.0.0.1:$PORT"
for _ in $(seq 1 60); do curl -sf "$BASE/api/health" >/dev/null && break; sleep 1; done

fails=0
check() { if eval "$2"; then echo "✔ $1"; else echo "✘ $1"; fails=$((fails + 1)); fi; }
status() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
ANON=0123456789abcdef0123456789abcdef

check "home is served from assets with the right title" '[ "$(status $BASE/)" = 200 ] && curl -s $BASE/ | grep -q "<title>Interview Tower"'
check "home carries the CSP" 'curl -sI $BASE/ | grep -qi "content-security-policy: default-src .self."'
check "pages cannot be framed" 'curl -sI $BASE/ | grep -qi "x-frame-options: DENY"'
check "characters are cached for a year" 'curl -sI $BASE/characters/interviewer/neutral.webp | grep -qi "max-age=31536000"'
check "unknown paths get the 404 page" '[ "$(status $BASE/no-such-floor/)" = 404 ]'
check "API runs in production mode" 'curl -s $BASE/api/health | grep -q "\"environment\":\"production\""'
check "unknown API routes are JSON 404s" '[ "$(status $BASE/api/nope)" = 404 ]'
check "presence round-trips through D1" 'curl -s -X POST -H "content-type: application/json" -d "{\"anonId\":\"$ANON\",\"room\":\"agents\",\"avatar\":\"owl\"}" $BASE/api/presence | grep -q "\"online\":1"'
check "an attempt is recorded" 'curl -s -X POST -H "content-type: application/json" -d "{\"anonId\":\"$ANON\",\"questionId\":\"prompt-cache-prefix\",\"score\":70,\"seconds\":30}" $BASE/api/attempts | grep -q "\"attempts\":1"'
check "a cross-site post is refused" '[ "$(status -X POST -H "content-type: application/json" -H "origin: https://evil.example" -d "{}" $BASE/api/presence)" = 403 ]'
check "the daily question is served" 'curl -s $BASE/api/daily | grep -q "questionId"'

if [ "$fails" -gt 0 ]; then echo "$fails check(s) failed"; tail -30 "$LOG"; exit 1; fi
echo "production smoke passed"
