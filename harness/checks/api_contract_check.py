from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


errors: list[str] = []

frontend_package = json.loads(read("cat-frontend/package.json"))
for script in ("build", "test"):
    if script not in frontend_package.get("scripts", {}):
        errors.append(f"cat-frontend package.json missing script: {script}")

miniprogram_package = json.loads(read("cat-miniprogram/package.json"))
if "build:weapp" not in miniprogram_package.get("scripts", {}):
    errors.append("cat-miniprogram package.json missing build:weapp script")

ai_service = read("cat-backend/app/services/ai.py")
for state in ("confirmed", "uncertain", "unknown", "unavailable"):
    if state not in ai_service:
        errors.append(f"AI service does not mention recognize state: {state}")

schemas = read("cat-backend/app/schemas.py")
for field in ("status", "confidence", "candidates"):
    if field not in schemas:
        errors.append(f"Recognize schemas missing response field: {field}")
for field in ("ContributionStat", "contribution_score", "contribution_breakdown"):
    if field not in schemas:
        errors.append(f"User contribution schemas missing field: {field}")

if "unavailable" not in ai_service:
    errors.append("AI service should return unavailable when model runtime is missing")

auth_api = read("cat-backend/app/api/auth.py")
for token in (
    "ROLE_REVIEWER",
    "ROLE_ADMIN",
    "def require_roles",
    "def require_reviewer_or_admin",
):
    if token not in auth_api:
        errors.append(f"auth role contract missing token: {token}")

model_health = read("cat-backend/app/services/model_health.py")
for token in (
    "get_model_health",
    "MODEL_PATH",
    "EMBEDDINGS_PATH",
    "RECOGNIZE_THRESHOLD_CONFIRMED",
    "RECOGNIZE_THRESHOLD_UNCERTAIN",
    "warm_model",
):
    if token not in model_health:
        errors.append(f"model health service missing token: {token}")

system_api = read("cat-backend/app/api/system.py")
for token in ("/health", "get_model_health", "warm_model"):
    if token not in system_api:
        errors.append(f"system health endpoint missing token: {token}")

main_api = read("cat-backend/app/main.py")
if "system.router" not in main_api:
    errors.append("main app should include system health router")
if "RequestLoggingMiddleware" not in main_api:
    errors.append("main app should include request logging middleware")

request_logging = read("cat-backend/app/middleware/request_logging.py")
for token in (
    "X-Request-ID",
    "request_completed",
    "request_failed",
    "duration_ms",
    "structured_log",
    "normalize_request_id",
):
    if token not in request_logging:
        errors.append(f"request logging middleware missing token: {token}")

api_client = read("cat-frontend/src/api.ts")
for symbol in (
    "recognize",
    "createSighting",
    "getSighting",
    "createDiscovery",
    "getCat",
    "getPosts",
):
    if f"function {symbol}" not in api_client:
        errors.append(f"frontend API client missing function: {symbol}")

routes = read("cat-frontend/src/constants/routes.ts")
for route in (
    "SCAN",
    "CAT_DETAIL",
    "PUBLIC_CAT",
    "SIGHTING_SHARE",
    "COMMUNITY",
    "PROFILE",
):
    if route not in routes:
        errors.append(f"frontend routes missing: {route}")

app = read("cat-frontend/src/App.tsx")
if "ProtectedRoute" not in app:
    errors.append("App should keep ProtectedRoute for authenticated surfaces")
if "ROUTES.PUBLIC_CAT" not in app:
    errors.append(
        "App should expose the public cat route outside the protected app shell"
    )
if "ROUTES.SIGHTING_SHARE" not in app:
    errors.append(
        "App should expose the sighting share route outside the protected app shell"
    )
if not (ROOT / "cat-frontend/src/pages/PublicCat.tsx").exists():
    errors.append("Public cat page is missing")
