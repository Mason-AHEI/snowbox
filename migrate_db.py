#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 数据库迁移脚本 v1
==================================================
用途：将旧版 games 表迁移到新版结构
      旧版 games 表可能缺少 description、author_id、author_name 等列

迁移策略：
  1. 检查 games 表是否缺少必要列
  2. 如果缺少 → 创建 games_new 新表 → 复制数据 → 删除旧表 → 重命名新表
  3. 如果不缺 → 提示已是最新版本

使用方式：python migrate_db.py
"""

import sqlite3
import os

DATABASE = 'users.db'


def migrate_database():
    """
    迁移 games 表结构：
    检查并补充缺失的列（description, author_id, author_name, file_path, file_name, file_size）
    使用"创建新表 → 复制数据 → 替换旧表"的方式，避免 ALTER TABLE 的限制
    """
    if not os.path.exists(DATABASE):
        print("数据库不存在，跳过迁移")
        return

    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    # --- 检查 games 表的列结构 ---
    c.execute("PRAGMA table_info(games)")
    columns = [col[1] for col in c.fetchall()]  # 提取所有列名

    # 定义新版 games 表必须有的列
    missing_columns = []
    required_columns = ['description', 'author_id', 'author_name', 'file_path', 'file_name', 'file_size']

    for col in required_columns:
        if col not in columns:
            missing_columns.append(col)

    if missing_columns:
        # --- 需要迁移：创建新表并复制数据 ---
        print(f"发现缺失的列: {missing_columns}")

        # 创建新版 games 表（包含所有必要列）
        c.execute('''
            CREATE TABLE IF NOT EXISTS games_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT,
                file_path TEXT,
                file_name TEXT,
                file_size INTEGER,
                image_path TEXT,
                description TEXT,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (author_id) REFERENCES users (id)
            )
        ''')

        # 从旧表复制数据，缺失的列使用默认值填充
        c.execute('SELECT id, name, url, image_path, created_at FROM games')
        rows = c.fetchall()

        for row in rows:
            c.execute('''
                INSERT OR REPLACE INTO games_new
                (id, name, url, image_path, created_at, author_id, author_name, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (row[0], row[1], row[2], row[3], row[4],
                  'default_author', '默认作者', '暂无简介'))

        # 用新表替换旧表
        c.execute('DROP TABLE games')
        c.execute('ALTER TABLE games_new RENAME TO games')

        print("数据库迁移完成！")
    else:
        print("数据库已是最新版本")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    migrate_database()
