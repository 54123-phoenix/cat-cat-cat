# Final Acceptance

This document is the release-candidate acceptance pack for the current cat community project. It is meant to keep the next iteration disciplined: prove the project is shippable before opening another large feature surface.

## Release Candidate Goal

Move the project from a feature-complete internal-trial build to a maintainable release candidate.

The release candidate is acceptable when:

- Core product loops remain stable: recognition, sighting creation, cat archive, public sharing, community, profile, admin review, dashboard, and route recommendations.
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

Out of scope for P6:

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
3. Open scan, upload a valid image, and verify confirmed, uncertain, unknown, or unavailable states render without crashing.
4. Open a cat detail page and a public cat page.
5. Create or inspect a sighting share page.
6. Open community and confirm post list, comments, like, and report surfaces still render.
7. Open profile and leaderboard.
8. Open admin overview and verify pending work, hot locations, contributors, and audit activity.
9. Open routes and switch time slots.
10. Call the system health endpoint and confirm the model-health payload is understandable.
11. Run backup dry run and restore dry run only.

## Risk Register

- SQLite remains a single-file store. Real production traffic should receive a formal migration plan before multi-user deployment.
- Model quality depends on the current weights and reference embeddings. Future work should add a labeled campus sample set and threshold calibration report.
- Frontend pages are feature-rich and some are still large. Future work should split heavily edited pages into smaller components.
- External map coordinates remain demo-grade unless connected to a verified campus location source.
- Real restore has not been executed in this release cycle. Only dry-run backup and restore have been validated. A disposable-copy restore drill should be run before production deployment.
- opencode or other external agents may help, but Codex or the maintainer must review diff, tests, docs, and harness before acceptance.

## Next Upgrade Path

1. Deployment track: environment matrix, production secrets guide, process manager or container deployment, and external log/APM sink.
2. Data track: migration discipline, backup drill with a disposable copy, seed-data reset path, and optional PostgreSQL migration plan.
3. Model track: labeled evaluation set, threshold calibration, inference latency budget, and monitoring for unavailable/degraded states.
4. Product track: share-card previews, referral/source analytics, richer route storytelling, and better admin triage filters.
5. Collaboration track: issue templates, release notes, version tags, and a mandatory acceptance report per milestone.
