Task: Restructure the Home page to reduce clutter and improve pacing.

Context: React + Vite app at D:/Desktop/cat/cat-frontend
File to modify: D:/Desktop/cat/cat-frontend/src/pages/Home.jsx
Backend API: http://localhost:8000

Current state: 8 sections in a vertical scroll (greeting + stats → weekly report → trending cats 2-col grid → featured cat → 3 quick actions → all cats horizontal scroll → recent sightings 3 items). Too much.

Goal: Compress to 3 clear layers.

---

## Layer 1: Banner + stats (keep as-is)
The greeting gradient banner + 3-stat grid is already polished. Keep it exactly as-is.

## Layer 2: Quick action grid (simplified)
Replace the current 3-button card grid with a 2-column layout:
- Left: large "拍照识猫" button with camera icon (orange gradient bg, white text) → navigate('/scan')
- Right: stacked mini buttons "社区" → navigate('/community') and "地图" → navigate('/map')
- Remove the weekly report card from its current position

## Layer 3: Cat horizontal scroll (single unified feed)
Replace ALL of these with ONE horizontal scroll:
- The "热门猫猫" 2-column grid
- The "featured cat hero" card  
- The "认识的所有猫猫" horizontal scroll
- The "最近偶遇" list

The single scroll should show cat avatars (96x96) with name + location below, sorted by... just display the cats array as-is for simplicity. No need for sighting_count sorting unless you can verify the backend provides it.

## Weekly report
Move weekly report data INSIDE the banner. At the bottom of the greeting banner, add a small row: "本周 N 次偶遇 · N 只猫猫" in small text, clickable to navigate('/weekly-report').

## After all changes
Keep all imports minimal. Remove unused imports at the top. Run "npm run build" to verify.
