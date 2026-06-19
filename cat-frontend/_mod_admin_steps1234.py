
import os

path = os.path.join(os.path.dirname(__file__) or ".", "src", "pages", "Admin.jsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Step 1: TABS constant
idx = content.find("const RECORD_TYPES")
if idx < 0:
    print("ERROR: RECORD_TYPES not found"); exit(1)
tabs_block = chr(10) + "const TABS = [" + chr(10)
tabs_block += "  { key: 'cats', label: '\u732b\u6863\u6848 \U0001f431' }," + chr(10)
tabs_block += "  { key: 'health', label: '\u5065\u5eb7 \U0001f3e5' }," + chr(10)
tabs_block += "  { key: 'feeding', label: '\u5582\u98df \U0001f37d' }," + chr(10)
tabs_block += "  { key: 'reports', label: '\u4e3e\u62a5 \u26a0' }," + chr(10)
tabs_block += "  { key: 'sightings', label: '\u5076\u9047 \U0001f463' }," + chr(10)
tabs_block += "]" + chr(10) + chr(10)
content = content[:idx] + tabs_block + content[idx:]

# Step 2: States
old_state = "const [selectedCatId, setSelectedCatId] = useState(null)"
new_states = "const [selectedCatId, setSelectedCatId] = useState(null)" + chr(10)
new_states += "  const [adminTab, setAdminTab] = useState('cats')" + chr(10)
new_states += "  const [healthCatId, setHealthCatId] = useState(null)" + chr(10)
new_states += "  const [healthCatList, setHealthCatList] = useState([])"
if old_state not in content:
    print("ERROR: selectedCatId state not found"); exit(1)
content = content.replace(old_state, new_states)

# Step 3: Update loadData - add healthCatList and loadHealthRecords
old_load = "  const loadData = () => {" + chr(10)
old_load += "    setLoading(true)" + chr(10)
old_load += "    Promise.all([getCats(), getSightings({ limit: 8 }), getReports({ status: 'pending', limit: 20 }), getFeedingPoints()])" + chr(10)
old_load += "      .then(([catsData, sightingsData, reportsData, feedingData]) => {" + chr(10)
old_load += "        setCats(Array.isArray(catsData) ? catsData : [])" + chr(10)
old_load += "        setSightings(Array.isArray(sightingsData) ? sightingsData : [])" + chr(10)
old_load += "        setReports(Array.isArray(reportsData) ? reportsData : [])" + chr(10)
old_load += "        setFeedingPoints(Array.isArray(feedingData) ? feedingData : [])" + chr(10)
old_load += "      })" + chr(10)
old_load += "      .catch((err) => setError(err.message || '\u540e\u53f0\u6570\u636e\u52a0\u8f7d\u5931\u8d25'))" + chr(10)
old_load += "      .finally(() => setLoading(false))" + chr(10)
old_load += "  }"

new_load = "  const loadData = () => {" + chr(10)
new_load += "    setLoading(true)" + chr(10)
new_load += "    Promise.all([getCats(), getSightings({ limit: 8 }), getReports({ status: 'pending', limit: 20 }), getFeedingPoints()])" + chr(10)
new_load += "      .then(([catsData, sightingsData, reportsData, feedingData]) => {" + chr(10)
new_load += "        setCats(Array.isArray(catsData) ? catsData : [])" + chr(10)
new_load += "        setHealthCatList(Array.isArray(catsData) ? catsData : [])" + chr(10)
new_load += "        setSightings(Array.isArray(sightingsData) ? sightingsData : [])" + chr(10)
new_load += "        setReports(Array.isArray(reportsData) ? reportsData : [])" + chr(10)
new_load += "        setFeedingPoints(Array.isArray(feedingData) ? feedingData : [])" + chr(10)
new_load += "      })" + chr(10)
new_load += "      .catch((err) => setError(err.message || '\u540e\u53f0\u6570\u636e\u52a0\u8f7d\u5931\u8d25'))" + chr(10)
new_load += "      .finally(() => setLoading(false))" + chr(10)
new_load += "  }" + chr(10)
new_load += "" + chr(10)
new_load += "  const loadHealthRecords = async (catId) => {" + chr(10)
new_load += "    if (!catId) { setHealthRecords([]); return }" + chr(10)
new_load += "    try {" + chr(10)
new_load += "      const records = await getHealthRecords(catId)" + chr(10)
new_load += "      setHealthRecords(records)" + chr(10)
new_load += "    } catch (err) {" + chr(10)
new_load += "      setError(err.message || '\u5065\u5eb7\u8bb0\u5f55\u52a0\u8f7d\u5931\u8d25')" + chr(10)
new_load += "    }" + chr(10)
new_load += "  }"

if old_load not in content:
    print("ERROR: old loadData not found in content")
    # Print what's near the expected location
    idx2 = content.find("const loadData = () =>")
    if idx2 >= 0:
        print("Found at index", idx2, "showing next 200 chars:")
        print(content[idx2:idx2+200])
    exit(1)
content = content.replace(old_load, new_load)

# Step 4: Add useEffect for healthCatId
old_effect = "  useEffect(() => {" + chr(10)
old_effect += "    if (!authenticated) { setLoading(false); return }" + chr(10)
old_effect += "    getAdminMe().then(loadData).catch(() => { clearAdminToken(); setAuthenticated(false); setError('\u767b\u5f55\u5df2\u8fc7\u671f'); setLoading(false) })" + chr(10)
old_effect += "  }, [authenticated])"

new_effect = old_effect + chr(10) + chr(10)
new_effect += "  useEffect(() => {" + chr(10)
new_effect += "    if (healthCatId) loadHealthRecords(healthCatId)" + chr(10)
new_effect += "  }, [healthCatId])"

if old_effect not in content:
    print("ERROR: old useEffect not found")
    exit(1)
content = content.replace(old_effect, new_effect)

print("Steps 1-4 done")
print("File length:", len(content))

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
