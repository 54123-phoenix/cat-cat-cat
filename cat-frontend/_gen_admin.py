import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('D:/Desktop/cat/cat-frontend/src/pages/Admin.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
part1 = content[:7232]
part2 = content[7232:8644]
part4 = content[18665:]
# New part3 with tabs
part3 = open('D:/Desktop/cat/cat-frontend/_part3.txt', 'r', encoding='utf-8').read()
new_content = part1 + part2 + part3 + part4
with open('D:/Desktop/cat/cat-frontend/src/pages/Admin.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Written', len(new_content), 'bytes')
