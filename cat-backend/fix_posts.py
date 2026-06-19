"""
fix_posts.py

Issues:
1. Posts reference deleted/mock cats (English names like Amber, Awu with IDs > 20)
2. Posts have no images

Fix:
1. Delete all existing posts, post_images, post_likes, post_comments
2. Create 9 new posts referencing real cats (id 1-20) with matching Chinese content
3. Copy cat photos as post images and create PostImage records
"""

import sqlite3
import os
import shutil
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cat_community.db')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_CATS = os.path.join(BASE_DIR, 'uploads', 'cats')
UPLOADS_POSTS = os.path.join(BASE_DIR, 'uploads', 'posts')


# 9 posts referencing real cats (1-20) with matching content
NEW_POSTS = [
    {
        'user_id': 1,
        'topic': '日常',
        'content': '今天在北区又看到皮球了！它正趴在台阶上晒太阳，眯着眼睛特别享受。路过的人都忍不住停下来摸两下 🐱',
        'related_cat_id': 1,  # 皮球
        'tags': '皮球,北区,日常',
    },
    {
        'user_id': 1,
        'topic': '日常',
        'content': '今天带同学去看尔康，结果它一路跟着我们走了小半个校园，最后还送我们到宿舍楼下。这猫是社牛吧 😂',
        'related_cat_id': 2,  # 尔康
        'tags': '尔康,东区草坪,日常',
    },
    {
        'user_id': 1,
        'topic': '求助',
        'content': '请问有人最近在北区食堂看到可可吗？它白色的毛特别显眼，已经两天没见到它了，有点担心 🤔',
        'related_cat_id': 3,  # 可可
        'tags': '可可,北区食堂,求助',
    },
    {
        'user_id': 1,
        'topic': '日常',
        'content': '橙子还是老样子，躺在本超附近晒太阳。路过的同学说它已经在那睡了三个小时了 🛌 实名羡慕',
        'related_cat_id': 4,  # 橙子
        'tags': '橙子,本超,日常',
    },
    {
        'user_id': 1,
        'topic': '求助',
        'content': '米线右前爪好像有点受伤，走路的时候不太敢着地。已经在联系猫协的同学了，希望没什么大问题 🙏',
        'related_cat_id': 5,  # 米线
        'tags': '米线,邯之韵,求助',
    },
    {
        'user_id': 1,
        'topic': '建议',
        'content': '建议在校园地图上标注一下每个喂食点的位置，方便大家去添粮。每次都要找半天才知道哪里可以喂 🗺️',
        'related_cat_id': None,
        'tags': '建议,喂食点',
    },
    {
        'user_id': 1,
        'topic': '日常',
        'content': '探探今天在文图旁边喝水，画面太治愈了！它真的是校园里最优雅的猫，走路都带着气质 ✨',
        'related_cat_id': 7,  # 探探
        'tags': '探探,本部,日常',
    },
    {
        'user_id': 1,
        'topic': '日常',
        'content': '小浣熊好像找到新据点了——旦苑食堂后面的小花园！今天看到它从那边的灌木丛里钻出来，估计以后那里也是常驻地了 🏠',
        'related_cat_id': 8,  # 小浣熊
        'tags': '小浣熊,旦苑食堂,日常',
    },
    {
        'user_id': 1,
        'topic': '日常',
        'content': '今天在六教附近看到了闹闹，它正在追蝴蝶，跑得飞快！拍了十几张照片才抓到一张清晰的。它好像又胖了一点 😅',
        'related_cat_id': 9,  # 闹闹
        'tags': '闹闹,六教,日常',
    },
]


def copy_post_images():
    """Copy some cat photos as post images."""
    if not os.path.exists(UPLOADS_POSTS):
        os.makedirs(UPLOADS_POSTS)
        print(f"Created directory: {UPLOADS_POSTS}")

    # Photos to copy: first 3 cats' _0.jpg files
    cat_photos = [
        ('皮球_0.jpg', '皮球_0.jpg'),
        ('尔康_0.jpg', '尔康_0.jpg'),
        ('可可_0.jpg', '可可_0.jpg'),
    ]

    copied = []
    for src_name, dst_name in cat_photos:
        src = os.path.join(UPLOADS_CATS, src_name)
        dst = os.path.join(UPLOADS_POSTS, dst_name)
        if os.path.exists(src):
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
                print(f"  Copied {src_name} -> uploads/posts/{dst_name}")
            else:
                print(f"  Already exists: {dst_name}")
            copied.append(f"posts/{dst_name}")
        else:
            print(f"  WARNING: Source not found: {src}")
    
    return copied


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Step 1: Delete all existing data in correct order (foreign keys)
    print("=== Step 1: Cleaning old post data ===")
    for table in ['post_images', 'post_likes', 'post_comments']:
        cur.execute(f"DELETE FROM {table}")
        print(f"  Deleted all rows from {table}")

    cur.execute("DELETE FROM posts")
    print("  Deleted all rows from posts")

    conn.commit()

    # Step 2: Create new posts
    print("\n=== Step 2: Creating new posts ===")
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    for i, post in enumerate(NEW_POSTS, start=1):
        user_id = post['user_id']
        topic = post['topic']
        content = post['content']
        tags = post['tags']
        related_cat_id = post['related_cat_id']
        
        cur.execute("""
            INSERT INTO posts (id, user_id, topic, content, tags, related_cat_id, status, likes_count, comments_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'published', 0, 0, ?, ?)
        """, (i, user_id, topic, content, tags, related_cat_id, now, now))
        
        cat_name = f"(cat_id={related_cat_id})" if related_cat_id else "(no cat)"
        print(f"  Created post id={i}: topic={topic}, {cat_name}")

    conn.commit()

    # Step 3: Copy images and create PostImage records
    print("\n=== Step 3: Adding post images ===")
    copied_images = copy_post_images()

    # Assign images to posts 1, 2, 3 (first 3 posts)
    image_assignments = [
        (1, 'posts/皮球_0.jpg', 0),
        (2, 'posts/尔康_0.jpg', 0),
        (3, 'posts/可可_0.jpg', 0),
    ]

    for post_id, img_path, sort_order in image_assignments:
        full_img_path = f"uploads/{img_path}"
        # Check if the file exists in uploads/posts/
        abs_path = os.path.join(BASE_DIR, 'uploads', 'posts', os.path.basename(img_path))
        if os.path.exists(abs_path):
            cur.execute("""
                INSERT INTO post_images (post_id, image_path, sort_order)
                VALUES (?, ?, ?)
            """, (post_id, full_img_path, sort_order))
            print(f"  Created PostImage: post_id={post_id}, path={full_img_path}")
        else:
            print(f"  WARNING: File not found for post_id={post_id}: {abs_path}")

    conn.commit()

    # Step 4: Verify
    print("\n=== Verification ===")
    cur.execute("SELECT id, related_cat_id, content[:50] FROM posts ORDER BY id")
    posts = cur.fetchall()
    print(f"Total posts: {len(posts)}")
    for p in posts:
        invalid = ""
        if p['related_cat_id'] is not None:
            cur.execute("SELECT id FROM cats WHERE id = ?", (p['related_cat_id'],))
            if not cur.fetchone():
                invalid = " [INVALID - cat does not exist!]"
        print(f"  id={p['id']} related_cat_id={p['related_cat_id']} content={p['content']}...{invalid}")

    cur.execute("SELECT COUNT(*) FROM post_images")
    img_count = cur.fetchone()[0]
    print(f"Total post_images: {img_count}")

    conn.close()
    print("\nDone!")


if __name__ == '__main__':
    main()
