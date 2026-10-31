# Upgrade TODO

## Current acceptance status — 2026-10-31

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
