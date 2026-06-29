from pathlib import Path
import sys

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
if "startswith(os.path.normpath(UPLOAD_DIR))" not in main:
    errors.append("upload file serving should guard against path traversal")

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
