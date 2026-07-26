#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 数据库重置脚本
==================================================
用途：重置本地 SQLite 数据库到初始状态
      会先备份旧数据库为 users_old.db，然后创建全新的空数据库
      并插入一个测试开发者账号和一个示例游戏

⚠️ 警告：此操作会清空所有现有数据！仅用于本地开发环境！
使用方式：python reset_db.py
"""

import sqlite3
import os
import uuid
import hashlib
import datetime

DATABASE = 'users.db'        # 当前数据库文件名
DATABASE_OLD = 'users_old.db' # 备份数据库文件名

# --- 步骤 1：备份旧数据库 ---
# 如果当前数据库存在，先备份为 users_old.db，避免数据丢失
if os.path.exists(DATABASE):
    if os.path.exists(DATABASE_OLD):
        os.remove(DATABASE_OLD)  # 删除旧备份
    os.rename(DATABASE, DATABASE_OLD)  # 重命名为备份
    print(f"已将旧数据库备份为: {DATABASE_OLD}")

# --- 步骤 2：创建全新数据库 ---
conn = sqlite3.connect(DATABASE)
c = conn.cursor()

# 创建 users 表（用户表）
c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        last_login TEXT
    )
''')

# 创建 saves 表（存档表，不含分组功能，迁移脚本会补充）
c.execute('''
    CREATE TABLE IF NOT EXISTS saves (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
''')

# 创建 games 表（游戏表，完整字段）
c.execute('''
    CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT,
        file_path TEXT,
        file_name TEXT,
        file_size INTEGER,
        image_path TEXT,
        video_path TEXT,
        description TEXT,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users (id)
    )
''')

# 创建 library 表（游戏库表）
c.execute('''
    CREATE TABLE IF NOT EXISTS library (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        added_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (game_id) REFERENCES games (id),
        UNIQUE(user_id, game_id)
    )
''')

conn.commit()
conn.close()

print("数据库已成功重置！")
