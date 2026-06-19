Task: Fix P0 bugs in the cat-frontend app at D:/Desktop/cat/cat-frontend

Backend API: http://localhost:8000 (Docker is running with 20 real cats)

## Bug 1: [object Object] rendering error in Gallery page

The Gallery page at D:/Desktop/cat/cat-frontend/src/pages/Gallery.jsx has a bug where an object is rendered directly in JSX, showing "[object Object]".

Fix: Read Gallery.jsx and find where an object is being interpolated in JSX template (likely {someObject} instead of {someObject.name} or JSON.stringify). Fix it by properly accessing the string property or using JSON.stringify.

Also check D:/Desktop/cat/cat-frontend/src/pages/CatDetail.jsx for similar issues — the photo viewer integration may have introduced object rendering bugs in the image array.

## Bug 2: Map page heatmap + cat markers

The Map page at D:/Desktop/cat/cat-frontend/src/pages/Map.jsx should show cat markers on the Amap.

It already has code to fetch heatmap data and create markers, but it may not be working. Read the map page and check:

1. Does it import and call GET /api/map/heatmap on backend? Available as: getHeatmapData() from '../api'
2. Does it import and call GET /api/cats? Available as: getCats() from '../api'
3. Are markers actually created on the map with the right coordinates?

The heatmap API returns: [{ name: string, latitude: number, longitude: number, count: number }]
Some known FDU campus coordinates nearby 121.5068, 31.3005 (邯郸校区):
- 皮球: 北区 31.302, 121.504
- 尔康: 东区草坪 31.299, 121.505
- 可可: 北区食堂 31.303, 121.503
- 小小灰: 光草 31.300, 121.506

Fix the map so that:
- On page load, fetch heatmap data from API
- Create AMap.Marker objects for each point
- Show cat name in an info window on marker click
- Add a time filter (24h/7d/all) that re-fetches

## After all changes

Run: npm run build

It must pass with zero errors.

⚠️ IMPORTANT: Write Python scripts to modify files (use opencode's file editing abilities). Do NOT use shell heredocs with JSX content — they will fail on Windows/MSYS due to backtick escaping.
