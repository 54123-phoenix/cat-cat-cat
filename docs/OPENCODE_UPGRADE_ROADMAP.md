# Opencode Upgrade Roadmap

## Objective

Make the app attractive within the first 10 seconds, then convert that attention into repeat visits and shareable proof.

The current game layer is already a usable first pass. The next upgrade should not add more decorative features first. It should turn existing playful UI into persistent, shareable, and inspectable product value.

Primary loop:

Scan -> identify -> record sighting -> unlock proof -> share card -> return for route or collection.

## Current Baseline

Implemented:

- Cat identity card after recognition and in cat detail.
- Daily capsule.
- Route story view.
- Recent sighting pulse.
- Cat passport in badges.
- Contribution titles.
- 2.5D cat desk token.
- Campus mini scene on map.

Known direction:

- Keep delight as feedback, not a blocker.
- Prefer reusable libraries and existing dependencies.
- Use real persistence before adding heavier 3D.
- Add 3D only behind a feature flag and only when asset quality is good.

## Upgrade Order

### Phase 1: Shareable Proof

Time: 0.5 to 1 day

Goal:

Turn recognition, route completion, badge unlock, and daily capsule into one-tap share artifacts.

Reusable first:

- Use existing `html-to-image` for DOM-to-PNG export.
- Use existing `qrcode` for share QR.
- Reuse `SharePoster` where possible, but make it accept custom templates.

Tasks:

- Add `ShareArtifact` component for vertical share images.
- Add share export buttons to:
  - `CatIdentityCard`
  - `RouteStoryView` completion stamp
  - `CatPassport`
  - `DailyCapsuleModal`
- Generate PNG with title, cat image/fallback, action proof, QR, and app logo.
- Fix share URLs to BrowserRouter paths only, no `/#/`.

Acceptance:

- A user can create a share image within one tap after a confirmed scan.
- Export still works when cat avatar fails to load.
- Shared QR opens the right page.
- No new modal blocks scanning, map, or posting.

### Phase 2: Persistent Rewards

Time: 1.5 to 2 days

Goal:

Make route stamps, daily capsule rewards, and titles survive refresh and appear in profile.

Backend tasks:

- Add persistence tables or models:
  - `user_collectibles`: generic store for stamps, capsule rewards, special titles.
  - `route_checkins`: route stop completion per user.
  - `daily_capsule_claims`: one capsule claim per user per date.
- Add endpoints:
  - `POST /api/daily-capsule/claim`
  - `GET /api/users/me/collectibles`
  - `POST /api/routes/story/check-in`
  - `GET /api/routes/story/progress`
- Make daily capsule deterministic per user/date, so refresh does not reroll the reward.
- Use existing auth pattern with `require_auth`.

Frontend tasks:

- Replace local-only route checked state with backend state.
- Show collected route stamps in profile and badge/passport surfaces.
- Show daily capsule reward after claim, not merely after viewing.

Acceptance:

- Refreshing the page does not lose route check-ins.
- A user cannot claim multiple daily capsule rewards on the same date.
- Profile shows at least one collectible after a completed route or claimed capsule.
- Backend tests cover duplicate claim and route check-in idempotency.

### Phase 3: Live Campus Layer

Time: 1 to 1.5 days

Goal:

Make the map feel alive without becoming noisy.

Reusable first:

- Reuse existing event stream infrastructure if available.
- Keep current `SightingPulse`, but feed it with real events or polling dedupe.

Tasks:

- Wire recent sightings to a real follow action instead of navigation-only.
- Add a compact map overlay for route story stops.
- Add a "near me / near route" filter to the bottom cat strip.
- Add quiet dedupe: never show the same pulse twice in one session.
- Add reduced-motion fallback for all pulses.

Acceptance:

- `/map` has no console errors after skip/allow location.
- Location skip never triggers geolocation.
- Pulse cannot cover the bottom nav or primary map controls.
- Follow action actually follows the cat or hides the button.

### Phase 4: Visual Asset System

Time: 1 day

Goal:

Unify logo, markers, badges, passport stamps, and fallback images into one visual family.

Tasks:

- Create `src/components/visuals/` for shared visual primitives:
  - `CatGlyph`
  - `MapPinGlyph`
  - `StampFrame`
  - `ImageFallback`
  - `RewardMedal`
