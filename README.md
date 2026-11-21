# Interview Tower

A browser game for practising AI engineering interviews. You walk up to a tower, step into a lobby, pick a floor,
and a watercolour grey wolf asks you a question. You answer in your own words, he grades it, and you see the
**confident wrong answer** people give, the mechanism, and the answer that gets you hired.

No login. No install. Nothing leaves your browser except an anonymous random id, so the building can show who else
is inside and how an answer compares with other people's.

Live: https://interview-tower.hao-hoang.workers.dev

## What is in it

| | |
|---|---|
| The tower | A real-time 3D scene (three.js through react-three-fiber): the building outside, a lobby with one door per floor, an interview room. Characters are billboards of the watercolour art from the Shorts. |
| The questions | 56 across five floors, each with the trap, the mechanism and a sayable answer. `packages/shared/src/content/` (hand-written core) and `content/more/` (converted from your posts). |
| The grading | A deterministic keyword rubric. Offline, free, instant, and honest about being blunt: the candidate can tick or untick any point it got wrong. |
| Presence | Windows light up for people inside; ghost animals walk the lobby. One D1 table, a 20 s heartbeat. |
| Daily question | Same for everyone each UTC day, one lap through the bank before any repeat. |
| Share | `/?q=<question-id>` opens that exact question. |

## Architecture

The same shape as `sister-web-student-management`: one Cloudflare Worker serves a static Next.js export and a Hono API,
with D1 as the database. Free tier throughout.

```
browser ──► Cloudflare Worker ──► static assets   (apps/web/out, served without running the Worker)
                    │
                    └─ /api/*  ──► Hono (apps/api) ──► D1
packages/shared   question bank, rubric scorer, daily pick, zod schemas — used by web AND api
```

- `apps/web` Next.js 15 (static export), React 19, Tailwind 4, three.js. The 3D stage is code-split and optional:
  with no WebGL, or if it fails, the product still works with the interviewer shown as a picture.
- `apps/api` Hono on Workers. Tests run inside workerd against a real local D1.
- `packages/shared` pure TypeScript.
- `e2e` Playwright against the production-shaped Worker.

## Run it

Needs Node 22 (`nvm use`).

```bash
npm ci
npm test                 # shared, API on workerd + D1, web components, scripts
npm run typecheck && npm run lint
npm run build:web
npm run serve:prod       # http://127.0.0.1:8788 — the exact production config, local D1
npm run e2e              # Playwright (first time: cd e2e && npx playwright install chromium)
npm run smoke:prod       # probes headers, caching, presence, attempts against that same server
node scripts/screenshot.mjs   # every scene at desktop and phone size into .screenshots/ — look at them
```

## Ship it

A push to `main` runs CI and deploys. See `docs/DEPLOY.md` — **the one thing CI needs from a human is a Cloudflare API
token**, and until it is set, deploys run from a laptop with `npm run deploy`.

## Content

`docs/CONTENT.md` says how to add a question, how the rubric works and what must be reviewed before it is promoted.
