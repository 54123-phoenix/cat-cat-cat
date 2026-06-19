"""
fix_heatmap_locations.py

Fix sightings that have location_name='Campus' by mapping each sighting's
cat to a real FDU campus location with proper coordinates (GCJ-02).

Also fix the approximate coordinates for sightings 1-20 to use known
FDU landmark coordinates for better accuracy.

Known FDU campus locations with coordinates:
- 光华楼: 121.5065, 31.3015
- 光草: 121.5068, 31.3005
- 三教: 121.5050, 31.2990
- 四教: 121.5060, 31.2985
- 五教: 121.5045, 31.2980
- 六教: 121.5055, 31.2975
- 文图: 121.5058, 31.3010
- 理图: 121.5062, 31.3002
- 南区食堂: 121.5040, 31.2965
- 北区食堂: 121.5070, 31.3030
- 旦苑食堂: 121.5035, 31.3000
- 东区草坪: 121.5090, 31.2995
- 南区: 121.5030, 31.2960
- 北区: 121.5075, 31.3025
- 本部: 121.5060, 31.3010
- 燕园: 121.5055, 31.3015
- 曦园: 121.5065, 31.3008
- 校史馆: 121.5063, 31.3012
- 正大体育馆: 121.5045, 31.2995
- 邯之韵: 121.5048, 31.3005
- 本超: 121.5068, 31.3012
- 江湾校区: 121.5150, 31.3150
- 子彬院: 121.5050, 31.3005
- 相辉堂: 121.5060, 31.3015
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cat_community.db')

# Known FDU landmark coordinates (longitude, latitude) - GCJ-02
LOCATION_COORDS = {
    '光华楼': (121.5065, 31.3015),
    '光草': (121.5068, 31.3005),
    '三教': (121.5050, 31.2990),
    '四教': (121.5060, 31.2985),
    '五教': (121.5045, 31.2980),
    '六教': (121.5055, 31.2975),
    '文图': (121.5058, 31.3010),
    '理图': (121.5062, 31.3002),
    '南区食堂': (121.5040, 31.2965),
    '北区食堂': (121.5070, 31.3030),
    '旦苑食堂': (121.5035, 31.3000),
    '东区草坪': (121.5090, 31.2995),
    '南区': (121.5030, 31.2960),
    '北区': (121.5075, 31.3025),
    '本部': (121.5060, 31.3010),
    '燕园': (121.5055, 31.3015),
    '曦园': (121.5065, 31.3008),
    '校史馆': (121.5063, 31.3012),
    '正大体育馆': (121.5045, 31.2995),
    '邯之韵': (121.5048, 31.3005),
    '本超': (121.5068, 31.3012),
    '江湾校区': (121.5150, 31.3150),
    '子彬院': (121.5050, 31.3005),
    '相辉堂': (121.5060, 31.3015),
}

# Map for cat IDs (mock cats 21-37) to real FDU landmark names
CAT_LOCATION_MAP = {
    21: '文图',       # Amber -> 图书馆附近 -> 文图
    22: '燕园',       # Awu -> 树下 -> 燕园
    23: '燕园',       # Baguette -> 花园 -> 燕园
    24: '光草',       # Chewy -> 光草
    25: '光草',       # Coco -> 草坪 -> 光草
    26: '光草',       # Curry -> 长椅 -> 光草
    27: '光草',       # DarkChocolate -> 光草
    28: '旦苑食堂',   # Glaze -> 食堂附近 -> 旦苑食堂
    29: '本超',       # LittleStick -> 本超
    30: '北区',       # Meimei -> 北区
    31: '文图',       # Nana -> 文图
    32: '六教',       # Naonao -> 六教
    33: '燕园',       # osmanthus -> 桂花树下 -> 燕园
    34: '光草',       # PeanutCandy -> 光草
    35: '东区草坪',   # Roll -> 东区草坪
    36: '曦园',       # Salmon -> 喷泉旁 -> 曦园
    37: '曦园',       # Shasha -> 喷泉旁 -> 曦园
}


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Get all sightings that have location_name = 'Campus'
    cur.execute("SELECT id, cat_id, location_name, latitude, longitude FROM sightings WHERE location_name = 'Campus'")
    campus_sightings = cur.fetchall()
    print(f"Found {len(campus_sightings)} sightings with location_name='Campus'")

    updated = 0
    for s in campus_sightings:
        cat_id = s['cat_id']
        if cat_id in CAT_LOCATION_MAP:
            new_location = CAT_LOCATION_MAP[cat_id]
            if new_location in LOCATION_COORDS:
                lon, lat = LOCATION_COORDS[new_location]
                cur.execute(
                    "UPDATE sightings SET location_name = ?, latitude = ?, longitude = ? WHERE id = ?",
                    (new_location, lat, lon, s['id'])
                )
                print(f"  Updated sighting id={s['id']} (cat_id={cat_id}): {s['location_name']} -> {new_location} ({lat}, {lon})")
                updated += 1
            else:
                print(f"  WARNING: No coordinates for location '{new_location}' (cat_id={cat_id})")
        else:
            print(f"  WARNING: No location mapping for cat_id={cat_id} (sighting id={s['id']})")

    # Also fix the approximate coordinates for sightings 1-20 to use known landmark coords
    cur.execute("""
        SELECT s.id, s.cat_id, c.name, c.location, s.latitude, s.longitude
        FROM sightings s JOIN cats c ON s.cat_id = c.id
        WHERE s.id <= 20
    """)
    existing_sightings = cur.fetchall()
    
    fixed_coords = 0
    for s in existing_sightings:
        cat_location = s['location']  # from cats table
        if cat_location in LOCATION_COORDS:
            exact_lon, exact_lat = LOCATION_COORDS[cat_location]
            # Only update if coordinates are significantly off
            if abs(s['latitude'] - exact_lat) > 0.001 or abs(s['longitude'] - exact_lon) > 0.001:
                cur.execute(
                    "UPDATE sightings SET latitude = ?, longitude = ? WHERE id = ?",
                    (exact_lat, exact_lon, s['id'])
                )
                print(f"  Fixed coords sighting id={s['id']} cat={s['name']}: ({s['latitude']:.4f},{s['longitude']:.4f}) -> ({exact_lat},{exact_lon})")
                fixed_coords += 1
    
    conn.commit()
    print(f"\nUpdated {updated} 'Campus' sightings, fixed {fixed_coords} approximate coordinates.")
    
    # Verify
    cur.execute("SELECT COUNT(*) FROM sightings WHERE location_name = 'Campus'")
    remaining = cur.fetchone()[0]
    print(f"Remaining sightings with location_name='Campus': {remaining}")
    
    conn.close()
    print("Done!")


if __name__ == '__main__':
    main()
