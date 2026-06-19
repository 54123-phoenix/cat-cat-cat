Task: Phase 6 - Animation Cleanup (remove global paw cursor, add subtle CTA sweep)

Files to modify:
- D:/Desktop/cat/cat-frontend/src/index.css
- D:/Desktop/cat/cat-frontend/src/pages/Home.jsx
- D:/Desktop/cat/cat-frontend/src/components/TabBar.jsx

Changes:

1. index.css:
- DELETE the global body cursor section (lines around 331-337 with the paw SVG cursor)
- DELETE the @media (hover: none) cursor override
- KEEP paw-ripple (it's a good click feedback, just don't add more)
- KEEP like-fish burst keyframes
- KEEP animate-scan-ring
- ADD a new btn-sweep class for the main CTA button:

```css
.btn-sweep {
  position: relative;
  overflow: hidden;
}
.btn-sweep::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.25) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
  pointer-events: none;
}
.btn-sweep:active::after {
  transform: translateX(100%);
}
```

2. Home.jsx: Add 'btn-sweep' class to the main "拍照识猫" button (the big orange gradient button).

3. TabBar.jsx: Add 'btn-sweep' to the center scan button.

Also clean up any half-step spacing values (gap-2.5, p-3.5) found across components - replace with nearest integer step (gap-2 or gap-3, p-3 or p-4).

After: npm run build