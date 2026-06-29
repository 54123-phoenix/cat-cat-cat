# P6 Release Candidate Audit Task For Opencode

## Goal

Audit the release-candidate documentation and harness traceability. Make only low-risk documentation or harness-contract fixes if needed.

## Working Mode

You are an implementation assistant, not the release owner. Codex owns planning, acceptance, and final harness validation.

## Allowed Changes

You may edit only:

- `docs/FINAL_ACCEPTANCE.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/COLLABORATION.md`
- `docs/DEMO_SCRIPT.md`
- `docs/OPENCODE_TASK_TEMPLATE.md`
- `README.md`
- `harness/TODO.md`
- `harness/roadmap.yml`
- `harness/checks/docs_check.py`

## Forbidden Changes

Do not edit:

- `cat-backend/`
- `cat-frontend/`
- `cat-miniprogram/`
- `scripts/backup.ps1`
- `scripts/restore.ps1`
- dependency files such as `package.json`, lock files, or `requirements.txt`
- database files, uploads, model weights, embeddings, or generated reports

Do not run destructive commands, reset git state, delete untracked files, or weaken harness checks.

## Specific Work

1. Check that the release-candidate status is consistent across README, roadmap, TODO, and docs.
2. Check that the docs do not claim production readiness beyond what exists.
3. Check that backup/restore instructions still say real restore requires explicit confirmation.
4. Check that observability docs mention request id and structured logs without logging tokens, request bodies, or uploaded content.
5. Check that collaboration docs keep Codex as reviewer/acceptance owner and opencode as bounded implementer.
6. If you make edits, keep them small and explain why.

## Acceptance Criteria

- Documentation remains truthful and conservative.
- No product code changes.
- No dependency changes.
- `harness/checks/docs_check.py` still passes.
- Full harness should still be expected to reach `score: 100` and `pass`.

## Required Handoff Summary

Return:

```text
P6 audit summary
Files changed:
- ...

Findings:
- ...

Checks run:
- ...

Residual risks:
- ...
```
