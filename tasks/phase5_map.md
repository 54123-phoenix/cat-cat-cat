Task: Phase 5 - Map bottom sheet + SVG cat markers

Context: React + Vite app at D:/Desktop/cat/cat-frontend
Backend API at http://localhost:8000 (20 real cats, heatmap endpoint)
Map page: D:/Desktop/cat/cat-frontend/src/pages/Map.jsx
Uses AMap (高德地图 JS API v1.4.15, key: VITE_AMAP_KEY（见 cat-frontend/.env.example，勿提交明文）)

Changes:

1. Replace emoji cat marker with SVG cat head marker. In Map.jsx, instead of:
```js
markerContent.innerHTML = `<div style="font-size:24px">🐱</div>`
```
Use an inline SVG cat head (orange stroke, white fill, 32x32). Create the SVG string inline:
```js
const catSvg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="14" fill="white" stroke="#F97316" stroke-width="2"/>
  <text x="16" y="21" text-anchor="middle" font-size="14">🐱</text>
</svg>`
const markerContent = document.createElement('div')
markerContent.innerHTML = catSvg
```

2. Add a bottom sheet overlay to the map page, below the map but above the tab bar. It should show:
- A drag handle (w-10 h-1 bg-border rounded-full mx-auto mb-3)
- Title: "附近猫咪"
- A horizontal scroll of cat cards: avatar + name + location
- Use the cats data already fetched from getCats()

Minimal implementation:
```jsx
{/* Bottom sheet */}
{nearbyCats.length > 0 && (
  <div className="absolute bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-md rounded-t-container shadow-e3 p-4 pb-20">
    <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />
    <h3 className="text-h3 font-bold text-text mb-3">附近猫咪</h3>
    <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
      {nearbyCats.map((cat) => (
        <button key={cat.id} onClick={() => navigate('/cats/' + cat.id)} className="flex-shrink-0 w-20 text-center space-y-1">
          <div className="w-16 h-16 rounded-full bg-primary-light overflow-hidden mx-auto ring-2 ring-primary/20">
            {cat.avatar ? <img src={cat.avatar} alt="" className="w-full h-full object-cover" /> : 
              <div className="w-full h-full flex items-center justify-center text-xl">🐱</div>}
          </div>
          <p className="text-xs font-medium text-text truncate">{cat.name}</p>
          {cat.location && <p className="text-[10px] text-text-muted truncate">{cat.location}</p>}
        </button>
      ))}
    </div>
  </div>
)}
```

3. After map loads, also fetch getCats() and set nearbyCats state. Sort them by... just display the first 8 cats from the API. 

4. The bottom sheet position should be "absolute bottom-0" within the map container, with pb-20 to clear the TabBar.

5. After changes, npm run build.

IMPORTANT: Use the CAT FRONTEND at D:/Desktop/cat/cat-frontend, NOT the mini-program.