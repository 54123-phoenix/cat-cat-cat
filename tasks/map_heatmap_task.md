Task: Polish the cat-frontend Map page - add heatmap data and cat markers

Context: React + Vite app at D:/Desktop/cat/cat-frontend/
Backend API at http://localhost:8000 with 20 FDU campus cats
Map page: D:/Desktop/cat/cat-frontend/src/pages/Map.jsx
API service: D:/Desktop/cat/cat-frontend/src/api.js

Changes:

1. In Map.jsx, after the map loads (AMapLoader), call the heatmap API GET /api/map/heatmap?days=0&limit=100 to get cat sighting data.

2. Add cat markers on the map using AMap.Marker. Each marker should:
   - Show a cat emoji or small paw print icon
   - Have a click handler that navigates to /cats/{cat_id}
   - Show cat name in an info window on click

3. Fetch cats from GET /api/cats (already imported via the api module) to get cat names and IDs to pair with heatmap coordinates.

4. Add a simple time filter row below the header: "24小时 | 7天 | 全部" buttons that re-fetch heatmap data with different days param.

5. IMPORTANT: Keep all existing code for the user location marker and geolocation modal. Just ADD the heatmap/cat marker features on top.

6. After making changes, run: npm run build to verify no errors.

The api module is imported as: import { getHeatmapData, getCats } from '../api'
Heatmap API returns: [{ name: string, latitude: number, longitude: number, count: number }]

Use the existing map style and patterns (AMap.Marker, AMap.LngLat).
