import subprocess
import json
import sys

# Read the token
with open('/d/Desktop/cat/cat-backend/demo_token.txt', 'r') as f:
    token = f.read().strip()

print(f"Token: {token[:20]}...")

# Verify heatmap API
result = subprocess.run(
    ['curl', '-s', 'http://localhost:8000/api/map/heatmap?days=0'],
    capture_output=True, text=True, timeout=10
)
data = json.loads(result.stdout)
print(f"\n=== Heatmap API ===")
print(f"Points: {len(data)}")
for item in data[:5]:
    print(f"  name={item['name']} lat={item['latitude']} lon={item['longitude']} count={item['count']}")
has_campus = any(item['name'] == 'Campus' for item in data)
print(f"  Has 'Campus' location: {has_campus}")
if len(data) > 5:
    print(f"  ... and {len(data)-5} more points")

# Verify posts API
result = subprocess.run(
    ['curl', '-s', 'http://localhost:8000/api/posts?limit=20',
     '-H', f'Authorization: Bearer {token}'],
    capture_output=True, text=True, timeout=10
)
data = json.loads(result.stdout)
print(f"\n=== Posts API ===")
print(f"Posts: {len(data)}")
for item in data:
    related_cat = item.get('relatedCat')
    cat_info = f"relatedCat={related_cat}" if related_cat else "no relatedCat"
    images = item['images']
    print(f"  id={item['id']} {cat_info} images={images} content={item['content'][:40]}...")

print("\n=== All checks passed! ===" if not has_campus else "\n=== WARNING: Some issues remain! ===")
