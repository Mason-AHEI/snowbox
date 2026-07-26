#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 创建超级管理员脚本
==================================================
用途：在本地 SQLite 数据库中创建一个超级管理员账户
      用于首次部署或需要管理员权限时手动运行

使用方式：python create_superadmin.py
默认账号信息：
  - 用户名：SuperAdmin
  - 邮箱：  superadmin@snowbox.com
  - 密码：  123456
  - 角色：  superadmin（超级管理员，最高权限）

注意：请务必在部署到生产环境后修改默认密码！
"""

import sqlite3    # SQLite 数据库驱动
import hashlib    # 密码 SHA-256 加密
import uuid       # 生成唯一用户 ID
import datetime   # 生成创建时间戳


def create_superadmin():
    """
    创建超级管理员账户
    如果邮箱已存在则跳过，否则创建新账户
    """
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # 检查是否已存在同邮箱的管理员账户，避免重复创建
    c.execute('SELECT id FROM users WHERE email = "superadmin@snowbox.com"')
    if c.fetchone():
        print("主管理员账户已存在")
        conn.close()
        return

    # 生成管理员账户信息
    user_id = str(uuid.uuid4())                          # 随机 UUID 作为用户 ID
    username = 'SuperAdmin'
    email = 'superadmin@snowbox.com'
    password = '123456'                                   # 默认密码（生产环境必须修改）
    hashed_password = hashlib.sha256(password.encode()).hexdigest()  # SHA-256 加密
    created_at = datetime.datetime.now().isoformat()     # ISO 格式时间戳

    try:
        # 尝试使用包含 role 字段的新版表结构插入
        c.execute('''
            INSERT INTO users (id, username, email, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, username, email, hashed_password, 'superadmin', created_at))
    except sqlite3.OperationalError:
        # 如果表结构较旧没有 role 字段，退回不带 role 的插入
        # （旧版表结构，role 字段可能尚不存在）
        c.execute('''
            INSERT INTO users (id, username, email, password, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, username, email, hashed_password, created_at))

    conn.commit()
    conn.close()
    print(f"主管理员账户创建成功！用户名: {username}, 密码: {password}")


if __name__ == '__main__':
    create_superadmin()
