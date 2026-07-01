# Game Loop And Viral Experience Path

## Goal

Make the app interesting within the first 10 seconds, then keep users returning through light collection, campus movement, and shareable proof of contribution.

The game layer should strengthen the existing product loop:

scan or upload -> identify or submit clue -> record sighting -> collect cat memory -> unlock badge -> share result -> return for routes and updates.

## Design Rules

- No game prompt should block scanning, posting, browsing, or map use.
- Rewards appear after useful actions, not before the user gets value.
- Every reward must produce either a clearer next action or a shareable artifact.
- Use lightweight 3D, card motion, and collectible art before building a full 3D world.
- Failed recognition and missing images must feel handled, not broken.

## Phase 1: Instant Share Hook

### Reusable Projects First

Use mature projects before drawing or building custom 3D from scratch:

- `html-to-image`: already in the frontend dependencies. Use it for share-card export before adding another poster pipeline.
- `react-parallax-tilt`: good first choice for a lightweight collectible identity card. It gives immediate 3D-feeling interaction without a WebGL dependency.
- `@react-three/fiber` + `@react-three/drei`: use when the card needs real WebGL, orbit controls, GLTF loading, or stage lighting.
- `@google/model-viewer`: use for fast GLB display and optional AR once good model assets exist.
- `canvas-confetti` or a similarly small confetti package: consider only for badge unlock moments, with reduced-motion fallback.

Fallback rule: if reusable assets or libraries do not meet the visual bar, ship a crisp 2.5D card or SVG token rather than poor 3D art.

### 1. 3D Cat Identity Card

Trigger: recognition confirmed, sighting created, or cat detail opened.

Experience:

- A tiltable card shows cat name, campus zone, recent sighting, personality tags, and collector status.
- Card uses parallax layers first; optional Three.js version can add a rotating card plane and soft 3D token.
- One tap exports a vertical share image.

Why it works:

- It turns a normal recognition result into a collectible moment.
- It is screen-recordable and screenshot-friendly.

Implementation notes:

- opencode can own recognition result wiring.
- Codex review should verify degraded states: confirmed, uncertain, unknown, unavailable.
- No new backend schema is required for the first pass.
- Start with `react-parallax-tilt` or CSS perspective. Move to `@react-three/fiber` only if the interaction needs real lighting, mesh depth, or GLTF assets.

### 2. Daily Cat Capsule

Trigger: first meaningful action of the day: login, first scan, first sighting, or first post.

Experience:

- A small capsule opens into "today's campus cat".
- Reward can be a sticker, title, route hint, or badge progress boost.
- If the user skips it, it becomes a compact notification, not a modal.

Why it works:

- Gives the app a daily ritual without forcing onboarding questions.

## Phase 2: Campus Movement Loop

### 3. Cat Route Stories

Trigger: map page or route recommendations.

Experience:

- Map route becomes a short story: "Start near Guanghua, check the sunny steps, end near the dining hall."
- Each stop has one cat clue, confidence, time window, and a check-in button.
- Completion gives a route stamp.

Why it works:

- Converts a static map into an activity people can actually do on campus.

### 4. Live Sighting Pulse

Trigger: community or map.

Experience:

- New sightings briefly pulse on the map and feed.
- Users can follow a cat from the pulse.
- The effect should be subtle and state-based, not decorative.

Why it works:

- Makes the app feel alive during demos.

## Phase 3: Collection And Status

### 5. Cat Association Passport

Trigger: badges, profile, cat detail.

Experience:

- Badges become physical-feeling passport stamps.
- Series are grouped by job: Observer, Community, Archivist, Guardian, Special.
- Earned stamps have color, depth, and date; locked stamps show clear progress.

Why it works:

- Users understand "I am building a campus cat record" faster than a plain list.

### 6. Contribution Titles

Trigger: repeated useful actions.

Experience:

- Titles include First Spotter, Route Walker, Photo Archivist, Night Watcher, New Cat Finder.
- Titles appear on share cards and comments.

Why it works:

- Gives identity and status without heavy game mechanics.

## Phase 4: 3D And AR Upgrade

### 7. 3D Cat Desk Token

Trigger: cat detail or share page.

Experience:

- A lightweight stylized cat token can rotate, blink, or sit on a small base.
- If a good GLB model is available, use model-viewer for fast display and optional AR.
- If no model is available, keep it as a crisp 2.5D layered card rather than shipping poor 3D art.

Implementation notes:

- Use `@google/model-viewer` if the goal is reliable GLB preview and AR with the least code.
- Use `@react-three/fiber` and `@react-three/drei` if the goal is a custom interactive mini scene.

Why it works:

- High demonstration value, but only if asset quality is high.

### 8. Campus Cat Mini Scene

Trigger: special campaign or final showcase.

Experience:

- A tiny 3D campus corner with 3 to 5 cat tokens.
- Clicking a cat opens its identity card.

Why it works:

- Strong showcase effect, but should come after Phase 1 and Phase 2.

## Acceptance Checklist

- First value appears without a preference modal.
- Recognition result has a shareable card within one tap.
- Missing images show designed fallback states.
- Map markers have distinct cat/location identity and are legible on the map.
- Badges are visually collectible, not plain list rows.
- Reduced motion users can use every feature.
- The game layer never hides the core action behind animation.

## Suggested Ownership

- opencode: recognition result wiring, API field plumbing, optional model inference output fields.
- Codex: UX review, visual system, fallback states, badge and marker quality, final acceptance.
- Maintainer: approve model assets, badge naming, and release scope.
