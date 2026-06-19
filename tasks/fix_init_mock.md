Task: Fix init_mock_data in cat-backend to stop creating English-name mock cats, and also fix the login flow to seed demo data properly.

Context: FastAPI backend at D:/Desktop/cat/cat-backend
File to modify: D:/Desktop/cat/cat-backend/app/crud.py (function init_mock_data)
Docker running, database has 20 real cats (id 1-20)

## Problem 1: init_mock_data recreates 17 English-name cats on every startup

The function at line 820+ has a hardcoded list of 17 English-name cats (Amber, Awu, Baguette, etc.). 
On each startup, `if not cat:` creates them because they were deleted.
This means the API returns 37 cats instead of 20.

Fix: 
1. Read crud.py
2. Find the init_mock_data function (around line 820)
3. REMOVE the entire `demo_cats` list (lines 821-839 "Amber" through "Shasha")
4. The function should still create the demo user and seed posts, but should NOT create any demo cats
5. Keep the code that creates the demo_user and seed posts with references to REAL cats

The seed posts after the cat list might reference English cat names too. Those should either:
- Be deleted (since we already created 9 posts via fix_posts.py)
- Or updated to reference real Chinese cat names

If `db.query(models.Post).count() == 0` — this check means it won't re-create if there are posts.
So we just need to REMOVE the demo_cats creation loop. Keep everything else.

## Problem 2 (if time): Remove demo cats from previous init_mock_data runs

After the fix, rebuild Docker and restart. Verify that GET /api/cats returns 20 cats, not 37.

## Important Notes

- Write a Python script to modify crud.py (no shell heredocs)
- After changes: docker compose build --no-cache cat-backend, then docker compose up -d
- Verify: curl http://localhost:8000/api/cats | python -c "import sys,json; print(len(json.load(sys.stdin)))"
