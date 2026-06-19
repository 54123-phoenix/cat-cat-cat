Task: Enhance the Scan page in the cat-miniprogram app with better UX

Context: This is a React app (Taro-based) for a cat community app. 
Project root: D:/Desktop/cat
Frontend dir: D:/Desktop/cat/cat-miniprogram/src/
API service: D:/Desktop/cat/cat-miniprogram/src/services/api.ts
Backend API runs at http://localhost:8000

Changes to make:

1. Add a new component at src/components/ScanAnimation.tsx that shows a "cat eye scanning" animation during recognition. Use the existing CSS animations from index.css (eye-scan-dot, scan-ring, etc). The animation should show a cute cat face with scanning eyes while waiting for API response.

2. Enhance the Scan result display: After recognition returns, instead of just showing text, show:
   - A result card with the uploaded photo thumbnail
   - Cat name and confidence percentage with a confidence bar
   - If "uncertain": show top 3 candidates as clickable cards
   - If "unknown": show a form to submit discovery (add note field)

3. Add a "quick sighting" feature: after confirmed recognition, show a bottom sheet overlay asking user to:
   - Select location (from campusLocations.ts or manual input)
   - Add a note (optional)
   - Submit to create a sighting record
   This should use the createSighting API function

4. The API endpoint is POST /api/recognize (multipart file upload), returns:
   { status: "confirmed"|"uncertain"|"unknown", cat_id, cat_name, confidence, candidates }

5. Import campusLocations from '../services/campusLocations' or create a simple array:
   ['光华楼','三教','四教','五教','六教','文图','理图','南区食堂','北区食堂','旦苑食堂','东区草坪','南区','北区','本部','光草','燕园','曦园','校史馆']

Use Tailwind-like inline styles (Taro styles) since this is a Taro project. Write clean, readable React code.
Do NOT change any existing API files or backend code.
