import sqlite3

db_path = r'c:\문서\1. 이브이앤솔루션\20. AI\2. 목표관리시스템\evn-warp\prisma\dev.db'
conn = sqlite3.connect(db_path)

tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables:', [t[0] for t in tables])

# 팀 테이블 이름 찾기
for t in tables:
    if 'team' in t[0].lower():
        print(f'\n{t[0]} 내용:')
        for row in conn.execute(f'SELECT * FROM "{t[0]}" ORDER BY name'):
            print(' ', row)

conn.close()
