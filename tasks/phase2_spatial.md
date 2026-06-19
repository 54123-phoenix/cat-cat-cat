Task: Phase 2 - Spatial Depth (background gradient, card shadow+ring, unified border-radius)

Files to modify:
- D:/Desktop/cat/cat-frontend/tailwind.config.js
- D:/Desktop/cat/cat-frontend/src/index.css
- D:/Desktop/cat/cat-frontend/src/components/Layout.jsx
- D:/Desktop/cat/cat-frontend/src/components/CatCard.jsx
- D:/Desktop/cat/cat-frontend/src/components/PostCard.jsx
- D:/Desktop/cat/cat-frontend/src/components/FeedItem.jsx
- D:/Desktop/cat/cat-frontend/src/components/PageHeader.jsx
- D:/Desktop/cat/cat-frontend/src/pages/Gallery.jsx

Changes:

1. tailwind.config.js: Add to theme.extend:

```js
boxShadow: {
  'e1': '0 1px 2px rgb(17 12 9 / 0.04)',
  'e2': '0 2px 8px -2px rgb(17 12 9 / 0.08), 0 1px 2px rgb(17 12 9 / 0.04)',
  'e3': '0 8px 24px -8px rgb(17 12 9 / 0.12), 0 2px 6px -2px rgb(17 12 9 / 0.06)',
  'e4': '0 16px 40px -12px rgb(17 12 9 / 0.16)',
  'primary-glow': '0 8px 24px -4px rgb(249 115 22 / 0.35)',
},
borderRadius: {
  'tile': '12px',
  'card': '16px',
  'container': '20px',
  'pill': '9999px',
},
backgroundImage: {
  'page-warm': 'linear-gradient(180deg, #FFF9F5 0%, #FFF2EA 100%)',
},
colors: {
  'surface-0': '#FFF9F5',
  'surface-1': '#FFFFFF',
  'surface-2': '#FAFAF9',
  'surface-3': '#F5F5F4',
}
```

2. index.css: 
- .card: remove border, add 'ring-1 ring-stone-900/5', shadow-e1, rounded-card(16px)
- .clay-card: keep as is (already 20px)
- .tab-bar: remove border-top, add shadow-e2 + ring-1 ring-stone-900/5
- body: remove background-color (will be handled by Layout)

3. Layout.jsx: root div 'bg-warm-50' -> 'bg-page-warm', header 'bg-warm-50/80' -> 'bg-surface-0/80'

4. CatCard.jsx: 'rounded-2xl' -> 'rounded-card', add 'ring-1 ring-stone-900/5 shadow-e1', hover: 'shadow-e2 -translate-y-0.5'

5. PostCard.jsx: 'border border-gray-100 rounded-xl' -> 'ring-1 ring-stone-900/5 shadow-e1 rounded-card'

6. FeedItem.jsx: Same as PostCard - replace border with ring+shadow

7. Gallery.jsx: Grid image containers: same ring+shadow treatment

8. Global: Replace all card 'rounded-xl'/'rounded-2xl'/'rounded-3xl' with 'rounded-card'/'rounded-container'

After: npm run build