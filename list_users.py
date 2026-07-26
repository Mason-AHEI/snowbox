#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 用户列表查看工具
==================================================
用途：在命令行中打印数据库中所有用户的信息
      用于快速查看注册用户和调试

使用方式：python list_users.py
"""

import sqlite3

# 连接数据库，设置 row_factory 以支持通过列名访问
conn = sqlite3.connect('users.db')
conn.row_factory = sqlite3.Row  # 使查询结果可通过列名访问（如 user['id']）
c = conn.cursor()

try:
    # 查询所有用户（不查询 password 字段，安全起见）
    c.execute('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY created_at DESC')
    users = c.fetchall()

    print('=' * 60)
    print(f'数据库中共有 {len(users)} 个用户')
    print('=' * 60)

    if users:
        for idx, user in enumerate(users, 1):
            print(f'\n用户 #{idx}:')
            print(f'  ID:       {user["id"]}')
            print(f'  用户名:   {user["username"]}')
            print(f'  邮箱:     {user["email"]}')
            print(f'  角色:     {user["role"]}')
            print(f'  创建时间: {user["created_at"]}')
            print(f'  最后登录: {user["last_login"] or "从未登录"}')
        print('\n' + '=' * 60)
    else:
        print('数据库中没有用户')
        print('=' * 60)
except Exception as e:
    print(f'查询失败: {e}')
finally:
    conn.close()
