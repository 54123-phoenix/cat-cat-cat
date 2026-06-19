Task: Replace all remaining hardcoded empty states with the reusable EmptyState component

Context: React + Vite app at D:/Desktop/cat/cat-frontend/
EmptyState component is at: D:/Desktop/cat/cat-frontend/src/components/EmptyState.jsx
It accepts props: { icon (lucide-react component, defaults to PawPrint), title (string), description (string), action (optional {label, onClick}) }

Pages/files to update:

1. D:/Desktop/cat/cat-frontend/src/pages/Feed.jsx
   - Lines 31-38: replace hardcoded empty state div with: <EmptyState icon={Cat} title="还没有偶遇记录" description="去拍照识别页发现校园里的猫猫吧" action={{ label: "去拍第一张", onClick: () => navigate('/scan') }} />

2. D:/Desktop/cat/cat-frontend/src/pages/Notifications.jsx
   - Lines 81-85: replace hardcoded empty state with EmptyState
   - Icon: MessageCircle, title: "还没有通知", description: "当有人点赞或评论你的帖子时会通知你"

3. D:/Desktop/cat/cat-frontend/src/pages/BadgeGallery.jsx
   - Lines 122-127: replace hardcoded empty state with EmptyState
   - Icon: Medal, title: "暂无勋章数据"

4. D:/Desktop/cat/cat-frontend/src/pages/WeeklyReport.jsx
   - Lines 76-78: replace hardcoded empty state with EmptyState
   - Icon: BarChart3 (or TrendingUp), title: "暂无本周数据"

5. D:/Desktop/cat/cat-frontend/src/components/CatCard.jsx
   - Add the existing 'card-hoverable' class to the outer div so cards have hover effects. The class is defined in index.css.

6. Add a trending/popular cats section to D:/Desktop/cat/cat-frontend/src/pages/Home.jsx
   - After the weekly report section, add a "热门猫猫" section
   - Show the first 6 cats from the cats array in a grid using CatCard
   - Each CatCard is wrapped in a Link to /cats/{cat.id}

IMPORTANT:
- Import navigate from react-router-dom where needed: import { useNavigate } from 'react-router-dom'
- Import EmptyState from '../components/EmptyState'
- Run 'npm run build' after changes to verify no errors
