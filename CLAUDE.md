# interview-tower — agent notes

A no-login browser game for practising AI interviews. Read `README.md` first for the shape; this file is what is not
obvious from the code.

## The loop for every change

1. Write the test first and watch it fail. Domain rules go in `packages/shared` (vitest), API behaviour in
   `apps/api/test` (workerd + real local D1), components in `apps/web/test`, anything a visitor will touch in `e2e/tests`.
2. Implement until it passes.
3. Prove it locally, the whole chain:
   `npm run typecheck && npm run lint && npm test && npm run build:web && npm run smoke:prod && npm run e2e`
4. **Look at it.** `node scripts/screenshot.mjs`, then open the PNGs in `.screenshots/`. Tests cannot see a wolf
   cropped by a header, a sign hidden behind a door, or a whiteboard dulled by tone mapping — all three shipped past
   green tests in this repo's first hour.
5. Commit, push to `main`, watch `gh run watch`. If CI is red, fix it before anything else.
6. Production is `https://interview-tower.hao-hoang.workers.dev`. Until `CLOUDFLARE_API_TOKEN` is a repo secret, CI
   tests but does not deploy: run `D1_DATABASE_ID=… SITE_URL=… bash scripts/deploy-local.sh` yourself, then check the
   live site, not your machine.

## Decisions, and why

- **Node 22**, not the shell default. Wrangler 4 refuses Node 20. `.nvmrc` says 22; on this Mac use
  `export PATH=$HOME/.nvm/versions/node/v22.23.4/bin:$PATH`.
- **npm needs the `overrides` in the root `package.json`** (`vite`, `postcss`, `sharp`). Without them `npm install`
  dies with `Cannot read properties of null (reading 'edgesOut')`, which looks like a corrupt cache and is not.
- **The 3D stage is decoration over a real DOM.** Every interaction is a button or a textbox, so the product is
  accessible, testable and works with no WebGL. Never put an interaction only in the canvas.
- **`<Canvas flat>`** turns tone mapping off. With the default (ACES) the whiteboard, which is a `MeshBasicMaterial`,
  rendered grey instead of the palette's cream.
- **Characters are billboards, not models.** They are the watercolour sprites from `shorts-studio`, cropped by
  `scripts/optimize-sprites.mjs`. Same cast as the Shorts, zero image-generation spend. Regenerate with that script,
  which needs the shorts-studio `assets/characters` folder.
- **`webglAvailable()` lives in `stage/support.ts`**, not `Stage.tsx`, so the front page does not download three.js
  just to ask whether it can draw.
- **The camera uses `setViewOffset`** to slide the picture clear of the overlay panel (left on a wide screen, up on a
  phone). The panel is DOM; the scene is not told its size any other way.
- **Reloading keeps you in the room**: the address carries `?q=<id>`. That is deliberate and tested.
- **Grading is a keyword rubric on purpose.** No LLM call means no key, no cost and no latency, and the candidate can
  overrule it. `content.test.ts` requires each question's own `clincher + mechanism` to score ≥ 60, so a rubric that
  disagrees with its own model answer fails the build.
- **Attempts are one per visitor per question per UTC day** (primary key), so the "you beat 75%" figure cannot be
  stuffed by hammering submit.
- **Anonymous ids never leave the server's tables**: `/api/presence` returns avatars and rooms, never an id.
- The API's SITE_URL is only used to allow same-origin `Origin` headers; the request's own origin is always allowed.

## What is not decided

- Questions are drafts in the author's voice and **need Hao's review before they are promoted** — see `docs/CONTENT.md`.
- No custom domain yet; the site lives on workers.dev.
- No LLM grading. If added, put it behind the same `grade()` shape and keep the keyword rubric as the offline fallback.