if not (ROOT / "cat-frontend/src/pages/SightingShare.tsx").exists():
    errors.append("Sighting share page is missing")

scan_page = read("cat-frontend/src/pages/Scan.tsx")
if "phase === 'unavailable'" not in scan_page:
    errors.append("Scan page should render an unavailable recognition state")
if "识别服务暂时不可用" not in scan_page:
    errors.append("Scan page should explain unavailable recognition state to users")
if "/sightings/share/" not in scan_page:
    errors.append("Scan page should link confirmed sightings to the share page")

crud = read("cat-backend/app/crud.py")
if "def notify_cat_followers" not in crud:
    errors.append("backend should provide a shared notify_cat_followers helper")
if "def get_user_contribution_stats" not in crud:
    errors.append("backend should calculate typed user contribution stats")

user_api = read("cat-backend/app/api/user.py")
for category in ("photography", "discovery", "map", "confirmation", "guardian"):
    if category not in user_api:
        errors.append(f"leaderboard should support contribution category: {category}")

cats_api = read("cat-backend/app/api/cats.py")
if cats_api.count("create_audit_log") < 3:
    errors.append("cat create/update/delete should write audit logs")

discoveries_api = read("cat-backend/app/api/discoveries.py")
if "create_audit_log" not in discoveries_api or "before_json" not in discoveries_api:
    errors.append("discovery review should write before/after audit logs")
if "require_reviewer_or_admin" not in discoveries_api:
    errors.append("discovery review should allow reviewer/admin role")

notifications_page = read("cat-frontend/src/pages/Notifications.tsx")
if "cat_update" not in notifications_page:
    errors.append("notifications page should render followed cat update notifications")
if "isUnread" not in notifications_page:
    errors.append("notifications page should handle boolean unread state")

profile_page = read("cat-frontend/src/pages/Profile.tsx")
if "contributionBreakdown" not in profile_page:
    errors.append("profile page should show contribution breakdown")

league_page = read("cat-frontend/src/pages/League.tsx")
if "CATEGORIES" not in league_page or "category_score" not in league_page:
    errors.append("leaderboard page should support category contribution rankings")

admin_api = read("cat-backend/app/api/admin.py")
for token in (
    "/dashboard",
    "pending_discoveries",
    "hot_locations",
    "active_contributors",
    "require_reviewer_or_admin",
):
    if token not in admin_api:
        errors.append(f"admin dashboard endpoint missing token: {token}")
if "revoke_user_tokens" in admin_api and "Depends(require_admin)" not in admin_api:
    errors.append("user token revoke should stay admin-only")

posts_api = read("cat-backend/app/api/posts.py")
for token in ("require_reviewer_or_admin", "report_", "entity_type=\"report\"", "Action must be dismiss or hide"):
    if token not in posts_api:
        errors.append(f"post report moderation contract missing token: {token}")
if "getAdminDashboard" not in api_client:
    errors.append("frontend API client missing getAdminDashboard")
admin_page = read("cat-frontend/src/pages/Admin.tsx")
for token in ("overview", "dashboard", "active_contributors"):
    if token not in admin_page:
        errors.append(f"admin page missing dashboard token: {token}")

routes_api = read("cat-backend/app/api/routes.py")
for token in ("/recommendations", "time_slot", "stops", "share_path"):
    if token not in routes_api:
        errors.append(f"routes recommendation endpoint missing token: {token}")
if "getRouteRecommendations" not in api_client:
    errors.append("frontend API client missing getRouteRecommendations")
if "getSystemHealth" not in api_client:
    errors.append("frontend API client missing getSystemHealth")
routes_page = read("cat-frontend/src/pages/CatRoutes.tsx")
for token in ("time_slot", "Share2", "ROUTES.SCAN", "ROUTES.MAP"):
    if token not in routes_page:
        errors.append(f"CatRoutes page missing token: {token}")

if errors:
    print("API/core-loop contract failed:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("API/core-loop contract passed")
