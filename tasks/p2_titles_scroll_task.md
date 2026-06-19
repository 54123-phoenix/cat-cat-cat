Task: Add dynamic page titles to the TopBar and restructure the cat horizontal scroll on Home.

Context: React + Vite app at D:/Desktop/cat/cat-frontend
Files to modify:
- D:/Desktop/cat/cat-frontend/src/components/Layout.jsx
- POTENTIALLY: D:/Desktop/cat/cat-frontend/src/pages/Home.jsx (if cat scroll needs changes)

After all changes, run "npm run build" to verify.

---

## Part 1: Dynamic TopBar titles

File: D:/Desktop/cat/cat-frontend/src/components/Layout.jsx

Current: Line 65 hardcodes `<h1 className="text-lg font-bold text-text">猫猫社区</h1>`.

Change: Replace with a route-to-title mapping:

```jsx
const routeTitles = {
  '/': '猫猫社区',
  '/map': '猫猫地图',
  '/scan': '拍照识猫',
  '/community': '猫猫社区',
  '/profile': '个人中心',
  '/feed': '偶遇动态',
  '/gallery': '猫猫图库',
}
```

Use `useLocation()` to get the current pathname. Look it up in the mapping. For dynamic routes like /cats/123 and /posts/456, check with pathname.startsWith().

Implementation:
```jsx
const location = useLocation()
const getTitle = () => {
  const exact = routeTitles[location.pathname]
  if (exact) return exact
  if (location.pathname.startsWith('/cats/')) return '猫猫档案'
  if (location.pathname.startsWith('/posts/')) return '帖子详情'
  return '猫猫社区'
}
```

Replace the hardcoded h1 with `{getTitle()}`.

Also update the tabIndex mapping (lines 16-22) to use the same route map instead of if-else. Keep the existing logic functional, just cleaner.

## Part 2: Home cat horizontal scroll improvements

File: D:/Desktop/cat/cat-frontend/src/pages/Home.jsx (if not already done by other tasks)

The Layer 3 cat scroll should use 96x96 avatars (not the current 80x80) and show name + location below each cat, all in one horizontal scroll. Remove any duplicate cat sections.

Verify the Home page loads correctly after any changes.
