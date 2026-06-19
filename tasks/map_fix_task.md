Task: Fix the cat-miniprogram Taro app to run properly and improve the Map page

Context: Taro React app at D:/Desktop/cat/cat-miniprogram/
Backend API at http://localhost:8000 with real data (20 cats, photos at /uploads/cats/*.jpg)
Backend photos base URL: http://localhost:8000

Issues to fix:

1. The Taro mini-program app currently doesn't build/run. Check the package.json build scripts and ensure it can compile. Install deps if needed: cd D:/Desktop/cat/cat-miniprogram && npm install

2. The API service at src/services/api.ts needs to work with the real backend. Make sure the API base URL is configurable and defaults to http://localhost:8000.

3. Enhance the Map page (src/pages/map/index.tsx): 
   - Import and use Taro's map component to display cat locations
   - Add markers for each cat at their known locations (from campus coordinates)
   - When a marker is tapped, show the cat name in a callout
   - Use real sighting data from GET /api/map/heatmap?days=0&limit=100

4. The map page should show a simple list of cat markers on a static map background with cat names.

5. Fix any TypeScript/compatibility issues to get the app compiling.

Backend data structure:
- GET /api/cats returns: [{ id, name, color, location, avatar, ... }]
- GET /api/map/heatmap?days=0 returns: [{ name, latitude, longitude, count }]

Sample FDU campus coords (GCJ-02 format for high virtue map):
- 皮球: 北区 31.302, 121.504
- 尔康: 东区草坪 31.299, 121.505
- 可可: 北区食堂 31.303, 121.503
- 橙子: 本超 31.301, 121.501
- 米线: 邯之韵 31.300, 121.500
- 小小灰: 光草 31.300, 121.506

Make the code compile. Focus on getting it building and the map working.
