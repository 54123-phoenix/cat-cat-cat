Task: Fix 3 P0 bugs in the cat-frontend app. All are small, independent changes.

Context: React + Vite app at D:/Desktop/cat/cat-frontend
Backend API at http://localhost:8000 (running with 20 cats)
After all changes, run "npm run build" and fix any errors.

---

## Item 1: TabBar home icon bug

File: D:/Desktop/cat/cat-frontend/src/components/TabBar.jsx

Line 5 currently: `{ to: '/', label: '首页', icon: Camera }` — wrong, uses camera icon for home.
Fix: Change `Camera` to `Home` (import { Home, MapPin, MessageSquare, User } from 'lucide-react' — add Home to the import)

---

## Item 2: Sidebar cleanup + add dead routes

File: D:/Desktop/cat/cat-frontend/src/components/Sidebar.jsx

Current: navItems has 5 items duplicated with TabBar (首页/地图/拍照识别/社区/个人).
Fix:
- Remove all navItems that duplicate TabBar
- Replace with useful entries NOT in TabBar:
  - 通知中心 → /notifications (icon: Bell from lucide-react)
  - 勋章墙 → /badges (icon: Award)  
  - 猫猫图库 → /gallery (icon: Images)
  - 周报 → /weekly-report (icon: TrendingUp)
  - 管理端 → /admin (icon: Shield, admin only)
- Keep the user info header as a mini profile card
- Keep 退出登录 at bottom
- If the sidebar looks too empty, expand the user header to show nickname + role + small stat badges

---

## Item 3: Remove Home inline ScanView overlay

File: D:/Desktop/cat/cat-frontend/src/pages/Home.jsx

Changes:
- Remove the `showScan` state and its setter/references
- Replace the first quick action button's onClick from `() => setShowScan(true)` to `() => navigate('/scan')`
- Remove the ScanView import (import ScanView from '../components/ScanView')
- Remove the entire scan overlay section: the fixed div with ScanView + close button (around lines 296-311)
- Remove the handleCapture function (it was only used by the inline ScanView)
- Keep the activity picker section (showActivityPicker, handleActivityQuick) but it should trigger after navigate to /scan returns, not after the inline overlay. SIMPLEST FIX: just remove the activity picker too, it's overengineered for what it does. Or if you want to keep it, trigger it independently.
