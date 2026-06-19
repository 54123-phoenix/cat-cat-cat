import os

path = os.path.join(os.path.dirname(__file__) or ".", "src", "pages", "Admin.jsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Step 1: TABS
idx = content.find("const RECORD_TYPES")
if idx >= 0:
    tabs = chr(10) + "const TABS = [" + chr(10)
    tabs += "  { key: 'cats', label: '猫档案 🐱' }," + chr(10)
    tabs += "  { key: 'health', label: '健康 🏥' }," + chr(10)
    tabs += "  { key: 'feeding', label: '喂食 🍽' }," + chr(10)
    tabs += "  { key: 'reports', label: '举报 ⚠' }," + chr(10)
    tabs += "  { key: 'sightings', label: '偶遇 👣' }," + chr(10)
    tabs += "]" + chr(10) + chr(10)
    content = content[:idx] + tabs + content[idx:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Admin: step 1 done")
