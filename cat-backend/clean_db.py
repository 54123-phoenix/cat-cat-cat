import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'cat_community.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Check current state
total = c.execute('SELECT COUNT(*) FROM cats').fetchone()[0]
all_names = [r[0] for r in c.execute('SELECT name FROM cats ORDER BY id').fetchall()]
print(f'Current cats ({total}): {all_names}')

# Remove mock English-name cats (id > 20)
ids = [r[0] for r in c.execute('SELECT id FROM cats WHERE id > 20').fetchall()]
print(f'IDs to remove: {ids}')

if ids:
    for tid in ids:
        c.execute('DELETE FROM cat_images WHERE cat_id = ?', (tid,))
        c.execute('DELETE FROM sightings WHERE cat_id = ?', (tid,))
        c.execute('DELETE FROM health_records WHERE cat_id = ?', (tid,))
        c.execute('DELETE FROM user_cat_follows WHERE cat_id = ?', (tid,))
    
    c.execute('DELETE FROM post_images')
    c.execute('DELETE FROM post_likes')
    c.execute('DELETE FROM post_comments')
    c.execute('DELETE FROM reports')
    c.execute('DELETE FROM posts')
    c.execute('DELETE FROM users WHERE id > 0')
    c.execute('DELETE FROM notifications')
    c.execute('DELETE FROM audit_logs')
    c.execute('DELETE FROM cats WHERE id > 20')
    conn.commit()
    print('Removed mock data')

remaining = [r[0] for r in c.execute('SELECT name FROM cats ORDER BY id').fetchall()]
print(f'Remaining ({len(remaining)}): {remaining}')

conn.close()
