Task: Phase 3 - Color System + Token Cleanup

Files to modify:
- D:/Desktop/cat/cat-frontend/tailwind.config.js
- D:/Desktop/cat/cat-frontend/src/pages/Home.jsx
- D:/Desktop/cat/cat-frontend/src/components/PostCard.jsx
- D:/Desktop/cat/cat-frontend/src/components/Avatar.jsx
- D:/Desktop/cat/cat-frontend/src/components/FeedItem.jsx
- D:/Desktop/cat/cat-frontend/src/components/TabBar.jsx
- D:/Desktop/cat/cat-frontend/src/components/BadgeCard.jsx
- D:/Desktop/cat/cat-frontend/src/components/ConfidenceBar.jsx

Changes:

1. tailwind.config.js: Add to theme.extend.colors:
```js
mint: '#5EC8A7',
'mint-hover': '#3FAA86',
'mint-light': '#E8F7F1',
```
Also add semantic colors if not present: info: '#3B82F6', warning: '#F59E0B'

2. Home.jsx: Replace scattered color usage:
- 'bg-green-50 text-green-600' -> 'bg-mint-light text-mint'
- 'bg-blue-50 text-blue-600' -> 'bg-info/10 text-info'

3. PostCard.jsx: TOPIC_COLORS mapping:
- 'find' -> bg: primary-light, text: primary
- 'daily' -> bg: mint-light, text: mint  
- 'health' -> bg: info/10, text: info
- 'suggest' -> bg: warning/10, text: warning

4. Avatar.jsx: Avatar bg colors use mint-light, primary-light, info/10, warning/10 instead of hardcoded random tailwind colors.

5. FeedItem.jsx: 'bg-cat-warm' -> 'bg-primary-light'

6. TabBar.jsx: Active tab 'bg-orange-50' -> 'bg-primary-light'

7. BadgeCard.jsx: Badge colors if hardcoded -> use token references.

8. ConfidenceBar.jsx: Colors if hardcoded -> use semantic success/warning/danger.

After: npm run build