Task: Fix data issues in the cat-backend API to make the map show real cat locations and restore seed data.

Context: FastAPI backend at D:/Desktop/cat/cat-backend
Database: SQLite at D:/Desktop/cat/cat-backend/cat_community.db (20 real cats)
Docker running at localhost:8000

Issues to fix:

## Issue 1: Map heatmap shows "Campus" as location instead of real names

The sightings table has location_name='Campus' for all entries. This means the heatmap API 
returns points with name='Campus' that don't match any cat.

Fix: Create a Python script that:
1. Reads all sightings from the DB
2. For each sighting, looks up the cat's location field (which has real names like "光草", "北区", "文图")
3. Updates the sighting's location_name with the cat's real location
4. Uses real FDU coordinates for each location

Known FDU campus locations with coordinates (GCJ-02):
- 光华楼: 121.5065, 31.3015
- 光草: 121.5068, 31.3005
- 三教: 121.5050, 31.2990
- 四教: 121.5060, 31.2985
- 五教: 121.5045, 31.2980
- 六教: 121.5055, 31.2975
- 文图: 121.5058, 31.3010
- 理图: 121.5062, 31.3002
- 南区食堂: 121.5040, 31.2965
- 北区食堂: 121.5070, 31.3030
- 旦苑食堂: 121.5035, 31.3000
- 东区草坪: 121.5090, 31.2995
- 南区: 121.5030, 31.2960
- 北区: 121.5075, 31.3025
- 本部: 121.5060, 31.3010
- 燕园: 121.5055, 31.3015
- 曦园: 121.5065, 31.3008
- 校史馆: 121.5063, 31.3012
- 正大体育馆: 121.5045, 31.2995
- 邯之韵: 121.5048, 31.3005
- 本超: 121.5068, 31.3012
- 江湾校区: 121.5150, 31.3150
- 子彬院: 121.5050, 31.3005
- 相辉堂: 121.5060, 31.3015

The script should UPDATE all sightings to use the cat's real location_name and coordinates.
Write this as a Python script to D:/Desktop/cat/cat-backend/fix_heatmap_locations.py and run it.

## Issue 2: Seed posts reference deleted mock cats (English names like Amber, Awu)

The posts table has 9 posts with related_cat_id pointing to cat IDs > 20 that no longer exist.

Fix: Create a Python script that:
1. Reads all posts
2. Clears related_cat_id for any post where the referenced cat doesn't exist anymore (id > 20)
3. Updates the content to remove mentions of English cat names (Amber->皮球, Awu->尔康, etc.)
OR simpler: just delete all posts and let init_mock_data regenerate them on next restart.
But init_mock_data also references English cats.

Simplest fix: Create 9 new posts that reference the 20 real cats. Write a Python script that:
1. Deletes all existing posts, post_images, post_likes, post_comments
2. Creates new posts referencing real cats (id 1-20) with matching content
Write to D:/Desktop/cat/cat-backend/fix_posts.py

## Issue 3: Posts have no images

The seed post creation in crud.py looks for files in uploads/posts/ directory. 
Copy some cat photos as post images:
1. Take the first 3 photos from uploads/cats/ directory (皮球_0.jpg, 尔康_0.jpg, etc.)
2. Copy them to uploads/posts/ with PostImage records

Do this in the same fix_posts.py script.

After all fixes, restart the Docker container (docker compose restart backend) 
and verify:
- GET /api/map/heatmap?days=0 — locations should show real names like "光草", "北区"
- GET /api/posts?limit=20 — posts should reference real cat IDs and have images

Write each script to disk and execute them. Use sqlite3 Python module.
