from pathlib import Path
import os
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


errors: list[str] = []
warnings: list[str] = []

settings = read("cat-backend/app/config/__init__.py")
for required in ("JWT_SECRET: str", "ADMIN_PASSWORD: str"):
    if required not in settings:
        errors.append(f"settings should require {required}")

main = read("cat-backend/app/main.py")
if "SecurityHeadersMiddleware" not in main:
    errors.append("SecurityHeadersMiddleware is not installed in app.main")

security_headers = read("cat-backend/app/middleware/security_headers.py")
for header in ("X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy"):
    if header not in security_headers:
        errors.append(f"security header missing: {header}")

schemas = read("cat-backend/app/schemas.py")
for validator in ("constr", "confloat"):
    if validator not in schemas:
        errors.append(f"schemas should use pydantic {validator} validation")

gitignore = read(".gitignore")
if ".env" not in gitignore:
    errors.append(".gitignore should exclude .env")

upload_related = [
    "cat-backend/app/api/upload.py",
    "cat-backend/app/api/discoveries.py",
    "cat-backend/app/api/posts.py",
    "cat-backend/app/api/cats.py",
    "cat-backend/app/api/sightings.py",
    "cat-backend/app/api/recognize.py",
]
for rel in upload_related:
    text = read(rel)
    if "UploadFile" in text and not any(marker in text for marker in ("save_upload", "validate_upload", "Image.open")):
        warnings.append(f"{rel} has upload code without obvious shared validation")

upload = read("cat-backend/app/api/upload.py")
for marker in ("MAX_UPLOAD_SIZE", "ALLOWED_IMAGE_TYPES", "ALLOWED_SUBDIRS", "Image.open", "image.verify()", "Uploaded file is empty"):
    if marker not in upload:
        errors.append(f"upload validation missing marker: {marker}")

# Prove upload containment with HTTP requests, not a source-code marker.
with tempfile.TemporaryDirectory(prefix="cat-upload-security-") as upload_dir:
    test_env = os.environ.copy()
    test_env.update({
        "DATABASE_URL": "sqlite://",
        "UPLOAD_DIR": upload_dir,
        "JWT_SECRET": "upload-security-test-secret",
        "ADMIN_PASSWORD": "upload-security-test-password",
        "INIT_DEMO_USER": "0",
    })
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_upload_serving.py", "-q", "--tb=short"],
        cwd=ROOT / "cat-backend",
        env=test_env,
        capture_output=True,
        text=True,
    )
    print(result.stdout.strip())
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.strip())
        errors.append("upload path HTTP regression tests failed (backend test dependencies are required)")

if warnings:
    print("Warnings:")
    for warning in warnings:
        print(f"- {warning}")

if errors:
    print("Security contract failed:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Security contract passed")
