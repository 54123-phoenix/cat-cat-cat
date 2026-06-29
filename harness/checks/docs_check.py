from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]

required = [
    "harness/roadmap.yml",
    "harness/gates.yml",
    "harness/run.ps1",
    "harness/opencode/P6-release-candidate-audit.md",
    "docs/UPGRADE_HARNESS.md",
    "docs/COLLABORATION.md",
    "docs/MODEL_HEALTH.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/DEMO_SCRIPT.md",
    "docs/OPENCODE_TASK_TEMPLATE.md",
    "docs/FINAL_ACCEPTANCE.md",
    "docs/BACKUP_RECOVERY.md",
    "docs/PERMISSIONS.md",
    "docs/OBSERVABILITY.md",
    "docs/OBSERVABILITY_RUNBOOK.md",
    "scripts/backup.ps1",
    "scripts/restore.ps1",
]

errors = [path for path in required if not (ROOT / path).exists()]

readme = (ROOT / "README.md").read_text(encoding="utf-8")
if "Quick" not in readme and "docker compose up" not in readme:
    errors.append("README.md should keep startup guidance")

stale_readme_phrases = [
    "mock AI",
    "real AI model is not connected",
    "model is not connected",
]

for phrase in stale_readme_phrases:
    if phrase.lower() in readme.lower():
        errors.append(f"README.md has stale AI wording: {phrase}")

final_acceptance = (ROOT / "docs/FINAL_ACCEPTANCE.md").read_text(encoding="utf-8")
for token in (
    "Release Candidate Goal",
    "Acceptance Checklist",
    "Manual Smoke Path",
    "Risk Register",
    "Next Upgrade Path",
):
    if token not in final_acceptance:
        errors.append(f"FINAL_ACCEPTANCE.md missing section: {token}")

opencode_p6 = (ROOT / "harness/opencode/P6-release-candidate-audit.md").read_text(
    encoding="utf-8"
)
for token in (
    "Allowed Changes",
    "Forbidden Changes",
    "Required Handoff Summary",
):
    if token not in opencode_p6:
        errors.append(f"P6 opencode audit task missing section: {token}")

if errors:
    print("Docs contract failed:")
    for error in errors:
        print(f"- missing or incomplete: {error}")
    sys.exit(1)

print("Docs contract passed")