- Replace scattered emoji-first visuals with controlled icon/glyph variants.
- Add marker variants:
  - recent sighting
  - frequent zone
  - followed cat
  - route stop
- Add badge series palette and icon mapping in one config file.

Acceptance:

- Map markers are legible on the map at mobile width.
- Badge icons are distinguishable without reading text.
- All image surfaces use the same fallback component.
- Screenshots for home, scan result, map, badges, profile have no broken image icon.

### Phase 5: 3D Pilot

Time: 2 to 3 days

Goal:

Add one genuinely attractive 3D moment without bloating the first-load experience.

Decision rule:

- If good GLB assets exist, use `@google/model-viewer`.
- If the app needs custom scene interaction, use `three`, `@react-three/fiber`, and `@react-three/drei`.
- If assets are weak, keep the current 2.5D token and improve lighting/materials in CSS.

Feature flag:

- `VITE_ENABLE_3D_CAT_TOKEN=1`
- Default off until verified.

Tasks:

- Add lazy-loaded `CatToken3D`.
- Add fallback to `CatDeskToken`.
- Add one route only:
  - Cat detail token preview, or
  - Map mini scene, not both in the same first pass.
- Use one small optimized GLB asset.
- Add loading, error, and reduced-motion states.

Acceptance:

- 3D chunk is lazy-loaded.
- Canvas/model is nonblank on desktop and mobile.
- User can still open cat detail if 3D fails.
- No 3D code loads on scan/home first paint.
- Browser verification includes screenshot and console check.

### Phase 6: Campus Campaign Loop

Time: 1 to 2 days

Goal:

Turn the game layer into a repeatable event mechanic for demos and real campus use.

Tasks:

- Add weekly route themes:
  - Morning cats
  - Dining hall cats
  - Library cats
  - Newcomer discovery route
- Add shareable campaign card.
- Add admin-side route seed controls, if maintainers need curation.
- Add QR posters for route start points.

Acceptance:

- A campaign route can be opened from QR.
- Campaign completion gives a persistent collectible.
- Campaign share image includes route title, stamp, stop count, and QR.

## Recommended Reusable Projects

Use immediately:

- `html-to-image`: already installed. Best for share card export.
- `qrcode`: already installed. Best for share cards and route QR.

Use only if needed:

- `@google/model-viewer`: lowest-code GLB viewer and AR path.
- `three` + `@react-three/fiber` + `@react-three/drei`: custom interactive 3D scenes.
- `@use-gesture/react`: touch/mouse gesture control if CSS tilt becomes unreliable.
- `canvas-confetti`: badge unlock celebration only, with reduced-motion fallback.

Avoid for now:

- Heavy 3D worlds.
- Random public cat model assets with unclear license.
- New animation libraries before persistence and sharing are complete.

## Opencode Execution Prompt

Use this prompt for the next implementation pass:

```text
Implement Phase 1 and Phase 2 from docs/OPENCODE_UPGRADE_ROADMAP.md.

Constraints:
- Do not add 3D dependencies yet.
- Use existing html-to-image and qrcode for share artifacts.
- Keep daily capsule non-blocking and only on home.
- Persist route check-ins, capsule claims, and collectible rewards.
- Add backend tests for duplicate daily claim, route check-in idempotency, and collectible listing.
- Add frontend tests where practical, then run backend tests, frontend tests, and frontend build.
- Verify /, /scan, /map, /routes, /badges, /profile in browser with no application console errors.

Deliver a summary with files changed, endpoints added, tests run, and remaining risks.
```

## Review Checklist For Codex

After opencode finishes:

- Confirm all new endpoints require auth unless deliberately public.
- Confirm rewards persist across refresh and login session.
- Confirm share URLs use BrowserRouter paths.
- Confirm image fallback appears instead of broken image icons.
- Confirm map skip-location does not request geolocation.
- Confirm first-load bundle does not include optional 3D code.
- Run:
  - backend tests
  - frontend tests
  - frontend build
  - browser check for home, scan, map, routes, badges, profile

## Release Recommendation

Ship in this order:

1. Shareable proof and persistent rewards.
2. Map live layer and visual asset unification.
3. 3D pilot behind feature flag.
4. Campus campaign loop.

This keeps the shortest path to visible value while avoiding a visually weak 3D feature becoming the center of the experience.
