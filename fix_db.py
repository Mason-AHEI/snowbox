#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 数据库修复脚本
==================================================
用途：修复旧版数据库结构，确保 save_groups 表存在且 saves 表有 group_id 列

使用场景：从旧版本升级时运行，修复缺失的表和列
使用方式：python fix_db.py
"""

import sqlite3
import os

DATABASE = 'users.db'  # SQLite 数据库文件名


def fix_database():
    """
    修复数据库结构：
    1. 确保 save_groups（存档分组）表存在
    2. 确保 saves（存档）表有 group_id 列（用于关联分组）
    """
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    try:
        print("开始修复数据库...")

        # --- 步骤 1：创建 save_groups 表（如果不存在）---
        # 这是存档分组功能依赖的表，旧版本可能没有
        c.execute('''
            CREATE TABLE IF NOT EXISTS save_groups (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#3B82F6',
                created_at TEXT NOT NULL
            )
        ''')
        print("save_groups 表已准备好")

        # --- 步骤 2：检查 saves 表是否有 group_id 列 ---
        # 使用 PRAGMA table_info 获取表的列信息
        c.execute("PRAGMA table_info(saves)")
        columns = [column[1] for column in c.fetchall()]  # column[1] 是列名

        if 'group_id' not in columns:
            # 旧版 saves 表缺少 group_id 列，需要添加
            print("正在添加 group_id 列到 saves 表...")
            c.execute('ALTER TABLE saves ADD COLUMN group_id TEXT')
            print("group_id 列已添加")
        else:
            print("saves 表已包含 group_id 列")

        conn.commit()
        print("数据库修复完成！")

    except Exception as e:
        print(f"修复过程中出错: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    fix_database()
