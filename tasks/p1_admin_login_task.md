Task: Split the Admin page into tab sections and redesign the Login page.

Context: React + Vite app at D:/Desktop/cat/cat-frontend
Files to modify:
- D:/Desktop/cat/cat-frontend/src/pages/Admin.jsx
- D:/Desktop/cat/cat-frontend/src/pages/Login.jsx
Backend API at http://localhost:8000

After all changes, run "npm run build" to verify.

---

## Part 1: Admin tabs

Current: All features (reports, cat list + form, health records, feeding points, sightings) in one long scrolling page.

Change: Add a sticky tab bar at the top of the admin page:

```
[ 猫档案 🐱 | 健康 🏥 | 喂食 🍽 | 举报 ⚠ | 偶遇 👣 ]
```

5 tabs. Use a state `const [adminTab, setAdminTab] = useState('cats')` to control visibility.

Only show the content for the selected tab. Hide all others.

**Tab: 猫档案** — Show cat list grid + edit/create form. Keep "新增猫" button inside this tab.
**Tab: 健康** — Show health records section. Put a cat selector dropdown at the top (select which cat's records to show). The selectedCatId for health is INDEPENDENT from the cat profile tab's selection.
**Tab: 喂食** — Show feeding points management only.
**Tab: 举报** — Show pending reports only.
**Tab: 偶遇** — Show recent sightings only.

IMPORTANT:
- When switching tabs, do NOT reload data for all tabs. Each tab should have its own data loading.
- The cat profile tab's selectedCatId should NOT affect other tabs.
- Tab labels should be short and fit in mobile width.

Use a simple tab bar with border-bottom style:
```jsx
<div className="flex border-b border-border sticky top-0 bg-warm-50 z-10">
  {tabs.map(t => (
    <button key={t.key} onClick={() => setAdminTab(t.key)}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        adminTab === t.key ? 'border-primary text-primary' : 'border-transparent text-text-secondary'
      }`}>
      {t.label}
    </button>
  ))}
</div>
```

## Part 2: Login page redesign

Current: Plain centered card with form fields.

Change: Add a gradient hero section above the login card:

1. Top section: A h-48 (or about 40vh) gradient background from-primary to-[#EA580C], containing:
   - A large cat paw print icon (PawPrint from lucide-react) in white/20 opacity as a decorative element
   - Title text "猫猫社区" in large white bold text
   - Subtitle "让每一只校园猫被看见" in white/70 opacity
   
2. Login card overlaps the hero section using -mt-8 negative margin. The card has:
   - backdrop-blur-md background (bg-white/90)
   - Slightly rounded (rounded-2xl)
   - The existing form fields inside

3. Keep the demo account info at bottom

4. Register mode should show the same hero area, just change the subtitle text.
