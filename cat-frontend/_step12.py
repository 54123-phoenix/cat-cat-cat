import os

path = os.path.join(os.path.dirname(__file__) or ".", "src", "pages", "Admin.jsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Step 1: TABS constant
idx = content.find("const RECORD_TYPES")
if idx < 0:
    print("ERROR: RECORD_TYPES not found"); exit(1)
tabs_block = chr(10) + "const TABS = [" + chr(10)
tabs_block += "  { key: 'cats', label: '猫档案 🐱' }," + chr(10)
tabs_block += "  { key: 'health', label: '健康 🏥' }," + chr(10)
tabs_block += "  { key: 'feeding', label: '喂食 🍽' }," + chr(10)
tabs_block += "  { key: 'reports', label: '举报 ⚠' }," + chr(10)
tabs_block += "  { key: 'sightings', label: '偶遇 👣' }," + chr(10)
tabs_block += "]" + chr(10) + chr(10)
content = content[:idx] + tabs_block + content[idx:]

# Step 2: Add states
old_state = "const [selectedCatId, setSelectedCatId] = useState(null)"
new_states = "const [selectedCatId, setSelectedCatId] = useState(null)" + chr(10)
new_states += "  const [adminTab, setAdminTab] = useState(\"cats\")" + chr(10)
new_states += "  const [healthCatId, setHealthCatId] = useState(null)" + chr(10)
new_states += "  const [healthCatList, setHealthCatList] = useState([])"
if old_state not in content:
    print("ERROR: selectedCatId state not found"); exit(1)
content = content.replace(old_state, new_states)

print("Admin: steps 1-2 done")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)