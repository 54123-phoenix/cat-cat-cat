Task: Fix the Docker deployment data issues for the cat community app.

Context: The Docker images contain an old database with 37 cats (20 real + 17 mock English-name cats). The mock cats have broken image references and no location data, making the app look cluttered.

The local development database at D:/Desktop/cat/cat-backend/cat_community.db was already cleaned to only have 20 real cats. But the Docker image was built with an older version of the DB.

Goal: Clean the data and rebuild Docker images.

Steps:

1. First, connect to the SQLite database at D:/Desktop/cat/cat-backend/cat_community.db and verify the current state.

2. Remove all mock English-name cats (name like Amber, Awu, Baguette, Chewy, Coco, Curry, DarkChocolate, Glaze, LittleStick, Meimei, Nana, Naonao, osmanthus, PeanutCandy, Roll, Salmon, Shasha — any cat with non-Chinese name or id > 20). Delete their sighting records, cat_images, health_records, and any related data.

3. After cleaning:
   - Verify: SELECT COUNT(*) FROM cats should return 20
   - Verify: SELECT name FROM cats should only show the Chinese-name cats (皮球, 尔康, 可可, 橙子, etc.)

4. Rebuild Docker with the clean DB:
   cd D:/Desktop/cat
   docker compose down -v
   docker compose build --no-cache 2>&1
   docker compose up -d 2>&1

5. After containers start, verify:
   curl http://localhost:8000/api/cats — should return 20 cats
   curl http://localhost:8000/api/cats/1 — should work for cat ID 1 (皮球)

6. Also check that photos load: curl -I http://localhost:8000/uploads/cats/皮球_avatar.jpg — should return 200

Note: The uploads/ directory at D:/Desktop/cat/cat-backend/uploads/cats/ should have the 200 real cat photos. Make sure they're included in the Docker build or volume mounted correctly.

Write all changes as Python scripts to avoid shell escaping issues with backticks in SQL strings. Use sqlite3 module.
