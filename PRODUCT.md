# Product

## Register

product

## Users

Students, campus cat volunteers, and maintainers use this app on mobile-first screens while walking around campus, checking cat records, posting sightings, and reviewing community activity.

## Product Purpose

The product helps campus cats be recognized, recorded, found on a map, discussed in the community, and managed by volunteers. Success means the core loop feels trustworthy: scan or upload, identify or gracefully degrade, record a sighting, browse a cat archive, share or discuss, and let maintainers audit changes without confusion.

## Brand Personality

Warm, reliable, and lightly playful. The interface can feel friendly and cat-aware, but standard product affordances should stay familiar and efficient.

## Current Brand Direction

The user replaced the orange default with Fudan blue on 2026-11-08. Use the university charter's RGB 14, 65, 156 (`#0E419C`) for the primary action and navigation accent, paired with white and restrained blue-tinted surfaces. Dark mode uses a lighter blue for contrast. Orange remains an optional legacy theme. Preserve the Noto Sans SC typography and real cat photography.

On 2026-11-09, three mascot concepts were generated through the visible [official FLUX.1-schnell public demo](https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell): a flat blue-and-white campus cat, a library cat, and a ceramic-style cat. The 1024×1024 originals, prompts, generation record and comparison preview are kept in the [concept directory](output/imagegen/fudan-blue/README.md). The earlier Emagen `gpt-image-2` API attempt remains an HTTP 403 failure; the successful public-demo generation is a separate result.

The initial campus-cat version has an extra chest accessory; its fourth public-demo attempt hit the guest quota and produced no revision. The user selected A's blue-and-white character with B's refined illustration style and stronger dimensional shading, then approved the [1024px local SDXL hybrid](output/imagegen/fudan-blue/hybrid/README.md) on 2026-11-09. The approved character has large ears, an asymmetric forehead patch, blue eyes, a seated pose and a fluffy blue tail with a white accent; it has no chest ornament. Web now uses its transparent full-body illustration and dedicated head crop from `cat-frontend/public/brand/` in navigation, login, the welcome area, empty states and sharing. Keep regular illustrations still; opt-in motion is reserved for feedback and respects reduced motion. The current artwork has one expression, so state is conveyed by nearby copy. Preserve semantic icons and real cat photography. Do not repurpose the university's official seal as the community mascot.

## Anti-references

Avoid asking playful preference questions before users have value from the app. Avoid broken image placeholders, repeated generic cat logos, low-detail badge icons, over-rounded decorative cards, washed-out gray text, and UI that looks like temporary demo art.

## Design Principles

- Let the main task lead: remove prompts that do not help the user complete recognition, browsing, posting, or reviewing.
- Use delight as feedback, not friction: cats, badges, and motion should reward actions or clarify state.
- Treat images as product data: if media fails, show a deliberate fallback with recovery context instead of a browser-broken image.
- Keep the visual system coherent: navigation logo, map markers, badge art, and empty states should feel like one family.
- Preserve trust over novelty: familiar controls, readable text, and clear states matter more than decorative personality.

## Accessibility & Inclusion

Target WCAG AA contrast for core text and controls. Support keyboard focus, reduced motion, clear image fallbacks, and color-independent states for badges, progress, and map markers.
