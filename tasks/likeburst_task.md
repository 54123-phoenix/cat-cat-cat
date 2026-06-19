Task: Add like-burst animation to post cards in the cat community

Context: React + Vite app at D:/Desktop/cat/cat-frontend/
The CSS has existing like-burst animations defined in index.css:
- .like-burst-item { position: absolute; font-size: 16px; pointer-events: none; }
- @keyframes like-fish-1/2/3 that animate fish emojis flying out on like
- Also has .animate-like-pop on heart button

Components to modify:

1. D:/Desktop/cat/cat-frontend/src/components/PostCard.jsx
   - When the like button is clicked (NOT yet liked), show a like-burst animation
   - Add a state like: const [burst, setBurst] = useState(null)
   - On like click, setBurst with a random id and clear it after 600ms
   - Render 3 fish/emoji elements with .like-burst-item and inline animation styles using like-fish-1, like-fish-2, like-fish-3 keyframes
   - Fish emoji to use: ['🐟', '🐠', '🐡'] or ['❤️', '💕', '🐱']
   - Each burst item has style: animation: like-fish-1 0.6s ease-out forwards (or fish-2/fish-3)
   - Position them at the clicked button location
   - Also add the animate-like-pop class to the heart icon on like

2. D:/Desktop/cat/cat-frontend/src/components/PostList.jsx
   - Verify that PostCard is the component rendering posts
   - No changes needed unless PostCard isn't the one handling likes

3. Run 'npm run build' after to verify no errors.

IMPORTANT:
- Keep all existing like logic (API call, state update) intact
- The burst is purely visual, don't change any data flow
- Use inline styles for the burst item positioning relative to the button
