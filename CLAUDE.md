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
- **Characters are real 3D humans: VRM models** (`apps/web/public/models/{a,b,c,d}.vrm`, loaded with `@pixiv/three-vrm`).
  The four VRoid/pixiv sample models, licences "everyone / commercial use / modification allowed". Their textures are
  recompressed to 1024px webp (4.5 MB each, down from 15). They are made *chibi* at load time by scaling raw bones
  (`CHIBI` in `stage/world/vrm.ts`). Animation is procedural on the normalised humanoid bones, no clips. VRM 0 and VRM 1
  disagree on bone axes once loaded, so `calibrate()` measures the sign of "forward" and "arm down" per model. One model
  can be in one place at a time: the interviewer is always a different model from the player.
- **The environment is real 3D props plus Gemini-generated textures.** `apps/web/public/props/*.glb` are CC0 Poly Haven
  models (trees, street lamps, bench, picnic table, urban facades for the horizon, and the room's table, chairs,
  bookshelf, plants, clock, mirror, tea set), decimated and webp-compressed with gltf-transform (the originals are
  millions of triangles). Trees keep a random subset of whole leaf clusters, scaled up, because simplifying leaf cards
  deletes the foliage. Props load through `stage/world/Prop.tsx` (`<Prop name height|width />`, a missing file just leaves a
  gap). The towers, ground and room shell are boxes and planes wearing Gemini textures in `public/world/` (see
  `manifest.json`), read through `tex(name)`.
- **Post-processing lives in `Stage.tsx` (`Finish`)**: N8AO (desktop only), bloom, vignette and ACES tone mapping as the
  last effect. Software renderers (SwiftShader, llvmpipe: what headless CI uses) skip it, drop the horizon, shrubs and half
  the trees (`low` prop) and tone-map in the renderer instead; they would otherwise draw one frame a second.
- **Walking does not depend on frame rate**: a slow frame moves you the true distance, in collision steps of at most 50 ms.
  The e2e walking tests are `test.slow()` and generous about overshoot for that reason.
- **The campus is walkable.** Arrow keys / WASD move the avatar, Shift runs, Q/E turn the camera, Enter or Space uses a
  door; a touch stick does the same on phones. `layout.ts` holds the map and the collision (`resolve`); the e2e tests
  steer the avatar by reading `data-player` on the canvas. Every tower is also reachable from the "All towers" list, so
  nothing depends on being able to walk.
- **Accounts are username + password**, PBKDF2 in the Worker, an HttpOnly session cookie, D1 tables `users` and
  `sessions`. Guests still play; signing in moves their anonymous attempts onto the account.
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
- **Accounts are optional.** A signed-in player's rows use the identity `u:<user id>` in the same `attempts`/`presence` tables (anonymous ids have no colon, so they cannot collide). The server picks the identity from the session cookie, ignoring the body's `anonId`; register/login with an `anonId` moves that visitor's attempts across and deletes the anonymous rows so stats do not double count.
- **Anonymous ids never leave the server's tables**: `/api/presence` returns avatars and rooms, never an id.
- The API's SITE_URL is only used to allow same-origin `Origin` headers; the request's own origin is always allowed.

## What is not decided

- Questions are drafts in the author's voice and **need Hao's review before they are promoted** — see `docs/CONTENT.md`.
- No custom domain yet; the site lives on workers.dev.
- No LLM grading. If added, put it behind the same `grade()` shape and keep the keyword rubric as the offline fallback.
