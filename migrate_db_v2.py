#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 数据库迁移脚本 v2
==================================================
用途：为 save_groups 表添加 parent_id 列，支持分组嵌套（树形结构）

使用场景：从 v1 结构升级到 v2（分组支持父子嵌套）
使用方式：python migrate_db_v2.py
"""

import sqlite3
import os

DATABASE = 'users.db'


def migrate():
    """
    迁移 save_groups 表：
    添加 parent_id 列（指向父分组的 ID），NULL 表示一级分组

    注意：SQLite 的 ALTER TABLE 只支持 ADD COLUMN，不支持复杂修改
    """
    if not os.path.exists(DATABASE):
        print(f"数据库 {DATABASE} 不存在")
        return

    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    try:
        # 检查 save_groups 表是否已有 parent_id 列
        c.execute("PRAGMA table_info(save_groups)")
        columns = [col[1] for col in c.fetchall()]

        if 'parent_id' not in columns:
            # 添加 parent_id 列，允许为 NULL（一级分组没有父分组）
            print("正在添加 parent_id 列到 save_groups 表...")
            c.execute("ALTER TABLE save_groups ADD COLUMN parent_id TEXT")
            print("parent_id 列添加成功！")
        else:
            print("save_groups 表已包含 parent_id 列")

        conn.commit()
        print("\n数据库迁移完成！")

    except Exception as e:
        print(f"迁移失败: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
