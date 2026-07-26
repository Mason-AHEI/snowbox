#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sqlite3
import json
import os

# 读取本地 SQLite 数据库
db_path = 'users.db'

if not os.path.exists(db_path):
    print(f"错误：找不到数据库文件 {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 导出所有数据
print("正在导出数据...")

# 1. 导出用户
cursor.execute('SELECT * FROM users')
users = []
for row in cursor.fetchall():
    users.append(dict(row))
print(f"导出了 {len(users)} 个用户")

# 2. 导出存档分组
cursor.execute('SELECT * FROM save_groups')
save_groups = []
for row in cursor.fetchall():
    save_groups.append(dict(row))
print(f"导出了 {len(save_groups)} 个存档分组")

# 3. 导出存档
cursor.execute('SELECT * FROM saves')
saves = []
for row in cursor.fetchall():
    saves.append(dict(row))
print(f"导出了 {len(saves)} 个存档")

# 4. 导出游戏
cursor.execute('SELECT * FROM games')
games = []
for row in cursor.fetchall():
    games.append(dict(row))
print(f"导出了 {len(games)} 个游戏")

# 5. 导出库
cursor.execute('SELECT * FROM library')
library = []
for row in cursor.fetchall():
    library.append(dict(row))
print(f"导出了 {len(library)} 条库记录")

# 生成插入语句
insert_sql = []

for user in users:
    placeholders = ','.join(['?'] * len(user))
    columns = ','.join(user.keys())
    values = tuple(user.values())
    insert_sql.append(f"INSERT OR REPLACE INTO users ({columns}) VALUES {values};")

for group in save_groups:
    placeholders = ','.join(['?'] * len(group))
    columns = ','.join(group.keys())
    values = tuple(group.values())
    insert_sql.append(f"INSERT OR REPLACE INTO save_groups ({columns}) VALUES {values};")

for save in saves:
    placeholders = ','.join(['?'] * len(save))
    columns = ','.join(save.keys())
    values = tuple(save.values())
    insert_sql.append(f"INSERT OR REPLACE INTO saves ({columns}) VALUES {values};")

for game in games:
    placeholders = ','.join(['?'] * len(game))
    columns = ','.join(game.keys())
    values = tuple(game.values())
    insert_sql.append(f"INSERT OR REPLACE INTO games ({columns}) VALUES {values};")

for item in library:
    placeholders = ','.join(['?'] * len(item))
    columns = ','.join(item.keys())
    values = tuple(item.values())
    insert_sql.append(f"INSERT OR REPLACE INTO library ({columns}) VALUES {values};")

# 保存到文件
output_file = 'd1_migration.sql'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write('-- 数据迁移到 Cloudflare D1\n')
    f.write('-- 在 D1 Console 中执行此文件\n\n')
    for sql in insert_sql:
        f.write(sql + '\n')

print(f"\n数据已导出到 {output_file}")
print("\n下一步：")
print("1. 前往 Cloudflare Dashboard > Workers & Pages > D1 > snow-box-db > Console")
print("2. 复制 d1_migration.sql 的内容")
print("3. 在 Console 中粘贴并执行")
