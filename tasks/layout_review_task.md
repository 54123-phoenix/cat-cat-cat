We are designing a layout/UX improvement plan for the cat community app. 

I need you to review the current codebase and provide concrete suggestions for 5 specific improvements. Read these files first:

1. D:/Desktop/cat/cat-frontend/src/pages/Home.jsx — current 8-section layout
2. D:/Desktop/cat/cat-frontend/src/pages/Login.jsx — current login page
3. D:/Desktop/cat/cat-frontend/src/pages/Admin.jsx — current admin panel
4. D:/Desktop/cat/cat-frontend/src/components/Layout.jsx — top bar + main layout
5. D:/Desktop/cat/cat-frontend/src/components/TabBar.jsx — bottom navigation
6. D:/Desktop/cat/cat-frontend/src/components/Sidebar.jsx — slide-out menu

My proposed changes:

**1. Home page restructure**: Compress 8 sections into 3 layers:
   - Banner + stats (keep as-is, already polished)
   - 3 quick action buttons (识猫/社区/地图)
   - Horizontal cat scroll (replace all cat grids + featured + trending + "认识的所有猫猫" with a single horizontal scrolling cat list, cats sorted by sighting count)

**2. Login page brand redesign**: Add a hero area above the login card:
   - Full-width gradient background (from-primary to-[#EA580C])
   - A decorative cat paw pattern or large cat icon
   - Slogan text: "让每一只校园猫被看见"
   - Login card overlaps the hero with backdrop blur

**3. Admin panel tabs**: Split the single scrolling page into tab sections:
   - 猫档案 | 健康记录 | 喂食点 | 举报审核 | 偶遇记录
   - Each tab shows only its own content
   - Clean visual separation

**4. TopBar dynamic title**: Change the hardcoded "猫猫社区" in Layout.jsx to show current page name based on route:
   - / → "猫猫社区"
   - /map → "猫猫地图" 
   - /scan → "拍照识猫"
   - /community → "猫猫社区"
   - /profile → "个人中心"
   - /admin → "管理台"
   - /feed → "偶遇动态"
   - etc.

**5. Sidebar cleanup**: Remove items duplicated in TabBar. Sidebar should only show:
   - User info header (keep)
   - 管理端 (admin only)
   - 退出登录

Please review these 5 proposals. For each one:
- Confirm if it makes sense or suggest a better approach
- Point out any potential issues or edge cases I might be missing
- Estimate the effort (simple/medium/complex)

Also suggest any additional layout/UX improvements I may have overlooked. Keep suggestions practical and focused on making the experience less cluttered, NOT adding more visual effects.

Write your analysis to D:/Desktop/cat/tasks/layout_review.md
