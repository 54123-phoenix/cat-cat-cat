# Upgrade TODO

## Fudan blue follow-up — 2026-11-08–09

- [x] Adopt official Fudan blue `#0E419C` as the default, keep orange optional, and preserve explicit theme choices without persisting an automatic default.
- [x] Recolor existing vector assets, align dark-theme surfaces and controls, and fix login/profile layout and readability at narrow widths.
- [x] Repair blank share exports and Wrapped footer overlap; verify actual light/dark PNG downloads and visible content in an isolated browser.
- [x] Final Web 175 tests, typecheck, lint, build and focused theme/login/brand browser checks passed. See [Fudan blue evidence](../docs/validation/WEB_FUDAN_BLUE_20261108.md).
- [x] Generate three 1024×1024 mascot concepts through the visible [official FLUX.1-schnell public demo](https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell) on 2026-11-09. Save originals, prompts, generation record and comparison preview in the [concept directory](../output/imagegen/fudan-blue/README.md); retain the earlier Emagen `gpt-image-2` HTTP 403 history.
- [x] Follow the user's selected A-character/B-illustration direction with stronger volume. Run local SDXL in a separate CUDA environment, remove the chest ornament and save the [1024px hybrid and process records](../output/imagegen/fudan-blue/hybrid/README.md). Public-demo quota and earlier API failures remain historical records.
- [x] User approved the hybrid. Derive transparent WebP illustrations, small head crops and browser icons; integrate into navigation, login, welcome, empty states and sharing. Check responsive geometry, dark mode, reduced motion, image failures and real exports. See [Web mascot validation](../docs/validation/WEB_MASCOT_20261109.md).

## Web UI refinement — 2026-11-08

- [x] Preserve campus orange identity while improving home hierarchy, collection search and scan form accessibility.
- [x] Add desktop navigation, keyboard-safe menu, mobile safe areas and contained map layout.
- [x] Improve feedback, text contrast and touch targets; defer the auxiliary capsule bundle.
- [x] Web 107 tests, typecheck, lint and build passed; 8 UI, 8 core and 8 reference browser checks passed. See [UI evidence](../docs/validation/WEB_UI_20261108.md).
- [x] Extend the shared UI conventions to cat details and community posting; add bounded upload thumbnails and accessible original-photo viewing. Follow-up: 146 Web tests, 26 browser groups and focused backend checks passed. See [detail/community evidence](../docs/validation/WEB_DETAIL_COMMUNITY_20261108.md).
- [x] Use locally hosted OFL Noto Sans SC subsets, align typography and controls, and verify post/comment recovery. Follow-up: 155 Web tests, 12 UI browser groups, 4 production font checks and quick harness passed. See [typography evidence](../docs/validation/WEB_TYPOGRAPHY_20261108.md).
- [ ] Measure responsive image delivery and server decode/cache capacity with real photos and devices.

## Current local repair — 2026-11-08

- [x] Web and mini-program recognition require explicit sighting submission; stable UUID retries and server content-hash checks prevent duplicate receipt/XP with an idempotency key.
- [x] Add migration `k20261108`; disposable old-database upgrade preserves records/XP. The business database has not been migrated.
- [x] Mini-program map distinguishes real empty, partial failure and total failure states; similarity is not a correctness probability.
- [x] Complete asset backup/restore supports custom SQLite/uploads/models/store, hashes, no-write previews and only new isolated restore directories; legacy mode remains compatible.
- [x] Enforce reviewed campus preparation/protocol binding before campus evaluation; preserve general/campus scopes, failed reports and release-quality=false.
- [x] Web 87 tests, mini-program 14 tests, core browser 8 groups and reference browser 8 groups passed locally.
- [x] Full harness: 6/6 passed (100), backend 396 passed. Final SQLite sidecar-path protection: 27 asset-bundle tests passed, including 6 added after full-suite collection.
- [ ] Real WeChat/device flows, target-server deployment/full restore/capacity and reviewed campus holdout: user will supply environments/data later.
- [ ] Existing photo-backup gap, remaining module/warning debt and ownership/licensing evidence.

Current ledger: 45 issues = 32 locally accepted, 9 specialty pending, 3 partial, 1 unresolved; 7 VER tracks remain scoped. Evidence: [local repair](../docs/validation/LOCAL_REPAIR_20261108.md). No release or campus-quality approval. Historical records below retain their original dates and counts.

## Existing-photo update — 2026-11-01

- [x] Offline import of the existing 94 avatars, bound by source pet ID; 92 reference photos and 2 display-only collages.
- [x] Repeated import adds no rows; prior profile edits, file ownership and database rollback are protected by focused tests.
- [x] Real-model build published 92/92 vectors; all 94 HTTP avatars/ownership checks, 3 self-match smoke checks and quick harness passed. Temporary inference containers stopped.
- Further image collection is stopped; no model retraining. Campus quality acceptance remains open.

Evidence: [photo update](../docs/validation/MEOWZART_IMPORT_20261101.md).

## Historical acceptance snapshot — 2026-10-31

The P0–P6 checkmarks below are historical implementation records, not current release approval. The source of truth is [KNOWN_ISSUES](../docs/KNOWN_ISSUES.md) and [NEXT_OPTIMIZATION_PATH](../docs/NEXT_OPTIMIZATION_PATH.md).

- [x] Core repairs and reference lifecycle B1–B4: local acceptance completed.
- [x] C: four-process Redis acceptance (10 checks) and SQLite/upload recovery (4 groups).
- [x] Backend regression: 238 passed; latest Web baseline: 66 passed.
- [ ] Docker images, Gunicorn and volume recovery: host engine startup is blocked.
- [ ] Browser reconnect state refresh, real model quality, WeChat devices, map/LLM services and licensing.
- [ ] Remaining type/module debt, warning cleanup and measured capacity targets.

See [C acceptance](../docs/validation/OPTIMIZATION_C.md). No release-candidate approval is implied by the checks above.

## Core Loop

- [x] P0-01 Recognition states and degraded experience
- [x] P0-02 Upload security and boundary validation
- [x] P0-03 Core-loop smoke harness
- [x] P0-04 Full harness backend test environment

## Sharing And Return Loop

- [x] P1-01 Public cat profile
- [x] P1-02 Sighting share page
- [x] P2-01 Followed-cat activity notifications
- [x] P2-02 Cat contribution system

## Association Workflow And Product Highlight

- [x] P3-01 Review workflow and audit log
- [x] P3-02 Admin dashboard overview
- [x] P4-01 Campus cat route recommendations

## Production Hardening

- [x] P5-01 Model health check and threshold calibration entry point
- [x] P5-02 Backup and restore first version
- [x] P5-03 Permission matrix and multi-admin audit
- [x] P5-04 Observability, request tracing, and structured logging
- [x] P5-05 Collaboration handoff, release checklist, and demo script

## Release Candidate

- [x] P6-01 Final acceptance pack and opencode audit guardrails

## Rules

- Run quick harness after every completed task.
- Run full harness before phase acceptance.
- If the score falls below 80, pause new feature work and fix stability first.
