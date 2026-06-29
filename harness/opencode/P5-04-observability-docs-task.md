# Opencode Task Brief: P5-04 Observability Docs

You are implementing a documentation-only support task for P5-04.

## Goal

Create practical monitoring and incident-response documentation for the campus cat project. Codex will implement backend logging and harness checks separately.

## You Should Do

Add or update documentation only:

- `docs/OBSERVABILITY_RUNBOOK.md`

The document should be in Chinese and specific to this project.

Include:

- What to monitor:
  - backend health
  - model health
  - request error rate
  - slow requests
  - upload failures
  - admin/reviewer audit activity
  - backup/restore readiness
- How to inspect:
  - `GET /api/system/health`
  - `harness/reports/latest.md`
  - backend logs with request id
  - `docs/BACKUP_RECOVERY.md`
  - `docs/PERMISSIONS.md`
- Incident playbooks:
  - recognition unavailable
  - upload failures
  - admin login failures
  - database restore needed
  - frontend build failure
- Release verification checklist:
  - backend tests
  - frontend tests
  - full harness
  - model health check
  - backup dry run

## You Must Not Do

Do not modify:

- `cat-backend/`
- `cat-frontend/`
- `cat-miniprogram/`
- `harness/`
- `README.md`
- `docs/MODEL_HEALTH.md`
- `docs/BACKUP_RECOVERY.md`
- `docs/PERMISSIONS.md`
- dependency files

Do not:

- Change product behavior
- Add dependencies
- Edit tests
- Run destructive git commands
- Commit changes
- Include secrets, tokens, passwords, private paths, or credentials

## Acceptance Criteria

The task is done when:

- `docs/OBSERVABILITY_RUNBOOK.md` exists.
- It references the current project health, backup, permission, and harness docs.
- It includes concrete commands and incident steps.
- No forbidden files were changed.

## Handoff Summary Format

```text
P5-04 docs task complete.

Changed files:
- docs/OBSERVABILITY_RUNBOOK.md

What was added:
- ...

Checks:
- I only changed docs files.
- I did not modify backend/frontend/harness/README.
- I did not add dependencies or run destructive git commands.

Risks or follow-up:
- ...
```
