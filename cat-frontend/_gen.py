import sys
with open("D:/Desktop/cat/cat-frontend/src/pages/Admin.jsx", "r", encoding="utf-8") as f:
    orig = f.read()

# Insert TABS constant after RECORD_TYPES
idx_record = orig.find("const RECORD_TYPES")
idx_record_end = orig.find("]", idx_record) + 1

tabs_block = """
const TABS = [
  { key: 'cats', label: '\u732b\u6863\u6848 \U0001f431' },
  { key: 'health', label: '\u5065\u5eb7 \U0001f3e5' },
  { key: 'feeding', label: '\u5582\u98df \U0001f37d' },
  { key: 'reports', label: '\u4e3e\u62a5 \u26a0' },
  { key: 'sightings', label: '\u5076\u9047 \U0001f9e3' },
]
"""

content = orig[:idx_record_end] + tabs_block + orig[idx_record_end:]

# Add adminTab, healthCatId, healthCatList states
comp_start = content.find("export default function Admin()")
load_start = content.find("const loadData = ()", comp_start)
last_use_state = content.rfind("useState", comp_start, load_start)
eol = content.find("\n", last_use_state)
eol = content.find("\n", eol + 1)

new_states = """\n  const [adminTab, setAdminTab] = useState('cats')
  const [healthCatId, setHealthCatId] = useState(null)
  const [healthCatList, setHealthCatList] = useState([])
"""

content = content[:eol] + new_states + content[eol:]

# Remove health loading from selectCat
idx_health = content.find("const health = await getHealthRecords")
if idx_health > 0:
    line_end = content.find("\n", idx_health)
    line_end2 = content.find("\n", line_end + 1)
    content = content[:idx_health] + content[line_end2 + 1:]

# Add loadHealthRecords function
idx_health_func = content.find("async function handleAddHealthRecord")
load_health_func = """
  async function loadHealthRecords(catId) {
    if (!catId) { setHealthRecords([]); return }
    try {
      const health = await getHealthRecords(catId)
      setHealthRecords(health)
    } catch (err) { setError(err.message || '\u52a0\u8f7d\u5065\u5eb7\u8bb0\u5f55\u5931\u8d25') }
  }
"""
content = content[:idx_health_func] + load_health_func + content[idx_health_func:]

# Replace selectedCatId in health functions
content = content.replace(
    "await createHealthRecord(selectedCatId, {",
    "await createHealthRecord(healthCatId, {"
)
content = content.replace(
    "await deleteHealthRecord(selectedCatId, recordId)",
    "await deleteHealthRecord(healthCatId, recordId)"
)
content = content.replace(
    "const health = await getHealthRecords(selectedCatId)",
    "const health = await getHealthRecords(healthCatId)"
)

# Find and replace the authenticated return block
auth_start = content.rfind("return (")
depth = 0
i = auth_start + len("return (")
while i < len(content):
    if content[i] == "(":
        depth += 1
    elif content[i] == ")":
        if depth == 0:
            break
        depth -= 1
    i += 1
auth_end = i + 1

new_jsx = open("D:/Desktop/cat/cat-frontend/_new_jsx.txt", "r", encoding="utf-8").read()

content = content[:auth_start] + new_jsx + content[auth_end:]

with open("D:/Desktop/cat/cat-frontend/src/pages/Admin.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Wrote", len(content), "bytes")
print("TABS:", "const TABS" in content)
print("adminTab:", "adminTab" in content)
print("loadHealthRecords:", "loadHealthRecords" in content)
