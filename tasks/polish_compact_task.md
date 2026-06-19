Task: Apply 5 specific visual polish items to the cat-frontend app. Each item is independent — do them all in one opencode run.

Context: React + Vite + Tailwind app at D:/Desktop/cat/cat-frontend/
Color: primary=#F97316 orange, bg=#FAFAF9 warm beige, text=#1C1917
Existing CSS classes: .card, .clay-card, .skeleton, .animate-fade-up, .animate-scale-in
CSS file: src/index.css (lots of keyframes already defined)

BACKEND API: http://localhost:8000 (running)
Photo URLs are relative like /uploads/cats/皮球_avatar.jpg
Backend serves photos from http://localhost:8000/uploads/cats/...

IMPORTANT: After all changes, run "npm run build" and fix any errors.

---

## Item 1: CatCard — gradient overlay on image, information on top

File: src/components/CatCard.jsx

Current: avatar image in a square div, name/color/location in separate p-3 below.
Change: Make the image fill the whole card. Put a gradient overlay at the bottom (linear-gradient from transparent to rgba(0,0,0,0.6)). Render the cat name, color chip, and location ON TOP of the image (white text).
- The card outer div should stay as is (or rounded-2xl)
- Add hover: translateY(-2px) + stronger shadow
- Keep the image as background, use absolute positioning for overlay and text

```jsx
// Simplified structure:
<div className="card overflow-hidden rounded-2xl group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
  <div className="aspect-square relative">
    <img src={cat.avatar} alt={cat.name} className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-3">
      <h3 className="text-white font-bold text-sm truncate">{cat.name}</h3>
      <div className="flex items-center gap-2 mt-1">
        {cat.color && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{cat.color}</span>}
        {cat.location && <span className="text-xs text-white/80">📍{cat.location}</span>}
      </div>
    </div>
  </div>
</div>
```

## Item 2: TabBar — active capsule + subtle scan ring on center button

File: src/components/TabBar.jsx

Current: active tab shows primary color text, inactive gray.
Change:
- Active tab: add a bg-orange-50 rounded-full px-3 py-1 capsule background, icon slightly larger
- Inactive tab: opacity-50
- Center scan button: add a very subtle pulsing ring behind it using the existing keyframes (animate-scan-ring or animate-breathe), very faint opacity 0.3
- All transitions use transition-all duration-300

## Item 3: Home greeting banner — warm gradient, time-aware

File: src/pages/Home.jsx

Current: greeting card has white background.
Change: Replace the white card with a gradient based on time of day:
- Morning (6-12): from-[#FFF7ED] to-[#FED7AA] (warm sunrise)
- Afternoon (12-17): from-[#FEF3C7] to-[#FFF7ED] (soft yellow)
- Evening (17-20): from-[#FFEDD5] to-[#FED7AA] (dusk)
- Night (20-6): from-[#292524] to-[#1C1917] (dark, text white)
Keep the stats cards below it white/clean. Add the PawPrint icon with animate-breathe.

## Item 4: Profile page header — gradient banner, overlapping avatar

File: src/pages/Profile.jsx

Current: User info is in a plain white card with avatar on left.
Change:
- Top: a h-28 gradient banner (from-primary to-[#EA580C]) with rounded-b-3xl
- Avatar: w-20 h-20, -mt-10 (overlapping the banner), white border (ring-4 ring-white), shadow-md
- Nickname below avatar: text-2xl font-extrabold
- Stats: keep the grid-3 layout but make them more compact
- Keep all existing data logic, error states, skeleton loading intact

## Item 5: Image loading shimmer — prevent blank flashes

File: Create a new component at src/components/ImageWithShimmer.jsx

A wrapper component for all <img> tags:
```jsx
import { useState } from 'react'

export default function ImageWithShimmer({ src, alt, className = '' }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 skeleton" />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
```

Update CatCard.jsx to use ImageWithShimmer instead of <img> for the cat avatar.
Also update any other places that load cat images (CatDetail.jsx if practical).
