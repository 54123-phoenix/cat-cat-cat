Task: Improve the web frontend (cat-frontend) with better UX and visual polish

Context: React + Vite app at D:/Desktop/cat/cat-frontend/
Backend API at http://localhost:8000 with real data (20 FDU campus cats with photos)

Changes needed:

1. COMPONENT: Create src/components/EmptyState.jsx - A reusable empty state component 
   Props: { icon (React component from lucide-react), title, description, action (optional {label, onClick}) }
   Use the cat paw icon (PawPrint from lucide-react) as default icon.
   Style: centered text with muted colors, consistent with the existing card styling.

2. COMPONENT: Create src/components/PhotoViewer.jsx - A full-screen photo viewer modal
   - Shows a full-screen overlay with the image centered
   - Tap to close, click backdrop to close
   - Support swipe/tap navigation for galleries
   Props: { images (array of URLs), initialIndex, onClose }

3. Fix the Home page: 
   - Add a "本周猫猫动态" (Weekly Report) section that shows stats (sightings count, unique cats, top location)
   - Use the existing WeeklyReport page style
   - Show a quick link to the weekly report page

4. Fix the Gallery page: 
   - Grid layout for cat photos from API
   - Click photo to open PhotoViewer

5. Fix the CatDetail page photo grid: Photos should be clickable to open full-screen viewer.

6. Replace ALL scattered "empty state" patterns across pages (e.g., Home, Profile, CatDetail, Community) with the new EmptyState component.

Existing CSS classes available:
- .card, .clay-card, .btn-primary, .btn-ghost
- Colors: primary=#F97316, text=#1C1917, text-secondary=#78716C, bg=#FAFAF9
- Animations: animate-fade-in, animate-scale-in, animate-slide-up

Backend APIs:
- GET /api/cats lists all cats with their images
- GET /api/cats/{id} gets cat details including images
- GET /api/user/profile gets user stats (sightings, posts, badges)
- GET /api/sightings gets recent sightings

IMPORTANT: Write production-quality React code. Test that npm run build works.
