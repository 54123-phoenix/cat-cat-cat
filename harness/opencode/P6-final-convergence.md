# P6 Final Convergence Task For Opencode

## Goal

Do the final release-candidate convergence pass while Codex quota is low. This is a conservative audit and cleanup task, not a feature task.

## Role Boundary

You are responsible for collecting evidence, finding inconsistencies, and making small documentation-only fixes if necessary.

Codex or the human maintainer remains responsible for final acceptance.

## Allowed Work

You may inspect the whole repository, but you may edit only:

- `docs/FINAL_ACCEPTANCE.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/COLLABORATION.md`
- `docs/DEMO_SCRIPT.md`
- `docs/OPENCODE_TASK_TEMPLATE.md`
- `README.md`
- `harness/TODO.md`
- `harness/roadmap.yml`
- `harness/opencode/P6-final-convergence.md`

## Forbidden Work

Do not edit:

- `cat-backend/`
- `cat-frontend/`
- `cat-miniprogram/`
- `scripts/`
- dependency files
- database files
- uploads
- model weights
- embeddings
- generated build output
- harness checks, unless Codex explicitly asks later

Do not:

- add features
- refactor code
- change API contracts
- change auth or permissions
- run a real restore
- weaken tests or harness checks
- run destructive git commands
- stage, commit, push, reset, checkout, or delete unrelated files

## Checklist

1. Confirm README, TODO, roadmap, and final acceptance docs agree on P0-P6 status.
2. Confirm the docs do not overclaim production readiness.
3. Confirm known risks are explicit:
   - SQLite single-file database
   - model threshold/sample-set limitations
   - demo-grade map coordinates
   - large frontend pages needing future component splits
   - real restore not executed
4. Confirm release checklist still requires:
   - backend tests
   - frontend tests
   - frontend build
   - full harness score 100 pass
   - manual smoke path
5. Confirm collaboration docs keep opencode as bounded implementer/auditor and Codex or maintainer as acceptance owner.
6. If anything is inconsistent, make the smallest documentation-only fix.

## Preferred Checks

Run, if available:

```powershell
python harness\checks\docs_check.py
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

If full harness is too slow or unavailable, run docs check and clearly say full harness was not run.

## Required Handoff Summary

Return this exact structure:

```text
P6 final convergence summary

Files changed:
- ...

Consistency result:
- README/TODO/roadmap/final acceptance: OK or issues found
- Production-readiness claims: OK or issues found
- Risk register: OK or issues found
- Release checklist: OK or issues found
- Collaboration boundary: OK or issues found

Checks run:
- docs_check: pass/fail/not run
- full harness: score X pass/fail/not run

Residual risks:
- ...

Recommended final Codex action:
- accept / review specific files / rerun harness / pause
```
