# Final Acceptance

> **2026-11-01 status:** 43 tracked issues: 32 locally accepted, 7 pending specialty checks, 3 partial and 1 unresolved. Backend regression: 303 passed. Public recognition holdout met the empirical targets; campus acceptance remains open. Existing photo backup is truncated (ISS-043); 936 unique stills were recovered, 272 with unverified capture-date candidates. See [campus photo preparation](validation/CAMPUS_ASSETS_20261101.md). Older status paragraphs below are historical.

> **2026-10-31 status:** The current candidate has 25 locally accepted issues, 9 pending specialty checks and 3 partial items. Reference lifecycle B1–B4, 238 backend tests, four-process Redis (10 checks), and SQLite/upload recovery (4 groups) passed locally; the latest Web baseline is 66 tests. Docker engine startup, deployment integration, real model/platform validation and licensing remain open. See [C evidence](validation/OPTIMIZATION_C.md). This is not release approval; P0–P6 labels below describe historical implementation work.

> **Review update — 2026-10-30:** Source review and local verification found unresolved core-flow, authorization, data-integrity, and deployment defects. The current baseline has not passed release-candidate acceptance. See the [known-issues ledger](KNOWN_ISSUES.md) for evidence, priorities, and closure criteria. The goals and checklist below are acceptance targets, not proof of completion; passing the current tests or harness alone does not close the ledger.

This document is the release-candidate acceptance pack for the current cat community project. It is meant to keep the next iteration disciplined: prove the project is shippable before opening another large feature surface.

## Release Candidate Goal

Repair the documented defects and validate each core flow before declaring a release candidate. See [repair evidence](validation/REPAIR_PROGRESS.md) for the current working-tree results.

The release candidate is acceptable when:

- Core product loops remain stable: home golden path, recognition, sighting creation, encounter memory card, cat archive, public sharing, community, profile, admin review, dashboard, and route recommendations.
- Failure paths are understandable: unavailable model, empty data, rejected upload, unauthorized access, and moderation/audit flows.
- Operations have first-version coverage: health check, model health, request id, structured request logs, backup, restore dry run, permissions, collaboration guide, release checklist, and demo script.
- The repository has a clear handoff trail: roadmap, TODO, README, docs, and harness report agree with each other.

## Scope

In scope for P6:

- Final release-readiness audit.
- Documentation consistency fixes.
- Harness contract coverage for the final acceptance pack.
- A bounded opencode task brief for passive audit or documentation cleanup.
- No-risk polish that does not change user data, auth semantics, model thresholds, or public API contracts.
- Documentation updates that explain the current golden demo path: home entry, scan, memory card, route/map, public share, and admin review.

Historical P6 exclusions (the user-authorized repair cycle now includes additive migrations, dependencies and disposable-copy restore tests):

- New product features.
- Schema changes or migrations.
- Real restore execution.
- New dependencies.
- Git history rewrites, hard resets, or broad formatting churn.
- Replacing the current recognition model path, thresholds, or embedding format.

## Acceptance Checklist

- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Frontend build succeeds.
- [ ] Full harness reports `score: 100` and `pass`.
- [ ] The demo path shows the current highlight: home entry -> scan -> encounter memory card -> route/map -> public sharing.
- [ ] README, roadmap, TODO, and docs mention the same release status.
- [ ] `docs/RELEASE_CHECKLIST.md` still contains the manual smoke steps.
- [ ] `docs/BACKUP_RECOVERY.md` documents dry-run backup and restore behavior.
- [ ] `docs/OBSERVABILITY.md` and `docs/OBSERVABILITY_RUNBOOK.md` describe request ids, structured logs, and health triage.
- [ ] `docs/PERMISSIONS.md` explains user, reviewer, and admin role boundaries.
- [ ] `docs/COLLABORATION.md` explains the Codex/opencode handoff model.

## Manual Smoke Path

Run this path before a real demo or handoff:

1. Start backend and frontend.
2. Log in with the configured demo account.
3. Open home and verify the golden entry points to scan, routes, and map.
4. Open scan, upload a valid image, and verify confirmed, uncertain, unknown, or unavailable states render without crashing.
5. On a confirmed result, verify the encounter memory-card action is visible.
6. Open a cat detail page and a public cat page.
7. Create or inspect a sighting share page.
8. Open routes, switch time slots, open map from routes, and jump from a route stop to scan.
9. Open community and confirm post list, comments, like, and report surfaces still render.
10. Open profile and leaderboard.
11. Open admin overview and verify pending work, hot locations, contributors, and audit activity.
12. Call the system health endpoint and confirm the model-health payload is understandable.
13. Run backup/restore on a disposable copy, verify integrity and attachments; never use production data for a drill.

## Risk Register

- SQLite remains a single-file store. Real production traffic should receive a formal migration plan before multi-user deployment.
- Model quality depends on the current weights and reference embeddings. Future work should add a labeled campus sample set and threshold calibration report.
- Frontend pages are feature-rich and some are still large. Future work should split heavily edited pages into smaller components.
- External map coordinates remain demo-grade unless connected to a verified campus location source.
- SQLite WAL snapshots and the PowerShell backup/restore wrappers passed a disposable-project drill. Docker volume persistence and a deployment-size backup including uploads still need environment validation.
- opencode or other external agents may help, but Codex or the maintainer must review diff, tests, docs, and harness before acceptance.

## Next Upgrade Path

1. Deployment track: environment matrix, production secrets guide, process manager or container deployment, and external log/APM sink.
2. Data track: migration discipline, backup drill with a disposable copy, seed-data reset path, and optional PostgreSQL migration plan.
3. Model track: labeled evaluation set, threshold calibration, inference latency budget, and monitoring for unavailable/degraded states.
4. Product track: referral/source analytics, route completion telemetry, richer route storytelling, and better admin triage filters.
5. Collaboration track: issue templates, release notes, version tags, and a mandatory acceptance report per milestone.
