Task: Phase 1 - Typography Hierarchy Upgrade

Files to modify:
- D:/Desktop/cat/cat-frontend/tailwind.config.js
- D:/Desktop/cat/cat-frontend/src/index.css
- D:/Desktop/cat/cat-frontend/src/pages/Home.jsx
- D:/Desktop/cat/cat-frontend/src/pages/Profile.jsx
- D:/Desktop/cat/cat-frontend/src/pages/WeeklyReport.jsx
- D:/Desktop/cat/cat-frontend/src/pages/CatDetail.jsx
- D:/Desktop/cat/cat-frontend/src/components/BadgeCard.jsx
- D:/Desktop/cat/cat-frontend/src/components/PostCard.jsx

Changes:

1. tailwind.config.js: Add fontSize tokens between theme.extend
```js
fontSize: {
  'display-xl': ['36px', { lineHeight: '1.1', fontWeight: '800' }],
  'display-lg': ['28px', { lineHeight: '1.15', fontWeight: '800' }],
  'h1':         ['22px', { lineHeight: '1.25', fontWeight: '700' }],
  'h2':         ['18px', { lineHeight: '1.3',  fontWeight: '700' }],
  'h3':         ['16px', { lineHeight: '1.4',  fontWeight: '600' }],
  'body':       ['15px', { lineHeight: '1.6',  fontWeight: '400' }],
  'body-sm':    ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
  'caption':    ['12px', { lineHeight: '1.4',  fontWeight: '500' }],
  'overline':   ['11px', { lineHeight: '1.2',  fontWeight: '600' }],
}
```

2. index.css: body font-size to 15px

3. Home.jsx: Three stat numbers (cats.length, sightings.length, postCount) change from 'text-lg font-bold' to 'text-display-xl'. Labels change from 'text-xs text-text-secondary' to 'text-caption text-text-muted'.

4. Profile.jsx: Stat numbers (sightings, locations_count, badges_count) change from 'text-lg' or 'text-base' to 'text-display-lg'. Labels to 'text-caption text-text-muted'.

5. WeeklyReport.jsx: All stat numbers from 'text-2xl font-bold' to 'text-display-xl'. Labels from 'text-xs text-text-secondary' to 'text-caption text-text-muted'.

6. CatDetail.jsx: Cat name from 'text-3xl font-bold' to 'text-display-lg'.

7. BadgeCard.jsx: Icon container from 'w-8 h-8' to 'w-12 h-12', badge text from 'text-sm' or similar to 'text-h3'.

8. PostCard.jsx: Post content text align with new body tokens.

After changes: npm run build

IMPORTANT: Use the CAT FRONTEND at D:/Desktop/cat/cat-frontend. Do NOT edit the mini-program.