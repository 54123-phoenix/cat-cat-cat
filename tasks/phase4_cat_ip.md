Task: Phase 4 - Cat Theme IP (SVG illustrations, badge icons, empty state upgrade)

Files to create/modify:
- CREATE: D:/Desktop/cat/cat-frontend/src/components/illustrations/SadCat.jsx
- CREATE: D:/Desktop/cat/cat-frontend/src/components/BadgeIcon.jsx
- MODIFY: D:/Desktop/cat/cat-frontend/src/components/EmptyState.jsx
- MODIFY: D:/Desktop/cat/cat-frontend/src/components/BadgeCard.jsx
- MODIFY: D:/Desktop/cat/cat-frontend/src/pages/BadgeGallery.jsx
- MODIFY: D:/Desktop/cat/cat-frontend/src/pages/Scan.jsx (if exists)

Changes:

1. CREATE src/components/illustrations/SadCat.jsx:
A simple SVG illustration of a sad/lonely cat. Must be:
- Pure SVG inline component
- Uses currentColor for fill/stroke so it inherits parent text color
- Simple line-art style (not complex)
- About 120x120 viewBox
- Props: className (optional), size (default 120)

The cat should be sitting, simple curves, with slightly droopy ears/tail to convey "empty".

2. CREATE src/components/BadgeIcon.jsx:
Maps badge series to emoji-like icons using inline SVG or lucide-react:
- sighting series -> PawPrint (from lucide-react)
- community series -> MessageSquare
- collect series -> render a small fish bone icon (inline SVG fish shape)
- special series -> Sparkles

Props: badge (object with { series }), size (default 24), className

3. MODIFY EmptyState.jsx:
- Change default icon from PawPrint to SadCat
- Icon wrapper from 'w-10 h-10' to 'w-16 h-16'
- Container from 'p-8' to 'p-10'
- Add 'text-text-muted/40' to icon for subtle transparency

4. MODIFY BadgeCard.jsx:
- Replace the first-letter badge display with BadgeIcon component
- Container from 'w-16 h-16' to 'w-20 h-20'
- Icon from 'w-8 h-8' to 'w-10 h-10'

5. MODIFY BadgeGallery.jsx:
- Same replacement: first-letter icon -> BadgeIcon

6. MODIFY Scan.jsx (if the file exists):
- In the idle/upload area, add a small SadCat illustration as emotional decoration next to the upload prompt
- Keep the Camera icon as primary, SadCat is secondary

After: npm run build