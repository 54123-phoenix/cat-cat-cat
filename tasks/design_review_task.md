We are designing an upgrade plan for the frontend of a cat community app ("校园猫猫数字档案与社区"). 

The project is a React + Vite + Tailwind web app at D:/Desktop/cat/cat-frontend/.
Backend is FastAPI. We have 20 real FDU campus cats with 200 photos.

Current state after our work today:
- EmptyState component, PhotoViewer component created
- Map page with heatmap + cat markers + time filter
- Home page with weekly report + trending cats section
- Like-burst animation on post cards
- Cat cards with hover effects
- Gallery page with grid + photo viewer
- All empty states unified

We are looking for suggestions on how to further improve the VISUAL DESIGN, UI, and INTERACTION EXPERIENCE. What would make this app feel polished and impressive for a course project demo?

I need you to:

1. Read the current codebase to understand the current visual state:
   - D:/Desktop/cat/cat-frontend/src/index.css (all CSS, animations, colors)
   - D:/Desktop/cat/cat-frontend/src/pages/ (the main page files)
   - D:/Desktop/cat/cat-frontend/src/components/ (components)
   - D:/Desktop/cat/cat-frontend/tailwind.config.js or tailwind.config.ts

2. Analyze the visual design:
   - Color palette (currently orange #F97316 primary, warm beige bg #FAFAF9)
   - Typography (Inter font)
   - Card styles (clay-card with shadows, card with borders)
   - Animation system (lots of CSS keyframes already defined)
   - Layout patterns (mobile-first 375px base, bottom tab bar)

3. Design a concrete upgrade plan with 5-8 specific, implementable items. Each item should:
   - Be specific ("add a gradient hero section" not "make it look better")
   - Reference existing CSS/code if applicable ("use the existing .clay-card style")
   - Be achievable in a single opencode run
   - Focus on visual polish and interaction delight

Consider:
- Page transitions / route transitions (animate between pages)
- Micro-interactions (button press states, card lift, image loading shimmer)
- Loading states (skeleton screens already partial, can be improved)
- Color harmony (orange is warm but needs companions)
- Typography hierarchy
- Empty states visual (cat illustrations instead of just icons)
- Splash screen or hero animation
- Card redesign (images with gradient overlays, rounded corners)
- Bottom tab bar active state animation
- Scan page camera button redesign
- Profile page header design

Output format: A numbered list of 5-8 items, each with:
1. Item name
2. Files to modify
3. Specific changes (2-4 sentences)
4. Expected visual impact

Write the plan to D:/Desktop/cat/tasks/visual_upgrade_plan.md
