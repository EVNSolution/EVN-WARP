import sqlite3

db_path = r'c:\문서\1. 이브이앤솔루션\20. AI\2. 목표관리시스템\evn-warp\dev.db'
conn = sqlite3.connect(db_path)

print('=== 변경 전 팀 목록 ===')
for row in conn.execute('SELECT id, name FROM "Team" ORDER BY name'):
    print(f'  {row[0]} | {row[1]}')

conn.execute('UPDATE "Team" SET name = ? WHERE name = ?', ('제품운영팀', '제조운영팀'))
conn.execute('UPDATE "Team" SET name = ? WHERE name = ?', ('클레버팀', '시스템팀'))
conn.commit()

print('\n=== 변경 후 팀 목록 ===')
for row in conn.execute('SELECT id, name FROM "Team" ORDER BY name'):
    print(f'  {row[0]} | {row[1]}')

conn.close()
print('\n완료.')
