# Opencode Task Brief: P5-05 Collaboration, Release, and Demo Docs

You are implementing a documentation-only support task for the campus cat project.

## Goal

Create practical release and demo materials that make the project easier to hand off, review, and present.

This is a parallel support task. Codex is working on core backend/model health separately. Do not touch core implementation files.

## You Should Do

Add or update documentation only:

- `docs/RELEASE_CHECKLIST.md`
- `docs/DEMO_SCRIPT.md`
- Optional: `docs/OPENCODE_TASK_TEMPLATE.md`

The docs should be concise, concrete, and usable by a maintainer.

### `docs/RELEASE_CHECKLIST.md`

Include:

- Pre-release checks
- Required harness commands
- Backend/API checks
- Frontend/build checks
- Data and upload safety checks
- Admin workflow checks
- Rollback notes
- Final sign-off checklist

### `docs/DEMO_SCRIPT.md`

Include a 5-8 minute demo path:

1. Home page and project positioning
2. Scan/recognition flow
3. Confirm or handle uncertain/unknown result
4. Cat profile and photo gallery
5. Map and route recommendation
6. Community/share loop
7. Profile contribution view
8. Admin overview and review workflow

For each step, include:

- What to show
- What to say in one or two sentences
- What can go wrong and the fallback

### Optional `docs/OPENCODE_TASK_TEMPLATE.md`

Include a reusable template for future implementation tasks:

- Objective
- Scope
- Files allowed
- Files forbidden
- Acceptance criteria
- Required tests
- Handoff summary format

## You Must Not Do

Do not modify:

- `cat-backend/`
- `cat-frontend/`
- `cat-miniprogram/`
- `harness/`
- `README.md`
- `docs/AI_INTEGRATION.md`
- `docs/COLLABORATION.md`
- dependency files such as `package.json`, lock files, or `requirements.txt`

Do not:

- Change product behavior
- Add dependencies
- Rename routes or files
- Edit tests
- Lower, skip, or bypass harness checks
- Run destructive git commands
- Commit changes unless explicitly asked by the user
- Include secrets, tokens, passwords, private paths, or local credentials

## Style Requirements

- Write in Chinese.
- Keep the docs practical and checklist-oriented.
- Avoid vague motivational text.
- Use clear headings and checkboxes where useful.
- Prefer exact commands already used by this project:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode quick -ContinueOnFailure
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode full -ContinueOnFailure
```

## Acceptance Criteria

The task is done when:

- The requested docs exist.
- The docs are specific to this project, not generic templates.
- No forbidden files were changed.
- The final handoff summary lists changed files and confirms no code files were modified.

## Handoff Summary Format

When finished, report:

```text
P5-05 documentation task complete.

Changed files:
- ...

What was added:
- ...

Checks:
- I only changed docs files.
- I did not modify backend/frontend/harness/README.
- I did not add dependencies or run destructive git commands.

Risks or follow-up:
- ...
```
