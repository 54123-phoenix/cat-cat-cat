# Collaboration Playbook

This project can be advanced by multiple agents, but one source of truth must stay in charge of planning and acceptance.

## Roles

- Codex: owns planning, task slicing, guardrails, review, harness execution, and final acceptance.
- opencode (GLM): bounded implementer for scoped tasks defined in `harness/opencode/`. May only edit files listed in the task brief; cannot touch product code, dependencies, or data unless explicitly allowed.
- External implementation agents: may implement a clearly scoped task after the user runs them manually.
- Human maintainer: decides when to merge, deploy, or allow risky operations.

Codex cannot directly attach to or operate an external GLM/opencode session when that would disclose repository contents to an unapproved external model. The safe workflow is: Codex writes the task brief, the user runs the external tool, then Codex reviews the resulting diff and test report.

## Loop

1. Select one roadmap item from `harness/roadmap.yml`.
2. Write a short task brief with scope, files likely to change, acceptance criteria, and forbidden actions.
3. Let the implementation agent make the change.
4. Review changed files for scope control, data-contract drift, security risk, and UX regression.
5. Run quick harness after every task.
6. Run full harness before marking a phase complete.
7. Update `README.md`, `harness/TODO.md`, and `harness/roadmap.yml` in the same change.

## Guardrails

- Do not reset, delete, or rewrite unrelated user changes.
- Do not reduce or bypass harness checks to make a task pass.
- Do not add new dependencies unless the task truly needs them.
- Do not move model, database, or auth logic into frontend code.
- Do not expose secrets, tokens, local credentials, or private data in prompts, logs, or docs.
- Keep public APIs backward-compatible unless the roadmap explicitly calls for a breaking change.

## Done Definition

A task is complete only when:

- The feature or hardening target works end to end.
- Degraded and empty states are handled.
- Relevant backend and frontend contracts stay aligned.
- Docs and roadmap state are updated.
- Quick harness passes.
- Full harness passes for phase completion.

## Current Strategy

The project is now in a post-P4 state: the main product loop, sharing loop, return loop, admin overview, and route recommendation highlight are complete. The next path should emphasize production hardening: model health, migrations, permissions, observability, backup, and release discipline.
