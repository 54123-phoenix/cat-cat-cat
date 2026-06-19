"""Import cat photos from meowzart_scraper into cat project.

Usage: python scripts/import_cats_from_meowzart.py

This script:
1. Copies the top N cat photos into cat-backend/uploads/cats/
2. Creates cat records in SQLite database with name, color, location, personality
3. Creates cat_image records for each photo
"""

import os
import sys
import shutil
import sqlite3
import json
import re
from pathlib import Path
from datetime import datetime

# ─── Paths ──────────────────────────────────────────────────────────────
PROJECT_DIR = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_DIR / "cat-backend"
MEOWZART_DIR = Path("D:/Desktop/meowzart_scraper/output/cats")
UPLOAD_DIR = BACKEND_DIR / "uploads" / "cats"
DB_PATH = BACKEND_DIR / "cat_community.db"

# FDU campus locations for cat placement
CAMPUS_LOCATIONS = [
    "光华楼", "三教", "四教", "五教", "六教",
    "文图", "理图", "南区食堂", "北区食堂", "旦苑食堂",
    "东区草坪", "南区", "北区", "本部", "江湾校区",
    "邯之韵", "子彬院", "相辉堂", "燕园", "曦园",
    "校史馆", "正大体育馆", "光草", "本超",
]

# Color patterns for Chinese cat colors
COLOR_PATTERNS = [
    (r"橘", "橘白"),
    (r"白", "纯白"),
    (r"黑", "纯黑"),
    (r"三花", "三花"),
    (r"狸", "狸花"),
    (r"灰", "灰"),
    (r"奶牛", "奶牛"),
    (r"玳瑁", "玳瑁"),
    (r"虎斑", "虎斑"),
    (r"皮球", "橘白"),
    (r"尔康", "橘白"),
    (r"可可", "橘白"),
    (r"橙子", "橘白"),
    (r"米线", "橘白"),
    (r"探探", "橘白"),
    (r"小浣熊", "狸花"),
    (r"闹闹", "橘白"),
    (r"火火", "橘白"),
    (r"宝娟", "橘白"),
    (r"海蓝宝", "灰白"),
    (r"牛轧糖", "橘白"),
    (r"辣子鸡", "橘白"),
    (r"港港", "橘白"),
    (r"秋衣", "灰白"),
    (r"喇叭", "橘白"),
    (r"法棍", "橘白"),
    (r"小小灰", "灰"),
]

def guess_color(name):
    for pattern, color in COLOR_PATTERNS:
        if re.search(pattern, name):
            return color
    return "待确认"

def guess_personality(name):
    templates = [
        f"{name}是复旦校园里的猫明星，性格温和亲人，深受同学们的喜爱。",
        f"{name}是光草的常客，每天晒太阳等投喂，肥嘟嘟的很可爱。",
        f"{name}性格机灵，经常在三教附近出没，同学们都认识它。",
        f"{name}是猫猫社区的活跃成员，喜欢在校园里四处巡逻。",
        f"{name}性格有点高冷，但偶尔也会撒娇，是复旦的名猫之一。",
        f"{name}很亲人也爱干净，同学们路过都会停下来摸摸它。",
        f"{name}活泼好动，喜欢和同学们玩耍，是大家的开心果。",
    ]
    return templates[hash(name) % len(templates)]

def get_max_photos_per_cat(top_limit=20):
    """Get top cat folders by photo count, limited to 20 best-photographed cats,
    and cap at max 10 photos per cat for reasonable DB size."""
    items = []
    for d in sorted(MEOWZART_DIR.iterdir()):
        if d.is_dir():
            photos = sorted(d.iterdir())
            if photos:
                items.append((len(photos), d.name, photos))
    
    items.sort(key=lambda x: x[0], reverse=True)
    
    result = []
    total = 0
    for count, name, photos in items[:top_limit]:
        # Max 10 photos per cat
        selected = photos[:min(count, 10)]
        result.append((name, selected))
        total += len(selected)
    
    print(f"Selected {len(result)} cats, {total} photos total")
    return result

def import_data():
    if not MEOWZART_DIR.exists():
        print(f"ERROR: Meowzart directory not found: {MEOWZART_DIR}")
        sys.exit(1)
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    cats = get_max_photos_per_cat(top_limit=20)
    
    # Connect to SQLite
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}. Run the backend first to create tables.")
        sys.exit(1)
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    # Check if we already have cats (skip if populated)
    existing = conn.execute("SELECT COUNT(*) FROM cats").fetchone()[0]
    if existing > 0:
        print(f"Database already has {existing} cats. Skipping cat creation.")
        # Still copy images if missing
        conn.close()
        print("Done.")
        return
    
    # Gender distribution
    genders = ["男生", "女生", "男生", "女生", "男生"]
    neutered_options = ["已绝育", "已绝育", "已绝育", "未绝育"]
    age_options = ["约1岁", "约2岁", "约3岁", "约4岁", "约5岁", "幼年", "成年"]
    
    print(f"\nImporting {len(cats)} cats...")
    
    for name, photos in cats:
        color = guess_color(name)
        personality = guess_personality(name)
        location = CAMPUS_LOCATIONS[hash(name) % len(CAMPUS_LOCATIONS)]
        gender = genders[hash(name + "g") % len(genders)]
        neutered = neutered_options[hash(name + "n") % len(neutered_options)]
        age = age_options[hash(name + "a") % len(age_options)]
        
        # Copy first photo as avatar
        avatar_relative = None
        if photos:
            ext = os.path.splitext(photos[0].name)[1] or ".jpg"
            avatar_name = f"{name}_avatar{ext}"
            dst = UPLOAD_DIR / avatar_name
            shutil.copy2(str(photos[0]), str(dst))
            avatar_relative = f"/uploads/cats/{avatar_name}"
        
        # Insert cat record
        cur = conn.execute(
            """INSERT INTO cats (name, color, gender, neutered, age_estimate, 
               personality, location, avatar, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, color, gender, neutered, age, personality, location, 
             avatar_relative, datetime.now().isoformat())
        )
        cat_id = cur.lastrowid
        
        # Insert all photos as cat_images
        for i, photo in enumerate(photos):
            ext = os.path.splitext(photo.name)[1] or ".jpg"
            img_name = f"{name}_{i}{ext}"
            dst = UPLOAD_DIR / img_name
            shutil.copy2(str(photo), str(dst))
            img_path = f"/uploads/cats/{img_name}"
            conn.execute(
                "INSERT INTO cat_images (cat_id, image_path, created_at) VALUES (?, ?, ?)",
                (cat_id, img_path, datetime.now().isoformat())
            )
        
        print(f"  Created: {name} ({len(photos)} photos, {color}, {location})")
    
    conn.commit()
    conn.close()
    
    print(f"\nDone! Imported {len(cats)} cats with photos.")
    print(f"Uploads stored in: {UPLOAD_DIR}")

if __name__ == "__main__":
    import_data()
