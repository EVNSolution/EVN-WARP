# -*- coding: utf-8 -*-
import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

db_path = r'c:\문서\1. 이브이앤솔루션\20. AI\2. 목표관리시스템\evn-warp\dev.db'
conn = sqlite3.connect(db_path)

print('=== 현재 팀 목록 ===')
for row in conn.execute('SELECT id, name FROM "Team" ORDER BY name'):
    print(f'  {row[0]} | {row[1]}')

conn.close()
